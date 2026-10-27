#!/usr/bin/env bash
set -euo pipefail

if ! command -v psql >/dev/null || ! command -v createdb >/dev/null || ! command -v dropdb >/dev/null; then
  echo "BLOCKED: psql, createdb, and dropdb are required." >&2
  exit 2
fi
if [[ "${P0A_POSTGRES_URL_TEMPLATE:-}" != *"__DATABASE__"* ]]; then
  echo "BLOCKED: set P0A_POSTGRES_URL_TEMPLATE with a __DATABASE__ placeholder." >&2
  exit 2
fi
if [[ "${P0A_ALLOW_ISOLATED_DATABASES:-}" != "true" ]]; then
  echo "BLOCKED: set P0A_ALLOW_ISOLATED_DATABASES=true only for an isolated PostgreSQL host." >&2
  exit 2
fi

suffix="$$"
empty_db="nexus_p0a_empty_${suffix}"
upgrade_db="nexus_p0a_upgrade_${suffix}"
maintenance_url="${P0A_POSTGRES_URL_TEMPLATE/__DATABASE__/postgres}"
empty_url="${P0A_POSTGRES_URL_TEMPLATE/__DATABASE__/${empty_db}}"
upgrade_url="${P0A_POSTGRES_URL_TEMPLATE/__DATABASE__/${upgrade_db}}"

cleanup() {
  [[ "$empty_db" == nexus_p0a_empty_* ]] && dropdb --if-exists --maintenance-db="$maintenance_url" "$empty_db"
  [[ "$upgrade_db" == nexus_p0a_upgrade_* ]] && dropdb --if-exists --maintenance-db="$maintenance_url" "$upgrade_db"
}
trap cleanup EXIT

apply_migrations() {
  local database_url="$1"
  local first="$2"
  local last="$3"
  local file number
  for file in supabase/migrations/*.sql; do
    number="$(basename "$file" | cut -c1-3)"
    if (( 10#$number >= 10#$first && 10#$number <= 10#$last )); then
      psql "$database_url" -v ON_ERROR_STOP=1 --single-transaction -f "$file"
    fi
  done
}

verify_concurrent_vote() {
  local database_url="$1"
  local query="set role service_role; select public.submit_audience_vote('00000000-0000-4000-8000-000000000100', 'p0a-concurrent-token-00000000000001');"
  local first_status second_status
  psql "$database_url" -v ON_ERROR_STOP=1 -c "$query" >/dev/null 2>&1 &
  local first_pid=$!
  psql "$database_url" -v ON_ERROR_STOP=1 -c "$query" >/dev/null 2>&1 &
  local second_pid=$!
  set +e
  wait "$first_pid"; first_status=$?
  wait "$second_pid"; second_status=$?
  set -e
  if ! { [[ "$first_status" -eq 0 && "$second_status" -ne 0 ]] || [[ "$first_status" -ne 0 && "$second_status" -eq 0 ]]; }; then
    echo "FAIL: concurrent vote expected one success and one rejection (got $first_status/$second_status)." >&2
    return 1
  fi
  psql "$database_url" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if (
    select count(*) from public.audience_submissions submission
    join public.team_vote_sessions session on session.id = submission.vote_session_id
    where session.event_id = '00000000-0000-4000-8000-000000000100'
      and session.team_id = (
        select id from public.teams
        where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3
      )
  ) <> 1 then
    raise exception 'ASSERTION_FAILED: concurrent vote stored more than one row';
  end if;
end;
$$;
SQL
}

createdb --maintenance-db="$maintenance_url" "$empty_db"
psql "$empty_url" -v ON_ERROR_STOP=1 -f supabase/tests/000_local_auth_bootstrap.sql
apply_migrations "$empty_url" 001 013
psql "$empty_url" -v ON_ERROR_STOP=1 -f supabase/tests/p0a_database_integration.sql
psql "$empty_url" -v ON_ERROR_STOP=1 -f supabase/tests/p0a_concurrency_seed.sql
verify_concurrent_vote "$empty_url"

createdb --maintenance-db="$maintenance_url" "$upgrade_db"
psql "$upgrade_url" -v ON_ERROR_STOP=1 -f supabase/tests/000_local_auth_bootstrap.sql
apply_migrations "$upgrade_url" 001 010
psql "$upgrade_url" -v ON_ERROR_STOP=1 -f supabase/tests/010_upgrade_fixture.sql
apply_migrations "$upgrade_url" 011 013
psql "$upgrade_url" -v ON_ERROR_STOP=1 -f supabase/tests/p0a_database_integration.sql
psql "$upgrade_url" -v ON_ERROR_STOP=1 -f supabase/tests/p0a_concurrency_seed.sql
verify_concurrent_vote "$upgrade_url"

echo "PASS: empty-db and 010-upgrade migration paths completed in isolated temporary databases."
