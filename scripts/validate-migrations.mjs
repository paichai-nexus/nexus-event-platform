import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const migrationDirectory = resolve("supabase/migrations");
const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
const expected = Array.from({ length: 14 }, (_, index) => String(index + 1).padStart(3, "0"));
const actual = files.map((file) => file.slice(0, 3));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(JSON.stringify(actual) === JSON.stringify(expected), `Migration sequence must be 001-014. Received: ${actual.join(", ")}`);

const sqlByFile = new Map(await Promise.all(files.map(async (file) => [file, await readFile(resolve(migrationDirectory, file), "utf8")])));
const allSql = [...sqlByFile.values()].join("\n");
assert(!/\b(drop\s+table|truncate\s+table)\b/i.test(allSql), "Destructive DROP TABLE/TRUNCATE found in migrations.");

const migration011 = sqlByFile.get(files.find((file) => file.startsWith("011_")));
const migration012 = sqlByFile.get(files.find((file) => file.startsWith("012_")));
const migration013 = sqlByFile.get(files.find((file) => file.startsWith("013_")));

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

console.log(`Migration static validation passed (${files.length} files: ${files[0]} … ${files.at(-1)}).`);
