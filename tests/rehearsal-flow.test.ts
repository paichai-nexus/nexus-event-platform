import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { enterMockAudienceAttendance } from "@/lib/repositories/mockCheckInRepository";
import { MockEventControlRepository } from "@/lib/repositories/mockEventControlRepository";
import { MOCK_JUDGE_IDS, MockJudgeRepository } from "@/lib/repositories/mockJudgeRepository";
import { MockVoteRepository } from "@/lib/repositories/mockVoteRepository";
import { registerMockAudienceJury, resetMockAudienceJury } from "@/lib/audience-jury/mockAudienceJuryStore";
import { resetMockAudienceReservations } from "@/lib/audience-jury/mockAudienceReservationStore";

const EVENT_ID = "00000000-0000-4000-8000-000000000100";
const TEAM_ID = "TEAM-01";
const SESSION = "audience-rehearsal-session";
const SCORES = [
  { criterionId: "00000000-0000-4000-8000-000000000701", score: 8 },
  { criterionId: "00000000-0000-4000-8000-000000000702", score: 9 },
  { criterionId: "00000000-0000-4000-8000-000000000703", score: 10 },
];

describe("rehearsal audience and judge aggregation", () => {
  const events = new MockEventControlRepository();
  const votes = new MockVoteRepository();
  const judges = new MockJudgeRepository();

  beforeEach(async () => {
    await events.resetRehearsal(EVENT_ID);
    resetMockAudienceJury();
    resetMockAudienceReservations();
  });

  function registerAudienceJury() {
    registerMockAudienceJury(SESSION, {
      department: "경영학과",
      studentNumber: "20260001",
      name: "김학생",
    }, EVENT_ID);
  }

  it("requires an active QR attendance session before accepting a vote", async () => {
    await events.setActiveTeam(EVENT_ID, TEAM_ID);
    await events.setVotingStatus(EVENT_ID, "OPEN");

    await expect(votes.submit(EVENT_ID, SESSION)).rejects.toMatchObject({ code: "FORBIDDEN" });
    enterMockAudienceAttendance(SESSION);
    registerAudienceJury();

    const submitted = await votes.submit(EVENT_ID, SESSION);
    const snapshot = await votes.getSnapshot(EVENT_ID);
    expect(submitted.eligible).toBe(true);
    expect(submitted.submissionId).toBeTruthy();
    expect(snapshot).toEqual({
      totalVotes: 1,
      teams: [{ teamId: TEAM_ID, voteCount: 1, eligibilityCount: 1 }],
    });
  });

  it("tracks three rehearsal judges independently and clears all aggregates on reset", async () => {
    await events.setActiveTeam(EVENT_ID, TEAM_ID);
    await events.setVotingStatus(EVENT_ID, "OPEN");
    enterMockAudienceAttendance(SESSION);
    registerAudienceJury();
    await votes.submit(EVENT_ID, SESSION);

    for (const judgeId of MOCK_JUDGE_IDS) {
      await judges.saveDraft(EVENT_ID, TEAM_ID, SCORES, judgeId);
      await judges.submit(EVENT_ID, TEAM_ID, judgeId);
    }
    expect(await judges.getProgress()).toEqual([
      { id: "Judge 01", completed: 1, total: 1 },
      { id: "Judge 02", completed: 1, total: 1 },
      { id: "Judge 03", completed: 1, total: 1 },
    ]);

    await events.resetRehearsal(EVENT_ID);
    expect((await votes.getSnapshot(EVENT_ID)).totalVotes).toBe(0);
    expect(await judges.getProgress()).toEqual([
      { id: "Judge 01", completed: 0, total: 1 },
      { id: "Judge 02", completed: 0, total: 1 },
      { id: "Judge 03", completed: 0, total: 1 },
    ]);
  });
});
