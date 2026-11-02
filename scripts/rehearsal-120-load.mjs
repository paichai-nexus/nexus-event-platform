import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const baseUrl = process.env.REHEARSAL_BASE_URL ?? "http://127.0.0.1:3004";
const eventId = "00000000-0000-4000-8000-000000000100";
const teamId = "TEAM-01";
const departments = ["경영학과", "IT경영정보학과", "호텔항공경영학과", "관광경영학과", "항공서비스학과", "글로벌비즈니스학과"];
const concurrency = Number.parseInt(process.env.REHEARSAL_CONCURRENCY ?? "20", 10);
if (process.env.ALLOW_REHEARSAL_LOAD_TEST !== "true") throw new Error("BLOCKED: set ALLOW_REHEARSAL_LOAD_TEST=true for an explicit Mock rehearsal only.");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) throw new Error("REHEARSAL_CONCURRENCY must be between 1 and 50.");

async function request(path, init) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => null);
  return { response, body, duration: performance.now() - started };
}
async function ok(path, init) { const result = await request(path, init); if (!result.response.ok || !result.body?.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${result.response.status} ${JSON.stringify(result.body)}`); return result; }
async function control(body) { return ok("/api/event/control", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, eventId }) }); }
async function batches(items, handler) { const results = []; for (let start = 0; start < items.length; start += concurrency) results.push(...await Promise.all(items.slice(start, start + concurrency).map(handler))); return results; }
function authCookie(response) { const raw = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie().join("; ") : response.headers.get("set-cookie") ?? ""; const match = raw.match(/audience_jury_auth_session=([^;,]+)/); if (!match) throw new Error("Audience authentication cookie was not issued."); return `audience_jury_auth_session=${match[1]}`; }
function percentile(values, ratio) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0; }

const health = await request("/api/health/readiness");
assert.equal(health.response.ok, true, "readiness endpoint must be available");
assert.equal(health.body?.mode, "mock", "load rehearsal refuses any non-Mock runtime before writes");
assert.equal(health.body?.status, "EXPLICIT_MOCK", "Mock runtime must be explicit");

await control({ action: "RESET_REHEARSAL" });
try {
  const reservations = departments.flatMap((department, departmentIndex) => Array.from({ length: 20 }, (_, index) => ({ department, name: "테스트학생", studentNumber: `${2026 + departmentIndex}${String(index + 1).padStart(4, "0")}` })));
  const imported = await ok("/api/audience-reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, rows: reservations }) });
  const reservationIds = new Map(imported.body.data.rows.map((row) => [row.studentNumber, row.id]));
  await batches(reservations, (reservation) => ok("/api/audience-reservations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, id: reservationIds.get(reservation.studentNumber), paperSigned: true }) }));

  const registrations = await batches(reservations, async (reservation) => {
    const result = await ok("/api/audience-jury", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, ...reservation }) });
    return { ...reservation, serialNumber: result.body.data.registration.serialNumber };
  });
  assert.equal(registrations.length, 120);
  assert.equal(new Set(registrations.map((item) => item.serialNumber)).size, 120);

  const authenticated = await batches(registrations, async (registration) => {
    const result = await ok("/api/audience-jury/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, name: registration.name, studentNumber: registration.studentNumber, serialNumber: registration.serialNumber }) });
    return { cookie: authCookie(result.response), registration };
  });

  await control({ action: "ACTIVATE_TEAM", teamId });
  await control({ action: "SET_VOTING", status: "OPEN" });
  const votes = await batches(authenticated, async ({ cookie }) => ok("/api/votes", { method: "POST", headers: { cookie, origin: baseUrl, "content-type": "application/json" }, body: JSON.stringify({ eventId }) }));
  const voteDurations = votes.map((item) => item.duration);

  const duplicate = await Promise.all([1, 2].map(() => ok("/api/votes", { method: "POST", headers: { cookie: authenticated[0].cookie, origin: baseUrl, "content-type": "application/json" }, body: JSON.stringify({ eventId }) })));
  assert.equal(new Set(duplicate.map((item) => item.body.data.submissionId)).size, 1, "duplicate clicks must reconcile to one submission");

  for (const slot of ["1", "2", "3"]) {
    const workspace = await ok("/api/judging?view=workspace", { headers: { "x-rehearsal-judge": slot } });
    const scores = workspace.body.data.criteria.map((criterion) => ({ criterionId: criterion.id, score: criterion.maxScore }));
    await ok("/api/judging", { method: "PUT", headers: { "x-rehearsal-judge": slot, "content-type": "application/json" }, body: JSON.stringify({ eventId, teamId, scores }) });
    await ok("/api/judging", { method: "POST", headers: { "x-rehearsal-judge": slot, "content-type": "application/json" }, body: JSON.stringify({ eventId, teamId }) });
  }

  const snapshot = await ok("/api/event/snapshot");
  assert.equal(snapshot.body.data.voteCount, 120, "admin snapshot must show exactly 120 unique votes");
  assert.equal(snapshot.body.data.judgeProgress.filter((judge) => judge.completed === 1).length, 3, "all three judges must be submitted");
  console.log(JSON.stringify({ status: "PASS", runtime: "mock", audience: 120, departments: 6, perDepartment: 20, uniqueVotes: snapshot.body.data.voteCount, duplicateClickStoredOnce: true, judgesSubmitted: 3, latencyMs: { p50: Math.round(percentile(voteDurations, .5)), p95: Math.round(percentile(voteDurations, .95)), max: Math.round(Math.max(...voteDurations)) } }, null, 2));
} finally {
  await control({ action: "RESET_REHEARSAL" });
}
