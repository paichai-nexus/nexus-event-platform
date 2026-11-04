import { describe, it, expect } from "vitest";
import { summarizeScoringDiagnostics } from "../features/scoring/lib/scoringDiagnostics";

const input = () => ({
  teams: [{ id: "t1", name: "Team 1" }],
  criteria: [{ id: "c1", max_score: 200, weight: 1 }],
  assignments: [{ team_id: "t1", judge_user_id: "j1" }, { team_id: "t1", judge_user_id: "j2" }],
  submissions: [{ id: "s1", team_id: "t1", judge_user_id: "j1", status: "SUBMITTED" }, { id: "s2", team_id: "t1", judge_user_id: "j2", status: "SUBMITTED" }],
  scores: [{ submission_id: "s1", criterion_id: "c1", score: 200 }, { submission_id: "s2", criterion_id: "c1", score: 100 }],
  votes: [{ team_id: "t1", vote_count: 17, eligibility_count: 50 }],
  paperScores: [
    { team_id: "t1", judge_slot: 1, total_score: 180, status: "SUBMITTED" },
    { team_id: "t1", judge_slot: 2, total_score: 170, status: "SUBMITTED" },
    { team_id: "t1", judge_slot: 3, total_score: 160, status: "SUBMITTED" },
  ],
});
describe("P0-C scoring diagnostic contract", () => {
  it("normalizes complete submitted judge scores only for diagnostics", () => {
    const report = summarizeScoringDiagnostics(input());
    expect(report.teams[0].judgeScorePreview100).toBe(75);
    expect(report.teams[0].audienceVoteCount).toBe(17);
    expect(report.teams[0].professionalRawScore600).toBe(510);
    expect(report.teams[0].operationalCombinedRaw).toBe(527);
  });
  it("does not combine an incomplete paper judging set", () => {
    const data = input(); data.paperScores[2].status = "DRAFT";
    const team = summarizeScoringDiagnostics(data).teams[0];
    expect(team.professionalRawScore600).toBeNull();
    expect(team.operationalCombinedRaw).toBeNull();
  });
  it("does not declare official results ready", () => {
    const report = summarizeScoringDiagnostics(input());
    expect(report.status).toBe("POLICY_APPROVAL_REQUIRED");
    expect(report.officialScoresAvailable).toBe(false);
    expect(report.reasons).toEqual(expect.arrayContaining([
      "70:30 vs 80:20 policy conflict",
      "Audience vote-to-score conversion not approved",
      "Tie resolution not approved",
    ]));
  });
  it("blocks preview if any assignment lacks a submitted score", () => {
    const data = input(); data.submissions[1].status = "DRAFT";
    expect(summarizeScoringDiagnostics(data).teams[0].judgeScorePreview100).toBeNull();
  });
  it("blocks preview if a submitted score is absent", () => {
    const data = input(); data.scores.pop();
    expect(summarizeScoringDiagnostics(data).teams[0].judgeScorePreview100).toBeNull();
  });
  it("blocks preview if criteria are missing", () => {
    const data = input(); data.criteria = [];
    expect(summarizeScoringDiagnostics(data).teams[0].judgeScorePreview100).toBeNull();
  });
  it("does not mutate source records", () => {
    const data = input(); const before = JSON.stringify(data);
    summarizeScoringDiagnostics(data);
    expect(JSON.stringify(data)).toBe(before);
  });
});
