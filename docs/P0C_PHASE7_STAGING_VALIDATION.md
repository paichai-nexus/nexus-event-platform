# P0-C Phase 7 — Supabase Staging validation

This workflow targets only an approved Supabase Staging project. It does not apply migrations, create users, seed events, change scores, or contact Production.

## Target lock

Both hosted validation commands stop before the first network call unless all of the following are true:

- `APP_RUNTIME_MODE=staging`
- `ALLOW_STAGING_TESTS=true`
- `NEXT_PUBLIC_SUPABASE_URL` is exactly `https://<20-character-ref>.supabase.co`
- the URL ref equals `STAGING_SUPABASE_PROJECT_REF`
- the ref appears in `STAGING_SUPABASE_PROJECT_REF_ALLOWLIST`
- `PRODUCTION_SUPABASE_PROJECT_REFS` is present and does not contain the Staging ref
- `APP_BASE_URL` appears in `STAGING_APP_ORIGIN_ALLOWLIST`
- `PRODUCTION_APP_ORIGINS` is present and does not contain the Staging app origin
- required Supabase and application runtime credentials are present
- `APP_BASE_URL` uses HTTPS

Project refs and application origins are identifiers, not proof of environment ownership. The Staging allowlists and separately maintained Production registries are mandatory. Never store real keys, passwords, account credentials, or database URLs in Git.

## Read-only catalog validation

`npm run test:p0c:staging-catalog` requires `P0C_STAGING_DATABASE_URL`. The URL must either use `db.<approved-ref>.supabase.co` or a Supabase pooler username of `postgres.<approved-ref>`, and must specify `sslmode=require` or `sslmode=verify-full`.

The command sets PostgreSQL to read-only, checks migration versions 001–014, verifies RLS on operational tables, and checks the expected table/RPC grants for `anon`, `authenticated`, and `service_role`. It does not run migration SQL.

## Read-only Auth and HTTP validation

`npm run test:p0c:staging-http` requires a short-lived, pre-issued application session cookie for one approved active ADMIN, STAFF, and JUDGE account plus `P0C_STAGING_EVENT_ID`. The tool does not perform login or logout because Auth session creation and `last_sign_in_at` updates are remote writes. It first verifies that the approved application origin reports `mode=staging` and `status=READY`, then performs GET-only role checks and verifies direct anonymous PostgREST reads are denied. It does not save scores, unlock submissions, control the event, enter attendance, submit votes, or create test data. Cookie values are secrets and must be supplied only through the execution environment.

Expected matrix:

| Request | ADMIN | STAFF | JUDGE | Anonymous |
| --- | --- | --- | --- | --- |
| Scoring diagnostics | 200 | 200 | 403 | 401 |
| Admin event snapshot | 200 | 200 | 403 | 401 |
| Judge workspace | 403 | 403 | 200 | not tested |

Successful scoring diagnostics must retain `POLICY_APPROVAL_REQUIRED` and `officialScoresAvailable: false`; no rank or result snapshot is accepted.

## Local versus hosted status

- `npm run test:p0c:staging-safety` is local and requires no credentials or network.
- PostgreSQL-only P0-A/P0-B/P0-C tests do not validate Supabase Auth, PostgREST translation, hosted JWT claims, or project configuration.
- Catalog and HTTP commands are **NOT RUN** until a disposable Staging project, approved accounts, and secrets are supplied out of band.
- A BLOCKED preflight must never be reported as a hosted PASS.

## Preparation checklist

1. Confirm the project ref is Staging and register all Production refs separately.
2. Confirm migrations 001–014 were applied through an approved Staging-only process.
3. Provision approved non-production ADMIN, STAFF, and JUDGE accounts and matching active profiles.
4. Prepare two isolated rehearsal events if cross-event validation is required; do not reuse Production data.
5. Store credentials only in the execution environment or an approved secret store.
6. Run catalog validation before HTTP validation.
7. Preserve `result_status=LOCKED`, `SCORING_POLICY_READY=false`, and all official-result publication blocks.
