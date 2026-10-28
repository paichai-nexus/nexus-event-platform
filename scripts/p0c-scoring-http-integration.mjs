import assert from "node:assert/strict";

const baseUrl = process.env.P0C_SCORING_BASE_URL;
const secret = process.env.P0B_TEST_AUTH_SECRET;
if (!baseUrl || !secret) throw new Error("P0C_SCORING_BASE_URL and P0B_TEST_AUTH_SECRET are required.");

const eventA = "00000000-0000-4000-8000-000000000100";
const eventB = "00000000-0000-4000-8000-000000000110";
const missingEvent = "00000000-0000-4000-8000-000000000199";
const adminId = "00000000-0000-4000-8000-000000009001";
const staffId = "00000000-0000-4000-8000-000000009002";
const judgeId = "00000000-0000-4000-8000-000000009101";
const failureOnly = process.argv.includes("--failure-only");

const actorHeaders = (userId) => ({
  "x-p0b-test-secret": secret,
  "x-p0b-test-user": userId,
  accept: "application/json",
});

async function get(path, headers = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    headers,
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

function expectStatus(result, expected, label) {
  assert.equal(result.response.status, expected, `${label}: HTTP ${result.response.status} ${JSON.stringify(result.body)}`);
}

if (failureOnly) {
  const failed = await get(`/api/scoring/diagnostics?eventId=${eventA}`, actorHeaders(adminId));
  expectStatus(failed, 500, "database failure must fail closed");
  assert.equal(failed.body?.ok, false);
  assert.equal(failed.body?.error?.code, "DATABASE_ERROR");
  assert.equal("officialScoresAvailable" in (failed.body ?? {}), false);
  console.log("PASS: scoring diagnostics failed closed after database permission removal.");
  process.exit(0);
}

const ready = await get("/api/health/readiness");
expectStatus(ready, 200, "readiness");
assert.equal(ready.body.mode, "postgres-test");
assert.equal(ready.body.status, "READY");

const anonymous = await get(`/api/scoring/diagnostics?eventId=${eventA}`);
expectStatus(anonymous, 401, "anonymous diagnostics");
assert.equal(anonymous.body.error.code, "UNAUTHORIZED");

const judge = await get(`/api/scoring/diagnostics?eventId=${eventA}`, actorHeaders(judgeId));
expectStatus(judge, 403, "judge diagnostics");
assert.equal(judge.body.error.code, "FORBIDDEN");

const invalid = await get("/api/scoring/diagnostics?eventId=not-a-uuid", actorHeaders(adminId));
expectStatus(invalid, 400, "invalid event id");
assert.equal(invalid.body.error, "VALID_EVENT_ID_REQUIRED");

const missing = await get(`/api/scoring/diagnostics?eventId=${missingEvent}`, actorHeaders(adminId));
expectStatus(missing, 404, "missing event");
assert.equal(missing.body.error.code, "NOT_FOUND");

const adminA = await get(`/api/scoring/diagnostics?eventId=${eventA}`, actorHeaders(adminId));
const staffA = await get(`/api/scoring/diagnostics?eventId=${eventA}`, actorHeaders(staffId));
expectStatus(adminA, 200, "admin diagnostics");
expectStatus(staffA, 200, "staff diagnostics");
assert.equal(adminA.response.headers.get("cache-control"), "no-store, max-age=0");
assert.equal(adminA.body.runtimeMode, "postgres-test");
assert.equal(adminA.body.status, "POLICY_APPROVAL_REQUIRED");
assert.equal(adminA.body.officialScoresAvailable, false);
assert.deepEqual(staffA.body.teams, adminA.body.teams);
assert.deepEqual(staffA.body.reasons, adminA.body.reasons);

const complete = adminA.body.teams.find((team) => team.teamName === "P0-C 완전제출팀");
const incomplete = adminA.body.teams.find((team) => team.teamName === "P0-C 누락제출팀");
assert.ok(complete);
assert.ok(incomplete);
assert.equal(adminA.body.teams.length, 2);
assert.equal(complete.assignedJudges, 2);
assert.equal(complete.submittedJudges, 2);
assert.equal(complete.completeJudgeSubmissions, 2);
assert.equal(complete.judgeScorePreview100, 62.5);
assert.equal(complete.audienceVoteCount, 2);
assert.equal(complete.audienceEligibleCount, 3);
assert.equal(incomplete.assignedJudges, 2);
assert.equal(incomplete.submittedJudges, 1);
assert.equal(incomplete.completeJudgeSubmissions, 0);
assert.equal(incomplete.judgeScorePreview100, null);
assert.equal(incomplete.audienceVoteCount, 1);
assert.equal(incomplete.audienceEligibleCount, 3);

const adminB = await get(`/api/scoring/diagnostics?eventId=${eventB}`, actorHeaders(adminId));
expectStatus(adminB, 200, "event B diagnostics");
assert.equal(adminB.body.status, "POLICY_APPROVAL_REQUIRED");
assert.equal(adminB.body.officialScoresAvailable, false);
assert.equal(adminB.body.teams.length, 1);
assert.equal(adminB.body.teams[0].teamName, "P0-C 타행사팀");
assert.equal(adminB.body.teams[0].judgeScorePreview100, 99.5);
assert.equal(adminB.body.teams[0].audienceVoteCount, 1);
assert.equal(adminB.body.teams[0].audienceEligibleCount, 2);
assert.equal(adminA.body.teams.some((team) => team.teamName === "P0-C 타행사팀"), false);
assert.equal(adminB.body.teams.some((team) => team.teamName.startsWith("P0-C 완전")), false);

for (const payload of [adminA.body, staffA.body, adminB.body]) {
  const serialized = JSON.stringify(payload);
  assert.equal(/"(?:rank|finalScore|officialRank|resultSnapshot)"/.test(serialized), false);
  assert.equal(payload.officialScoresAvailable, false);
  assert.equal(payload.status, "POLICY_APPROVAL_REQUIRED");
}

console.log("PASS: P0-C scoring diagnostics HTTP integration verified ADMIN/STAFF RLS, isolation, missing data, and vote counts.");
