# Backend setup

The application is fail-closed until `APP_RUNTIME_MODE` is explicitly configured. Missing Supabase settings never cause `staging` or `production` to fall back to Mock data. Local UI development may use `APP_RUNTIME_MODE=mock` only together with `ALLOW_MOCK_RUNTIME=true`; this mode is rejected in production runtimes and is not durable across a Node.js process restart.

## Environment

Copy `.env.example` to `.env.local` and set:

- `APP_RUNTIME_MODE` (`mock`, `postgres-test`, `staging`, or `production`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose it through a `NEXT_PUBLIC_` variable)
- `APP_BASE_URL`
- `ATTENDANCE_EXIT_SECRET`

Never commit `.env.local`.

## Migration order

Apply migrations `001` through `014` in filename order. They include the core schema, indexes, RLS, atomic operations, rehearsal fixtures, attendance, team slots, prize and mission tables, production controls, persistent voting/judging, fail-closed public access, and explicit server-only read grants.

Automatic local seeding is disabled in `supabase/config.toml`. Staging identities and test events must be separately approved and must not be inserted implicitly by `supabase db reset`.

The rehearsal fixture in migration 005 deliberately does not create real people, auth users, or evaluation criteria. Criteria, score allocation, participant authentication, tie-breaking, and post-submit reopening remain `RULE_NOT_CONFIRMED`.

## First operator

Create the operator through Supabase Auth administration. Then insert the matching profile from a trusted SQL/admin context:

```sql
insert into public.profiles (user_id, role, display_name)
values ('AUTH_USER_UUID', 'ADMIN', 'Event Administrator');
```

There is no self-signup route. `/admin/*` requires `ADMIN` or `STAFF`; `/judge` requires `JUDGE`. Route-level checks are only the first gate: mutating Route Handlers validate the role again and RLS/RPC enforce it in PostgreSQL.

## Implemented vertical slice

`POST /api/check-ins` performs validated manual check-in through the service and repository boundary. With Supabase configured it calls `perform_check_in`; otherwise it uses the process-local mock repository. `GET /api/event/snapshot` supplies the registered/check-in count and recent log to the shared UI, so Dashboard and Check-In use the same server source.

Database uniqueness on `(event_id, participant_id)` and `INSERT ... ON CONFLICT` prevent duplicate check-in during concurrent requests. A successful production check-in also writes `audit_logs`.

`PATCH /api/event/control` persists voting status, event status, event mode, and rehearsal reset. Production mutations call audited PostgreSQL functions; mode changes and reset are ADMIN-only. `POST /api/prizes` performs a serialized server-side draw, excludes active previous winners, stores history, and returns it through the shared Snapshot API.

## Security notes

- The service-role key is imported only from `server-only` modules.
- Anonymous users have no direct access to operational participant, check-in, voting, result, prize, or audit data.
- Participant display codes are not production credentials. The access adapter boundary is defined, but activation waits for the official credential policy.
- Evaluation score triggers enforce criterion scope and maximum score.
- Submitted judge records are read-only unless an administrator executes an audited recovery workflow.
- Rehearsal reset refuses `LIVE` events and runs in one database transaction.

## Not yet production-verified

No Supabase project or credentials were supplied, so migrations, Auth cookies, RLS policies, RPC execution, and Realtime have not been exercised against a remote database. Apply migrations to a non-production Supabase project and run the event-day test plan before enabling `LIVE` mode.

For the fail-closed hosted validation workflow and required Production/Staging target separation, see `docs/P0C_PHASE7_STAGING_VALIDATION.md`.
