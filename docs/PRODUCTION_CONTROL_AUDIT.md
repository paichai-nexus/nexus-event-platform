# Production control audit

Updated: 2026-10-26

This report compares the current repository with the production-control request. It does not claim that the system is ready for a live event. The Supabase migration in `011_production_control_plane.sql` is additive and has not been applied to an operating database.

## Architecture found

- Next.js App Router with React client pages and Route Handlers.
- Repository adapters switch between process-local server Mock and Supabase using environment configuration.
- Supabase RLS, role checks, audit log storage, duplicate check-in protection, prize-draw locking, and rehearsal reset already exist.
- Attendance uses an HttpOnly session cookie. Exit requires a short-lived signed exit pass.
- Before this change, audience voting and judge progress were browser Mock state. They are still not production storage.

## Requirement status

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Admin aggregate Snapshot | Implemented | `/api/event/snapshot` returns server time and monotonic event version with `no-store`. |
| Public Snapshot | Implemented | `/api/event/public-snapshot` uses an explicit allow-list and excludes identities, judge data, scores, rankings, and unpublished results. |
| Polling safety | Implemented | 3-second polling prevents overlapping requests, aborts on unmount, and rejects stale versions. |
| Current presentation team | Implemented | Mock repository and prepared Supabase RPC enforce one presenting team and atomically prepare its vote session. |
| Display control | Implemented | `SPOTLIGHT`, `VOTE_PROGRESS`, and `HOLDING` can be controlled from the dashboard. `AWARD_REVEAL` remains locked before result finalization. |
| Projection screen | Implemented | `/admin/display` is read-only and consumes only the public Snapshot. |
| Event transition validation | Implemented | Invalid jumps and result finalization are rejected server-side. |
| Judge remote unlock | Partially implemented | Admin-only endpoint and prepared RPC require a reason, preserve scores, and write an audit record. Dashboard judge rows still need real submission IDs from a judge repository. |
| Team-specific vote session | Partially implemented | Additive DB table and activation/closure transitions exist. Audience submission storage is not connected because the exact audience ballot and normalization rule conflict with current UI. |
| Official evaluation criteria | Partially implemented | The supplied document's 50 + 100 + 50 criteria and both category-specific presentation rubrics are represented as typed policy data. |
| Score finalization | Decision pending | Existing product request says 80/20; supplied document says 70/30. Audience conversion and tie-breaking are also unapproved, so finalization remains blocked. |
| Result publication | Not implemented | No real result Snapshot can be finalized until the scoring policy conflict is resolved. |
| Judge data persistence | Not implemented | Current judge page and progress rows are Mock data. |
| Audience vote persistence | Not implemented | Current `/vote` interaction remains browser Mock and must not be treated as an official ballot. |
| Audit-log viewer | Not implemented | Database audit writes exist, but there is no admin inspection page. |
| Load/concurrency test | Not verified | Requires an isolated Supabase project and representative concurrent clients. |

## Evaluation document facts

- Professional judges: 70%, 200 points per judge, 3 judges, 600 points total.
- Audience panel: 30%, select two first-place candidates, expected 120 people, 240 points total.
- Combined maximum: 840 points.
- Per-judge professional evaluation: document review 50 + presentation 100 + Q&A 50 = 200.
- The document conflicts with the existing 80/20 product setting; neither rule is silently selected.

## Production blockers

1. Obtain written approval for 70/30 versus 80/20, audience score conversion, valid/invalid ballot rules, and tie-breaking.
2. Implement server-side audience ballot submission using the attendance session, with transaction-level duplicate and eligibility checks.
3. Add judge repository/API data to Snapshot and connect real assignment, draft, submit, unlock, and resubmit flows.
4. Implement immutable result finalization and explicitly controlled publication only after all preconditions pass.
5. Apply migrations to an isolated Supabase project, verify RLS/RPC behavior, then run concurrency and recovery tests.
6. Upgrade the Next.js dependency because the local runtime reports a known security vulnerability in the installed version.
