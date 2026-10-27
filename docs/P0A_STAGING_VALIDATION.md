# P0-A staging validation

## Runtime modes

The server is fail-closed until `APP_RUNTIME_MODE` is explicitly set.

- `mock`: requires `ALLOW_MOCK_RUNTIME=true` and is rejected by a production Node/Vercel runtime.
- `staging`: requires all Supabase credentials, `APP_BASE_URL`, and a stable `ATTENDANCE_EXIT_SECRET`.
- `production`: has the staging requirements and additionally requires HTTPS URLs.

`GET /api/health/readiness` verifies the database and Supabase Auth admin endpoint without returning credentials or internal errors to the browser. A configuration or dependency failure returns HTTP 503.

## Isolated database validation

Never point the test command at an operating Supabase project. The runner creates and destroys two temporary databases whose names begin with `nexus_p0a_`.

```sh
export P0A_POSTGRES_URL_TEMPLATE='postgresql://postgres:postgres@127.0.0.1:5432/__DATABASE__'
export P0A_ALLOW_ISOLATED_DATABASES=true
npm run test:db
```

The two paths are:

1. Empty PostgreSQL database → migrations 001 through 013.
2. Migrations 001 through 010 → compatibility fixture → migrations 011 through 013.

Both paths run attendance, vote, duplicate/concurrent vote, RLS, judge submission, Unlock, revision, and finalization-lock assertions. The plain PostgreSQL auth shim exists only to emulate the minimum Supabase roles needed by these isolated tests; final validation against a disposable Supabase project remains required before production use.

### Latest local result

On 2026-10-27, both paths passed against an isolated PostgreSQL 17.11 cluster on port 55432. The runner also verified that two concurrent submissions for the same audience member and team produced exactly one stored vote and one rejection. The temporary database server was stopped after the run; no operating Supabase project or application server was changed.

This result validates PostgreSQL migrations, constraints, functions, grants, and RLS behavior under the local auth-role shim. Supabase Auth, PostgREST, and a disposable Supabase project's platform-specific behavior are still not covered by this local result.

## Public access boundary

Migration 013 removes direct anonymous reads of `events` and `teams` and removes direct browser execution of attendance/vote credential RPCs. Public clients use the Next.js API. The API exposes only the existing public Snapshot allowlist and uses the service key only on the server.

No migration or test command in this document targets the production database automatically.
