# P0 data integrity and Git baseline recovery — 2026-10-26

## Safety boundary

- Work branch: `p0/data-integrity-baseline-20261026`
- Worktree: `worktrees/next-security-upgrade`
- Base commit: `66b1902400d84b09408bf36aec690e23c50ddf3b`
- Original checkout branch: `feat/public-event-landing`
- No remote push, merge, deployment, production DB connection, or running-server restart was performed.

## Backup and integrity evidence

Restricted local backup:

`backups/p0-baseline-20261026T123000`

- `original/`: filtered copy of the original checkout.
- `security-worktree/`: filtered copy of the Next.js 16.4.3 worktree before baseline recovery.
- `original.sha256`: 177-file SHA-256 manifest.
- `security-worktree.sha256`: 179-file SHA-256 manifest.
- Both manifests were verified successfully after creation.
- Backup directory permissions exclude group and other users.

The backup excludes Git internals, `.env*` except the empty example, dependencies, build output, TypeScript output, database dumps, SQLite files, and compressed SQL exports.

## Git baseline classification

Tracked application inputs:

- Source: `app/`, `components/`, `features/`, `lib/`, `types/`
- Database definitions: `supabase/migrations/`
- Tests: `tests/`
- Engineering documents: `docs/`, root README and contribution files
- Required configuration: `package.json`, lockfile, TypeScript, Next.js, ESLint, PostCSS, proxy and `.env.example`
- Static assets: `public/` when present; the current checkout contains no public asset files

Explicitly excluded:

- `.env*` except `.env.example`
- API keys, service-role values, browser exit secrets, personal access tokens
- `data/private/`, `private-data/`, exports, DB dumps/backups and SQLite files
- `node_modules/`, `.next/`, `out/`, `build/`, coverage and logs
- generated `next-env.d.ts` and `*.tsbuildinfo`

The finalist catalog previously embedded participant names. Personal names were removed from the Git-tracked catalog; the public team name/category/topic catalog remains. Operational participant identity belongs in the protected database, not source control.

## Original and security-worktree differences

Before this task, the worktree differed from the original checkout only in:

1. `package.json`
2. `package-lock.json`
3. `lib/auth/authorize.ts`
4. new `lib/auth/roles.ts`
5. `supabase/migrations/011_production_control_plane.sql`
6. `tests/operations.test.mts`
7. new `docs/SECURITY_AND_DB_READINESS_2026-10-26.md`

These are the previously reviewed Next.js 16.4.3 security and control-plane changes. Files were not copied back over the original checkout.

## Staging capability

Status: **BLOCKED / NOT RUN**

This machine has no Docker executable, PostgreSQL client/server, Supabase CLI, or configured independent staging connection. Migration 011/012 execution, constraint introspection, live RLS checks, concurrent transaction tests and rollback execution were therefore not performed. Static review and application-level tests are not reported as a staging migration PASS.

Required migration order:

`001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012`

Migration 012 requires the 011 `team_vote_sessions` table and event control columns. It preserves existing attendance and audience submission rows by backfilling stable participant IDs and vote-session references. Any row that cannot be mapped aborts the migration instead of deleting or overwriting it.

## Persistent audience voting design

Flow:

1. The HTTP-only browser attendance cookie carries a random opaque token.
2. PostgreSQL stores only SHA-256 of that token.
3. Attendance creates or reuses a stable `participants.id` scoped to one event.
4. Submission resolves the active event/team vote session and locks the session row.
5. The session must still be `OPEN`, attendance must be active and must predate session opening, and the participant must be active.
6. `(vote_session_id, participant_id)` is unique. Repeated or concurrent requests return the original submission without creating a second vote.
7. Admin Snapshot aggregates the same `audience_submissions` rows.
8. The browser can reload and recover its submitted state from the token-to-participant mapping.

Cross-event composite foreign keys bind attendance, participant, team, session and submission to the same event. Anonymous users receive RPC execution only; direct audience-table writes remain revoked.

Mock and database implementations are selected server-side. The audience UI explicitly labels `SERVER MOCK` versus `SERVER STORAGE`.

Application integration result on the isolated port-3100 Mock server: **PASS**.

- Check-in issued one HTTP-only session.
- Team activation and vote opening succeeded.
- First vote created one submission.
- Repeated submission returned the same submission ID and timestamp.
- Administrator Snapshot reported exactly one vote.

This proves the application contract and server-side Mock separation only. PostgreSQL persistence and RLS remain **NOT RUN**.

## Judge data design

- Existing Supabase authentication and `ADMIN`/`STAFF`/`JUDGE` roles are reused.
- A judge can read only assigned teams and save scores only through guarded RPCs.
- Direct authenticated writes to judge submissions and scores are revoked.
- Draft saves validate event, assignment, active criterion and maximum score.
- Final submission requires every active judge criterion and locks the row.
- Score updates preserve the prior value in `judge_score_revisions`.
- Admin Unlock preserves scores, increments unlock count and writes an audit record containing judge/team scope and reason.
- Unlock and further judge writes are rejected after event/result finalization.
- Judge workspace and administrator progress use the same submission tables.

Application integration result on the isolated port-3100 Mock server: **PASS**.

- Workspace load, Draft save and Final Submit succeeded.
- A post-submit Draft write returned HTTP 409.
- Administrator progress reflected one completed submission.

Supabase-backed save, revision trigger, RLS and Unlock execution remain **NOT RUN**.

## Score-policy conflict

The document values are not mathematically identical:

- Professional judges: `3 × 200 = 600`
- Stated total: `840`
- Implied audience allocation: `840 - 600 = 240`
- `600 / 840 = 71.4286%`
- `240 / 840 = 28.5714%`

An exact 70/30 split of 840 would be 588/252. If professional raw points remain 600 and equal exactly 70%, the implied total would be approximately 857.1429 and the audience allocation approximately 257.1429.

No formula was selected. Audience raw-score definition, conversion, category aggregation and tie handling remain undecided. The existing executable 80/20 preview was not changed, `SCORING_POLICY_READY` remains false, and result finalization remains locked.

## Required staging checks before production

1. Restore an anonymized schema/data clone and apply 001-012 from an empty database.
2. Apply 011-012 to a clone containing representative pre-existing attendance, submissions and judge scores.
3. Inspect every FK, UNIQUE, CHECK, trigger, RLS policy, table privilege and function execute grant.
4. Submit the same audience request concurrently from multiple connections; expect one row and one stable response.
5. Race vote submission against vote closing; no commit may occur after the close transaction wins.
6. Verify cross-event participant/team/session substitutions fail.
7. Exercise judge draft, submit, unauthorized edit, admin unlock, revision history and post-finalization unlock rejection.
8. Verify staff Snapshot counts match direct protected-table counts.
9. Take a disposable DB snapshot, exercise the approved rollback procedure, and verify row counts/checksums. Rollback is **NOT RUN** and must not be attempted first on production.
