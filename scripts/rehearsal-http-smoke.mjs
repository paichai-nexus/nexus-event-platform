const baseUrl = process.env.REHEARSAL_BASE_URL ?? "http://127.0.0.1:3002";
const eventId = "00000000-0000-4000-8000-000000000100";
const teamId = "TEAM-01";
const keepDemoState = process.env.KEEP_REHEARSAL_STATE === "true";
const audienceCount = Number.parseInt(process.env.DEMO_AUDIENCE_COUNT ?? "1", 10);
const voteDelayMs = Number.parseInt(process.env.DEMO_VOTE_DELAY_MS ?? "0", 10);
const startDelayMs = Number.parseInt(process.env.DEMO_START_DELAY_MS ?? "0", 10);
const judgeDelayMs = Number.parseInt(process.env.DEMO_JUDGE_DELAY_MS ?? "0", 10);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

if (!Number.isInteger(audienceCount) || audienceCount < 1 || audienceCount > 300) {
  throw new Error("DEMO_AUDIENCE_COUNT must be an integer between 1 and 300");
}

async function json(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

async function control(body) {
  return json("/api/event/control", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, eventId }),
  });
}

async function reset() {
  await control({ action: "RESET_REHEARSAL" });
}

await reset();
try {
  await control({ action: "ACTIVATE_TEAM", teamId });
  await control({ action: "SET_VOTING", status: "OPEN" });

  const qr = await json("/api/attendance/entry-qr");
  const submitAudienceVote = async () => {
    const entry = await fetch(qr.data.entryUrl, { redirect: "manual" });
    if (entry.status !== 303) throw new Error(`QR entry redirect: expected 303, received ${entry.status}`);
    const cookie = entry.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie) throw new Error("QR entry did not issue an audience session cookie");

    const voteBefore = await json("/api/votes", { headers: { cookie } });
    if (!voteBefore.data.eligible) throw new Error("checked-in audience was not eligible");
    await json("/api/votes", {
      method: "POST",
      headers: { cookie, origin: baseUrl, "content-type": "application/json" },
      body: "{}",
    });
  };

  if (startDelayMs > 0) await delay(startDelayMs);
  if (voteDelayMs > 0) {
    for (let index = 0; index < audienceCount; index += 1) {
      await submitAudienceVote();
      await delay(voteDelayMs);
    }
  } else {
    for (let start = 0; start < audienceCount; start += 20) {
      await Promise.all(Array.from({ length: Math.min(20, audienceCount - start) }, submitAudienceVote));
    }
  }

  for (const slot of ["1", "2", "3"]) {
    if (judgeDelayMs > 0) await delay(judgeDelayMs);
    const judgeHeaders = { "x-rehearsal-judge": slot };
    const workspace = await json("/api/judging?view=workspace", { headers: judgeHeaders });
    const scores = workspace.data.criteria.map((criterion) => ({
      criterionId: criterion.id,
      score: criterion.maxScore,
    }));
    await json("/api/judging", {
      method: "PUT",
      headers: { ...judgeHeaders, "content-type": "application/json" },
      body: JSON.stringify({ eventId, teamId, scores }),
    });
    await json("/api/judging", {
      method: "POST",
      headers: { ...judgeHeaders, "content-type": "application/json" },
      body: JSON.stringify({ eventId, teamId }),
    });
  }

  const snapshot = await json("/api/event/snapshot");
  if (snapshot.data.checkInCount !== audienceCount) throw new Error(`expected ${audienceCount} check-ins, received ${snapshot.data.checkInCount}`);
  if (snapshot.data.voteCount !== audienceCount) throw new Error(`expected ${audienceCount} votes, received ${snapshot.data.voteCount}`);
  if (!snapshot.data.judgeProgress.every((judge) => judge.completed === 1 && judge.total === 1)) {
    throw new Error(`judge aggregation mismatch: ${JSON.stringify(snapshot.data.judgeProgress)}`);
  }
  console.log(`PASS: ${audienceCount} QR check-ins → ${audienceCount} audience votes → 3 judge submissions → admin snapshot aggregation`);
} finally {
  if (!keepDemoState) await reset();
}

if (keepDemoState) {
  const preserved = await json("/api/event/snapshot");
  console.log(`DEMO STATE PRESERVED: check-in ${preserved.data.checkInCount}, votes ${preserved.data.voteCount}, judges ${preserved.data.judgeProgress.filter((judge) => judge.completed === 1).length}/3`);
} else {
  const clean = await json("/api/event/snapshot");
  if (clean.data.checkInCount !== 0 || clean.data.voteCount !== 0 || clean.data.judgeProgress.some((judge) => judge.completed !== 0)) {
    throw new Error("rehearsal reset did not return all demo aggregates to zero");
  }
  console.log("PASS: rehearsal reset cleared check-in, vote, and judge demo data");
}
