#!/usr/bin/env bash
set -euo pipefail

if ! command -v psql >/dev/null || ! command -v createdb >/dev/null || ! command -v dropdb >/dev/null; then
  echo "BLOCKED: psql, createdb, and dropdb are required." >&2
  exit 2
fi
if [[ "${P0C_POSTGRES_URL_TEMPLATE:-}" != *"__DATABASE__"* ]]; then
  echo "BLOCKED: set P0C_POSTGRES_URL_TEMPLATE with a __DATABASE__ placeholder." >&2
  exit 2
fi
if [[ "${P0C_ALLOW_ISOLATED_DATABASES:-}" != "true" ]]; then
  echo "BLOCKED: set P0C_ALLOW_ISOLATED_DATABASES=true only for an isolated PostgreSQL host." >&2
  exit 2
fi

node_path="${P0C_NODE_PATH:-$(command -v node || true)}"
if [[ -z "$node_path" || ! -x "$node_path" ]]; then
  echo "BLOCKED: set P0C_NODE_PATH to a Node.js executable." >&2
  exit 2
fi
node_dir="$(dirname "$node_path")"

readonly suffix="$$"
readonly database_name="nexus_p0b_p0c_scoring_${suffix}"
maintenance_url="${P0C_POSTGRES_URL_TEMPLATE/__DATABASE__/postgres}"
database_url="${P0C_POSTGRES_URL_TEMPLATE/__DATABASE__/${database_name}}"
port="${P0C_HTTP_PORT:-3149}"
base_url="http://127.0.0.1:${port}"
auth_secret="$("$node_path" -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
attendance_secret="$("$node_path" -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
server_log="$(mktemp -t nexus-p0c-scoring.XXXXXX.log)"
server_pid=""
database_created=false

if command -v lsof >/dev/null && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "BLOCKED: test port $port is already in use; the existing process was not changed." >&2
  exit 2
fi

cleanup() {
  local test_status=$?
  local cleanup_status=0
  local dropdb_output=""
  local remaining_database=""

  # Avoid recursively invoking this trap when cleanup selects the final status.
  trap - EXIT

  if [[ "$test_status" -ne 0 && -f "$server_log" ]]; then
    echo "--- isolated P0-C server log ---" >&2
    cat "$server_log" >&2
  fi
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [[ "$database_created" == "true" ]]; then
    if [[ ! "$database_name" =~ ^nexus_p0b_p0c_scoring_[0-9]+$ ]]; then
      echo "FAIL: refusing to delete unexpected database name '$database_name'." >&2
      cleanup_status=1
    elif ! dropdb_output="$(dropdb --force --maintenance-db="$maintenance_url" "$database_name" 2>&1)"; then
      echo "FAIL: could not delete isolated P0-C database '$database_name'." >&2
      if [[ -n "$dropdb_output" ]]; then
        echo "$dropdb_output" >&2
      fi
      cleanup_status=1
    elif ! remaining_database="$(psql "$maintenance_url" -X -qAt -v ON_ERROR_STOP=1 -c "select datname from pg_database where datname = '$database_name'" 2>&1)"; then
      echo "FAIL: could not verify removal of isolated P0-C database '$database_name'." >&2
      if [[ -n "$remaining_database" ]]; then
        echo "$remaining_database" >&2
      fi
      cleanup_status=1
    elif [[ "$remaining_database" == "$database_name" ]]; then
      echo "FAIL: isolated P0-C database '$database_name' still exists after dropdb." >&2
      cleanup_status=1
    else
      database_created=false
    fi
  fi
  rm -f "$server_log"

  if [[ "$test_status" -ne 0 ]]; then
    exit "$test_status"
  fi
  if [[ "$cleanup_status" -ne 0 ]]; then
    exit "$cleanup_status"
  fi
  exit 0
}
trap cleanup EXIT

createdb --maintenance-db="$maintenance_url" "$database_name"
database_created=true
psql "$database_url" -v ON_ERROR_STOP=1 -f supabase/tests/000_local_auth_bootstrap.sql >/dev/null
for migration in supabase/migrations/*.sql; do
  psql "$database_url" -v ON_ERROR_STOP=1 --single-transaction -f "$migration" >/dev/null
done
psql "$database_url" -v ON_ERROR_STOP=1 -f supabase/tests/p0c_scoring_http_seed.sql >/dev/null

env \
  PATH="$node_dir:$PATH" \
  APP_RUNTIME_MODE=postgres-test \
  ALLOW_POSTGRES_TEST_RUNTIME=true \
  P0B_POSTGRES_URL="$database_url" \
  P0B_TEST_AUTH_SECRET="$auth_secret" \
  P0B_PSQL_PATH="$(command -v psql)" \
  ATTENDANCE_EXIT_SECRET="$attendance_secret" \
  APP_BASE_URL="$base_url" \
  "$node_path" node_modules/next/dist/bin/next dev -H 127.0.0.1 -p "$port" >"$server_log" 2>&1 &
server_pid=$!

ready=false
for _ in $(seq 1 60); do
  if curl --silent --fail "$base_url/api/health/readiness" >/dev/null 2>&1; then
    ready=true
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "FAIL: isolated P0-C server exited before readiness." >&2
    exit 1
  fi
  sleep 1
done
if [[ "$ready" != "true" ]]; then
  echo "FAIL: isolated P0-C server did not become ready." >&2
  exit 1
fi

P0C_SCORING_BASE_URL="$base_url" P0B_TEST_AUTH_SECRET="$auth_secret" "$node_path" scripts/p0c-scoring-http-integration.mjs
psql "$database_url" -v ON_ERROR_STOP=1 -f supabase/tests/p0c_scoring_http_assertions.sql

# Force the database-read path to fail, then prove the API does not return a
# successful or fabricated diagnostic result.
psql "$database_url" -v ON_ERROR_STOP=1 -c "revoke execute on function public.get_audience_vote_snapshot(uuid) from authenticated" >/dev/null
P0C_SCORING_BASE_URL="$base_url" P0B_TEST_AUTH_SECRET="$auth_secret" "$node_path" scripts/p0c-scoring-http-integration.mjs --failure-only

echo "PASS: isolated P0-C scoring diagnostics HTTP and PostgreSQL integration completed."
