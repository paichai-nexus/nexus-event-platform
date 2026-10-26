# Security and production DB readiness review — 2026-10-26

## Change boundary

- Review and changes were made in the detached worktree `worktrees/next-security-upgrade` at base commit `66b1902400d84b09408bf36aec690e23c50ddf3b`.
- The application source in the original checkout was untracked, so it was copied into the worktree with build outputs and dependencies excluded, then compared with a dry-run sync before edits.
- The original checkout, running server, remote repository, and Supabase database were not changed, restarted, migrated, merged, or deployed.

## Framework security update

- Next.js: `16.4.0` → `16.4.3` (exact version).
- `eslint-config-next`: `16.4.0` → `16.4.3` (exact version).
- ESLint: `10.0.3` → `9.39.5` (exact version), because the plugins bundled with `eslint-config-next@16.4.3` declare compatibility through ESLint 9 and the prior dependency tree was invalid.
- React and React DOM remain at `19.3.0`.

## Browser mock vote inventory

The audience vote path is not connected to Supabase yet.

- `features/event/data/mockEventStore.ts`: seeds `voteCount`, local voted-team state, and mock judge rows.
- `features/event/context/EventOpsProvider.tsx`: `SUBMIT_VOTE` changes browser reducer state only; refresh/new browser state is not an authoritative vote ledger.
- `app/vote/page.tsx`: calls the browser-only `submitVote` and labels the page as mock mode.
- `app/admin/voting/page.tsx`: distributes the total mock count across teams for display (`AGGREGATED MOCK`).
- `app/admin/dashboard/page.tsx`: displays the mock aggregate.
- `app/admin/results/page.tsx`: derives and exports mock per-team counts.
- `app/admin/scoring/page.tsx` and `app/admin/judging/page.tsx`: use mock judge progress and score rows.

Production blockers:

1. There is no audience-vote API, repository, or service that writes `audience_submissions` and `audience_scores`.
2. There is no server-issued participant credential mapped to `participants.id` for public voting. Attendance uses a separate hashed browser token and label.
3. RLS intentionally has no anonymous insert policy for audience submissions/scores. A security-definer RPC or authenticated participant model must be designed before writes are enabled.
4. Eligibility is captured when a team vote session opens, but `check_ins` plus browser attendance sessions may double-count the same person until an identity reconciliation rule exists.
5. Duplicate-vote rules, invalid-vote criteria, audience conversion formula, ties, and cross-category aggregation remain unapproved.

## Judge submission linkage

Database foundations exist: assignments, submissions, per-criterion scores, owner-only draft editing, score validation triggers, final-submission write protection, and audited administrator unlock.

The application linkage remains incomplete:

- The administrator judging/scoring screens read browser mock state rather than `judge_assignments`, `judge_submissions`, and `judge_scores`.
- No judge submission repository/API currently creates drafts, saves criterion scores, or submits a locked result.
- The unlock API accepts a real submission UUID and calls the audited RPC, but the mock monitor does not supply real submission IDs.
- Therefore judge submission status cannot yet be treated as an operational source of truth.

## `011_production_control_plane.sql` compatibility review

The migration remains unapplied and requires staging execution against a schema clone before production approval.

Review changes made:

- Added composite event/team integrity for active teams and vote sessions.
- Prevented activation of completed teams and switching away from an unfinished active team.
- Prevented an existing vote session from being reset/reopened by reactivation.
- Replaced the voting-status RPC so event state and the active team's vote-session state change in one transaction.
- Captured an eligibility-count snapshot at vote opening.
- Added vote-session `updated_at` maintenance.
- Extended rehearsal reset to remove only the selected rehearsal event's vote sessions and to restore new control-plane columns; LIVE reset remains forbidden.

Remaining migration risks:

- Constraint creation must be tested against a schema/data clone to detect any existing cross-event references or duplicate partial objects.
- The migration has not been executed by PostgreSQL in this review, so function/constraint syntax still requires staging migration validation.
- Public RLS permits anonymous reads of event rows and active team rows. The public API applies an explicit field allow-list, but direct Supabase clients can read all columns on those two tables. A dedicated public view/RPC is preferred before production if either table gains sensitive columns.
- All `security definer` functions rely on fixed `search_path = public` and role checks; this must remain true in future edits.

## Score policy conflict

- The current executable scoring function remains 80% professional / 20% audience.
- The supplied document policy remains recorded as a 70% / 30% candidate, 200 points per judge, and 840 total, with `CONFLICT_REQUIRES_APPROVAL` status.
- Official scoring remains blocked until the audience conversion formula, tie rule, and category aggregation rule are approved.
- No result finalization or publication path was unlocked by this work.

## Required next steps before production DB use

1. Restore the current untracked application into normal Git tracking so reviews and merges cannot silently omit it.
2. Run all migrations, including 011, on a disposable clone populated with representative existing records.
3. Decide participant identity/credential and attendance-to-voter reconciliation.
4. Approve vote validity, conversion, tie, and category rules.
5. Implement audience and judge repositories/APIs with transactional RPCs and adversarial RLS tests.
6. Connect admin monitors to real database projections and preserve audit evidence.
7. Perform staging concurrency tests for vote open/close, duplicate submissions, judge submit/unlock, and rehearsal reset.
