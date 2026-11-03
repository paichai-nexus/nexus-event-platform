import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const migrationDirectory = resolve("supabase/migrations");
const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
const expected = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(3, "0"));
const actual = files.map((file) => file.slice(0, 3));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(JSON.stringify(actual) === JSON.stringify(expected), `Migration sequence must be 001-031. Received: ${actual.join(", ")}`);

const sqlByFile = new Map(await Promise.all(files.map(async (file) => [file, await readFile(resolve(migrationDirectory, file), "utf8")])));
const allSql = [...sqlByFile.values()].join("\n");
assert(!/\b(drop\s+table|truncate\s+table)\b/i.test(allSql), "Destructive DROP TABLE/TRUNCATE found in migrations.");

const migration011 = sqlByFile.get(files.find((file) => file.startsWith("011_")));
const migration012 = sqlByFile.get(files.find((file) => file.startsWith("012_")));
const migration013 = sqlByFile.get(files.find((file) => file.startsWith("013_")));
const migration015 = sqlByFile.get(files.find((file) => file.startsWith("015_")));
const migration016 = sqlByFile.get(files.find((file) => file.startsWith("016_")));
const migration017 = sqlByFile.get(files.find((file) => file.startsWith("017_")));
const migration018 = sqlByFile.get(files.find((file) => file.startsWith("018_")));
const migration019 = sqlByFile.get(files.find((file) => file.startsWith("019_")));
const migration020 = sqlByFile.get(files.find((file) => file.startsWith("020_")));
const migration021 = sqlByFile.get(files.find((file) => file.startsWith("021_")));
const migration022 = sqlByFile.get(files.find((file) => file.startsWith("022_")));
const migration023 = sqlByFile.get(files.find((file) => file.startsWith("023_")));
const migration024 = sqlByFile.get(files.find((file) => file.startsWith("024_")));
const migration025 = sqlByFile.get(files.find((file) => file.startsWith("025_")));
const migration026 = sqlByFile.get(files.find((file) => file.startsWith("026_")));
const migration027 = sqlByFile.get(files.find((file) => file.startsWith("027_")));
const migration028 = sqlByFile.get(files.find((file) => file.startsWith("028_")));
const migration029 = sqlByFile.get(files.find((file) => file.startsWith("029_")));
const migration030 = sqlByFile.get(files.find((file) => file.startsWith("030_")));
const migration031 = sqlByFile.get(files.find((file) => file.startsWith("031_")));

for (const pattern of [
  /events_active_team_same_event_fk/,
  /team_vote_sessions_staff_read/,
  /unlock_judge_submission/,
  /revoke all on function public\.unlock_judge_submission/,
]) assert(pattern.test(migration011), `011 missing required control-plane guard: ${pattern}`);

for (const pattern of [
  /audience_submission_one_per_session/,
  /audience_attendance_participant_same_event_fk/,
  /judge_score_revisions/,
  /RESULT_FINALIZED/,
  /revoke insert, update, delete on public\.audience_submissions/,
]) assert(pattern.test(migration012), `012 missing required persistence guard: ${pattern}`);

for (const pattern of [
  /drop policy if exists events_public_read/,
  /revoke select on public\.events, public\.teams from anon/,
  /grant execute on function public\.submit_audience_vote\(uuid, text\) to service_role/,
  /exception when unique_violation/,
  /ALREADY_SUBMITTED/,
]) assert(pattern.test(migration013), `013 missing required fail-closed guard: ${pattern}`);

for (const pattern of [
  /audience_jury_reservations enable row level security/,
  /audience_jury_staff_read/,
  /unique \(event_id, student_number\)/,
  /unique \(event_id, pcu_code\)/,
  /pg_advisory_xact_lock/,
  /DEPARTMENT_CAPACITY_REACHED/,
  /revoke all on function public\.register_audience_jury\(uuid, text, text, text, text\) from anon, authenticated/,
  /grant execute on function public\.register_audience_jury\(uuid, text, text, text, text\) to service_role/,
]) assert(pattern.test(migration015), `015 missing required audience-jury guard: ${pattern}`);

