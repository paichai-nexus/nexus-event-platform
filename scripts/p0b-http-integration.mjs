import assert from "node:assert/strict";

const baseUrl = process.env.P0B_BASE_URL;
const secret = process.env.P0B_TEST_AUTH_SECRET;
if (!baseUrl || !secret) throw new Error("P0B_BASE_URL and P0B_TEST_AUTH_SECRET are required.");

const eventId = "00000000-0000-4000-8000-000000000100";
const adminId = "00000000-0000-4000-8000-000000009001";
const judgeIds = [
  "00000000-0000-4000-8000-000000009101",
  "00000000-0000-4000-8000-000000009102",
  "00000000-0000-4000-8000-000000009103",
];

const actorHeaders = (userId) => ({
  "x-p0b-test-secret": secret,
  "x-p0b-test-user": userId,
});

async function request(path, options = {}) {
  return fetch(new URL(path, baseUrl), { redirect: "manual", ...options });
}

async function json(path, options = {}, expectedStatus = 200) {
  const response = await request(path, options);
  const body = await response.json().catch(() => null);
  assert.equal(response.status, expectedStatus, `${options.method ?? "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return { response, body };
}

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(/audience_attendance_session=([^;]+)/);
  assert.ok(match, `Audience session cookie missing: ${raw}`);
  return `audience_attendance_session=${match[1]}`;
}

const readiness = await json("/api/health/readiness");
assert.equal(readiness.body.mode, "postgres-test");
assert.equal(readiness.body.status, "READY");
assert.match(readiness.body.database, /^nexus_p0b_/);

const unauthorizedSnapshot = await json("/api/event/snapshot", {}, 401);
assert.equal(unauthorizedSnapshot.body.error.code, "UNAUTHORIZED");

const initial = await json(`/api/event/snapshot?eventId=${eventId}`, { headers: actorHeaders(adminId) });
assert.equal(initial.body.runtimeMode, "postgres-test");
assert.equal(initial.body.data.checkInCount, 0);
assert.equal(initial.body.data.registeredCount, 0);
assert.equal(initial.body.data.voteCount, 0);
assert.ok(initial.body.data.teams.length > 0, "Database teams should be visible before activation.");
assert.equal(initial.body.data.teams.every((team) => /^[0-9a-f-]{36}$/i.test(team.id)), true, "Mock-only team identifiers must not leak into a database snapshot.");

assert.equal((await request("/admin/dashboard")).status, 401, "Admin UI must fail closed without integration credentials.");
assert.equal((await request("/admin/dashboard", { headers: actorHeaders(adminId) })).status, 200);
assert.equal((await request("/admin/display", { headers: actorHeaders(adminId) })).status, 200);
assert.equal((await request("/check-in")).status, 200);

const audienceCookies = [];
for (let index = 0; index < 12; index += 1) {
  const qr = await json("/api/attendance/entry-qr", { headers: actorHeaders(adminId) });
  const enterResponse = await request(qr.body.data.entryUrl);
  assert.equal(enterResponse.status, 303, `Audience ${index + 1} entry redirect failed.`);
  const cookie = cookieFrom(enterResponse);
  audienceCookies.push(cookie);
  const attendance = await json(`/api/attendance?eventId=${eventId}`, { headers: { cookie } });
  assert.equal(attendance.body.data.active, true);
  assert.match(attendance.body.data.participantId, /^AUD-/);
}
assert.equal(new Set(audienceCookies).size, 12, "Each audience browser must receive a unique session.");

const afterEntry = await json(`/api/event/snapshot?eventId=${eventId}`, { headers: actorHeaders(adminId) });
assert.equal(afterEntry.body.data.checkInCount, 12);
assert.equal(afterEntry.body.data.registeredCount, 12);
assert.equal(afterEntry.body.data.checkIns.length, 12);
assert.equal(afterEntry.body.data.checkIns.every((row) => row.participantId.startsWith("AUD-")), true);

const activeTeam = afterEntry.body.data.teams.find((team) => team.order === 3);
assert.ok(activeTeam?.id);
assert.equal(activeTeam.name, "P0-B 검증팀");

await json("/api/event/control", {
  method: "PATCH",
  headers: { ...actorHeaders(adminId), "content-type": "application/json" },
  body: JSON.stringify({ action: "ACTIVATE_TEAM", eventId, teamId: activeTeam.id }),
});
await json("/api/event/control", {
  method: "PATCH",
  headers: { ...actorHeaders(adminId), "content-type": "application/json" },
  body: JSON.stringify({ action: "SET_VOTING", eventId, status: "OPEN" }),
});

for (const cookie of audienceCookies) {
  const state = await json(`/api/votes?eventId=${eventId}`, { headers: { cookie } });
  assert.equal(state.body.storage, "DATABASE");
  assert.equal(state.body.data.eligible, true);
  assert.equal(state.body.data.votingStatus, "OPEN");
  assert.equal(state.body.data.teamId, activeTeam.id);
}

const voteOptions = (cookie) => ({
  method: "POST",
  headers: { cookie, origin: new URL(baseUrl).origin, "content-type": "application/json" },
  body: JSON.stringify({ eventId }),
});
const concurrent = await Promise.all([
  request("/api/votes", voteOptions(audienceCookies[0])),
  request("/api/votes", voteOptions(audienceCookies[0])),
]);
const concurrentBodies = await Promise.all(concurrent.map((response) => response.clone().json().catch(() => null)));
assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 200], `Concurrent duplicate vote must reconcile to the single stored row: ${JSON.stringify(concurrentBodies)}`);
assert.equal(new Set(concurrentBodies.map((body) => body.data.submissionId)).size, 1, "Concurrent responses must identify the same stored submission.");
for (const cookie of audienceCookies.slice(1)) {
  await json("/api/votes", voteOptions(cookie));
}
const duplicate = await json("/api/votes", voteOptions(audienceCookies[0]));
assert.equal(duplicate.body.data.submissionId, concurrentBodies[0].data.submissionId);

const afterVotes = await json(`/api/event/snapshot?eventId=${eventId}`, { headers: actorHeaders(adminId) });
assert.equal(afterVotes.body.data.voteCount, 12);
const voteTeam = afterVotes.body.data.voteByTeam.find((team) => team.teamId === activeTeam.id);
assert.equal(voteTeam.voteCount, 12);
assert.equal(voteTeam.eligibilityCount, 12);

const publicSnapshot = await json(`/api/event/public-snapshot?eventId=${eventId}`);
assert.equal(publicSnapshot.body.data.version, afterVotes.body.data.version);
assert.equal(publicSnapshot.body.data.event.votingStatus, afterVotes.body.data.votingStatus);
assert.equal(publicSnapshot.body.data.activeTeam.id, activeTeam.id);
const publicSerialized = JSON.stringify(publicSnapshot.body);
assert.equal(publicSerialized.includes("judgeProgress"), false);
assert.equal(publicSerialized.includes("checkIns"), false);

const judgeSubmissions = [];
for (const [index, judgeId] of judgeIds.entries()) {
  const headers = actorHeaders(judgeId);
  const workspace = await json(`/api/judging?view=workspace&eventId=${eventId}`, { headers });
  assert.equal(workspace.body.storage, "DATABASE");
  assert.equal(workspace.body.data.activeTeamId, activeTeam.id);
  assert.equal(workspace.body.data.assignedTeamIds.includes(activeTeam.id), true);
  assert.equal(workspace.body.data.criteria.length, 2);
  const scores = workspace.body.data.criteria.map((criterion, criterionIndex) => ({
    criterionId: criterion.id,
    score: 80 + index + criterionIndex,
  }));
  await json("/api/judging", {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ eventId, teamId: activeTeam.id, scores }),
  });
  const submitted = await json("/api/judging", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ eventId, teamId: activeTeam.id }),
  });
  assert.equal(submitted.body.data.status, "SUBMITTED");
  judgeSubmissions.push({ judgeId, submissionId: submitted.body.data.submissionId, scores });
}

const judgeSnapshot = await json(`/api/event/snapshot?eventId=${eventId}`, { headers: actorHeaders(adminId) });
assert.equal(judgeSnapshot.body.data.judgeProgress.length, 3);
assert.equal(judgeSnapshot.body.data.judgeProgress.every((row) => row.completed === 1 && row.total === 1), true);

const firstJudge = judgeSubmissions[0];
await json("/api/judging/unlock", {
  method: "POST",
  headers: { ...actorHeaders(adminId), "content-type": "application/json" },
  body: JSON.stringify({ submissionId: firstJudge.submissionId, reason: "P0-B HTTP 재제출 검증" }),
});
const revisedScores = firstJudge.scores.map((score, index) => ({ ...score, score: score.score + index + 1 }));
await json("/api/judging", {
  method: "PUT",
  headers: { ...actorHeaders(firstJudge.judgeId), "content-type": "application/json" },
  body: JSON.stringify({ eventId, teamId: activeTeam.id, scores: revisedScores }),
});
const resubmitted = await json("/api/judging", {
  method: "POST",
  headers: { ...actorHeaders(firstJudge.judgeId), "content-type": "application/json" },
  body: JSON.stringify({ eventId, teamId: activeTeam.id }),
});
assert.equal(resubmitted.body.data.status, "SUBMITTED");

const finalAdmin = await json(`/api/event/snapshot?eventId=${eventId}`, { headers: actorHeaders(adminId) });
const finalPublic = await json(`/api/event/public-snapshot?eventId=${eventId}`);
assert.equal(finalAdmin.body.runtimeMode, "postgres-test");
assert.equal(finalAdmin.body.data.checkInCount, 12);
assert.equal(finalAdmin.body.data.voteCount, 12);
assert.equal(finalPublic.body.data.version, finalAdmin.body.data.version);
assert.equal(finalPublic.body.data.activeTeam.id, finalAdmin.body.data.activeTeamId);

console.log("PASS: P0-B HTTP integration completed for 12 audience members and 3 judges.");
