#!/usr/bin/env bash
set -euo pipefail

if ! command -v psql >/dev/null || ! command -v createdb >/dev/null || ! command -v dropdb >/dev/null; then
  echo "BLOCKED: psql, createdb, and dropdb are required." >&2
  exit 2
fi
if [[ "${P0B_POSTGRES_URL_TEMPLATE:-}" != *"__DATABASE__"* ]]; then
  echo "BLOCKED: set P0B_POSTGRES_URL_TEMPLATE with a __DATABASE__ placeholder." >&2
  exit 2
fi
if [[ "${P0B_ALLOW_ISOLATED_DATABASES:-}" != "true" ]]; then
  echo "BLOCKED: set P0B_ALLOW_ISOLATED_DATABASES=true only for an isolated PostgreSQL host." >&2
  exit 2
fi

node_path="${P0B_NODE_PATH:-$(command -v node || true)}"
if [[ -z "$node_path" || ! -x "$node_path" ]]; then
  echo "BLOCKED: set P0B_NODE_PATH to a Node.js executable." >&2
  exit 2
fi
node_dir="$(dirname "$node_path")"

suffix="$$"
database_name="nexus_p0b_http_${suffix}"
maintenance_url="${P0B_POSTGRES_URL_TEMPLATE/__DATABASE__/postgres}"
database_url="${P0B_POSTGRES_URL_TEMPLATE/__DATABASE__/${database_name}}"
port="${P0B_HTTP_PORT:-3137}"
base_url="http://127.0.0.1:${port}"
auth_secret="p0b-isolated-http-auth-secret-2026-only"
attendance_secret="p0b-isolated-attendance-secret-2026-only"
server_log="$(mktemp -t nexus-p0b-server.XXXXXX.log)"
server_pid=""

cleanup() {
  local exit_status=$?
  if [[ "$exit_status" -ne 0 && -f "$server_log" ]]; then
    echo "--- isolated Next.js server log ---" >&2
    cat "$server_log" >&2
  fi
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [[ "$database_name" == nexus_p0b_http_* ]]; then
    dropdb --if-exists --maintenance-db="$maintenance_url" "$database_name" >/dev/null 2>&1 || true
  fi
  rm -f "$server_log"
  return "$exit_status"
}
trap cleanup EXIT

createdb --maintenance-db="$maintenance_url" "$database_name"
psql "$database_url" -v ON_ERROR_STOP=1 -f supabase/tests/000_local_auth_bootstrap.sql >/dev/null
for migration in supabase/migrations/*.sql; do
  psql "$database_url" -v ON_ERROR_STOP=1 --single-transaction -f "$migration" >/dev/null
done
psql "$database_url" -v ON_ERROR_STOP=1 -f supabase/tests/p0b_http_seed.sql >/dev/null

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
    cat "$server_log" >&2
    echo "FAIL: isolated Next.js server exited before readiness." >&2
    exit 1
  fi
  sleep 1
done
if [[ "$ready" != "true" ]]; then
  cat "$server_log" >&2
  echo "FAIL: isolated Next.js server did not become ready." >&2
  exit 1
fi

P0B_BASE_URL="$base_url" P0B_TEST_AUTH_SECRET="$auth_secret" "$node_path" scripts/p0b-http-integration.mjs
psql "$database_url" -v ON_ERROR_STOP=1 -f supabase/tests/p0b_http_assertions.sql

echo "PASS: isolated P0-B application HTTP and PostgreSQL integration completed."