for (const pattern of [
  /audience_rank_ballots enable row level security/,
  /unique \(event_id, reservation_id, category\)/,
  /audience_rank_distinct_teams/,
  /AUDIENCE_JURY_AUTH_REQUIRED/,
  /ALREADY_SUBMITTED/,
  /revoke all on function public\.submit_audience_rank_ballot.*from public, anon, authenticated/,
  /grant execute on function public\.submit_audience_rank_ballot.*to service_role/,
]) assert(pattern.test(migration016), `016 missing required ranked-ballot guard: ${pattern}`);

for (const pattern of [
  /prize_inventory enable row level security/,
  /prize_item_draws_one_active_win_per_participant/,
  /pg_advisory_xact_lock/,
  /order by gen_random_uuid\(\)/,
  /PRIZE_DRAW_COMPLETED/,
  /AUDIENCE_JURY/,
  /ALL_PARTICIPANTS/,
  /grant execute on function public\.draw_prize_item_winner\(uuid, uuid\) to authenticated/,
]) assert(pattern.test(migration017), `017 missing required prize-pool guard: ${pattern}`);

for (const pattern of [
  /add column if not exists department text/i,
  /add column if not exists advisor_name text/i,
  /add column if not exists member_names text\[\]/i,
  /do not seed unverified personal information/i,
]) assert(pattern.test(migration018), `018 missing team-profile guard: ${pattern}`);

for (const pattern of [
  /create table public\.paper_judge_scores/i,
  /total_score integer generated always/i,
  /PAPER_SUBMISSION_LOCKED/i,
  /selected_event\.result_status <> 'LOCKED'/i,
  /paper_judge_score_revisions/i,
  /coalesce\(public\.current_app_role\(\) in \('ADMIN', 'STAFF'\), false\) = false/i,
]) assert(pattern.test(migration019), `019 missing paper-score safety guard: ${pattern}`);

for (const pattern of [
  /create table public\.result_show_decks/i,
  /status text not null default 'DRAFT'/i,
  /current_app_role\(\) is distinct from 'ADMIN'/i,
  /SHOW_DECK_NOT_APPROVED/i,
  /RESULT_SHOW_APPROVE/i,
  /p_display_mode = 'AWARD_REVEAL' and v_event\.result_status = 'LOCKED'/i,
]) assert(pattern.test(migration020), `020 missing approved-show safety guard: ${pattern}`);

for (const pattern of [
  /create table public\.prize_stage_snapshots/i,
  /create table public\.prize_stage_eligible_participants/i,
  /current_app_role\(\) is distinct from 'ADMIN'/i,
  /pg_advisory_xact_lock/i,
  /exited_at is null/i,
  /PRIZE_STAGE_ELIGIBILITY_LOCK/i,
  /draw_prize_item_winner_for_stage/i,
  /eligible\.snapshot_id = selected_snapshot\.id/i,
]) assert(pattern.test(migration021), `021 missing prize-stage snapshot guard: ${pattern}`);

for (const pattern of [
  /add column if not exists best_reviewer jsonb/i,
  /result_show_best_reviewer_object/i,
  /BEST_REVIEWER_NOT_APPROVED/i,
  /current_app_role\(\) is distinct from 'ADMIN'/i,
  /best_reviewer_included/i,
]) assert(pattern.test(migration022), `022 missing best-reviewer show guard: ${pattern}`);

for (const pattern of [
  /create table public\.ceremony_control_states/i,
  /CEREMONY_INVALID_TRANSITION/i,
  /current_app_role\(\) is distinct from 'ADMIN'/i,
  /pg_advisory_xact_lock/i,
  /CEREMONY_PHASE_CHANGE/i,
]) assert(pattern.test(migration023), `023 missing ceremony-control guard: ${pattern}`);

for (const pattern of [
  /create function public\.import_team_roster/i,
  /jsonb_array_length\(p_rows\) <> 19/i,
  /startup_count <> 10 or analysis_count <> 9/i,
  /current_app_role\(\) is distinct from 'ADMIN'/i,
  /TEAM_ROSTER_IMPORT/i,
]) assert(pattern.test(migration024), `024 missing atomic team-roster guard: ${pattern}`);

for (const pattern of [
  /create table public\.scoring_policy_versions/i,
  /scoring_policy_weight_total/i,
  /scoring_policy_one_approved_per_event/i,
  /prevent_scoring_policy_reopen/i,
  /current_app_role\(\) is distinct from 'ADMIN'/i,
  /SCORING_POLICY_INCOMPLETE/i,
  /SCORING_POLICY_APPROVE/i,
  /grant execute on function public\.approve_scoring_policy\(uuid, uuid\) to authenticated/i,
]) assert(pattern.test(migration025), `025 missing scoring-policy governance guard: ${pattern}`);

for (const pattern of [
  /delete from public\.participants/i,
  /affiliation = 'REHEARSAL'/i,
  /participant_code ~ '\^TEST-\[0-9\]\{3\}\$'/i,
  /display_label = 'Participant ' \|\| participant_code/i,
  /REHEARSAL_PARTICIPANT_CLEANUP_INCOMPLETE/i,
]) assert(pattern.test(migration026), `026 missing production-baseline cleanup guard: ${pattern}`);

for (const pattern of [
  /pcu_code between 'PCU-001' and 'PCU-020'/i,
  /pcu_code between 'PCU-101' and 'PCU-120'/i,
  /'IT경영정보학과', 21, 40/i,
  /'호텔항공경영학과', 101, 120/i,
  /pg_advisory_xact_lock/i,
  /DEPARTMENT_CAPACITY_REACHED/i,
  /pcu_code = 'PCU-' \|\| lpad/i,
  /grant execute on function public\.register_audience_jury\(uuid, text, text, text, text\) to service_role/i,
]) assert(pattern.test(migration027), `027 missing contiguous audience-jury code guard: ${pattern}`);

for (const pattern of [
  /alter type public\.prize_draw_stage add value if not exists 'FIRST' before 'SECOND'/i,
]) assert(pattern.test(migration028), `028 missing first-stage enum guard: ${pattern}`);

for (const pattern of [
  /create table public\.part_attendance_entries/i,
  /unique \(event_id, student_number, part\)/i,
  /ATTENDANCE_IDENTITY_MISMATCH/i,
  /pg_advisory_xact_lock/i,
  /grant execute on function public\.submit_part_attendance.*to anon, authenticated/i,
  /selected_part := case when p_stage = 'FIRST' then 1 else 2 end/i,
  /selected_prize\.award_only or selected_prize\.draw_stage is distinct from p_stage/i,
  /PRIZE_STAGE_MISMATCH/i,
  /'FIRST_DRAW','AUDIENCE_CANDIDATES','SECOND_DRAW'/i,
]) assert(pattern.test(migration029), `029 missing attendance/prize run-of-show guard: ${pattern}`);

for (const pattern of [
  /create or replace function public\.get_prize_draw_results/i,
  /current_app_role\(\) in \('ADMIN', 'STAFF'\)/i,
  /part_attendance_entries/i,
  /masked_student_number/i,
  /masked_name/i,
  /revoke all on function public\.get_prize_draw_results\(uuid\) from public/i,
]) assert(pattern.test(migration030), `030 missing masked prize-result guard: ${pattern}`);

for (const pattern of [
  /grant usage on schema public to authenticated/i,
  /grant select, insert, update, delete on public\.profiles to authenticated/i,
  /grant select, update on public\.events to authenticated/i,
  /grant select, insert, update on public\.judge_submissions to authenticated/i,
  /grant select on public\.result_snapshots, public\.prize_draws, public\.audit_logs to authenticated/i,
]) assert(pattern.test(migration031), `031 missing hosted Data API grant: ${pattern}`);

console.log(`Migration static validation passed (${files.length} files: ${files[0]} … ${files.at(-1)}).`);
