import { afterEach, describe, expect, it, vi } from "vitest";
import {
  JudgeSubmissionConflict,
  JudgeSubmissionUnconfirmed,
  submitJudgeResilient,
} from "../features/judging/lib/submissionResilience";
import { submitVoteResilient } from "../features/voting/lib/submitVoteResilient";
import { backoffDelay, requestJson, RequestFailure } from "../lib/network/resilientFetch";
import type { JudgeWorkspace, JudgeWorkspaceScore } from "../types/judging";
import type { AudienceVoteState } from "../types/voting";

const teamId = "team-1";
const voteState = (submissionId: string | null): AudienceVoteState => ({
  eligible: true,
  votingStatus: "OPEN",
  teamId,
  submissionId,
  submittedAt: submissionId ? "2026-11-04T06:00:00.000Z" : null,
});
const voteResult = (submissionId: string | null) => ({ data: voteState(submissionId), storage: "DATABASE" as const });

const scores: JudgeWorkspaceScore[] = [{ criterionId: "criterion-1", score: 80 }];
const workspace = (status: JudgeWorkspace["status"], currentScores = scores): JudgeWorkspace => ({
  eventId: "event-1",
  activeTeamId: teamId,
  assignedTeamIds: [teamId],
  criteria: [{ id: "criterion-1", name: "발표", maxScore: 100, order: 0 }],
  submissionId: status === "NOT_STARTED" ? null : "submission-1",
  status,
  scores: currentScores,
  submittedAt: status === "SUBMITTED" ? "2026-11-04T06:00:00.000Z" : null,
});

afterEach(() => vi.unstubAllGlobals());

describe("Phase 7C network primitives", () => {
  it("applies bounded exponential backoff with jitter", () => {
    expect(backoffDelay(0, 1_000, 3_000, () => 0)).toBe(750);
    expect(backoffDelay(1, 1_000, 3_000, () => 0.5)).toBe(2_000);
    expect(backoffDelay(5, 1_000, 3_000, () => 1)).toBe(3_000);
  });

  it("aborts a request after its timeout", async () => {
    vi.stubGlobal("fetch", vi.fn((_input, init: RequestInit | undefined) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    await expect(requestJson("/slow", {}, 5)).rejects.toMatchObject({ kind: "TIMEOUT" });
  });
});

describe("Phase 7C audience vote recovery", () => {
  it("recovers a stored vote after the POST response is lost without retrying POST", async () => {
    const submit = vi.fn().mockRejectedValue(new RequestFailure("lost", "NETWORK"));
    const readState = vi.fn().mockResolvedValue(voteResult("vote-1"));
    const result = await submitVoteResilient(teamId, { submit, readState });
    expect(result.recovered).toBe(true);
    expect(result.data.submissionId).toBe("vote-1");
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("treats ALREADY_SUBMITTED as success only after server-state confirmation", async () => {
    const result = await submitVoteResilient(teamId, {
      submit: vi.fn().mockRejectedValue(new RequestFailure("duplicate", "HTTP", 409, "ALREADY_SUBMITTED")),
      readState: vi.fn().mockResolvedValue(voteResult("vote-1")),
    });
    expect(result.recovered).toBe(true);
  });

  it("does not claim recovery for another team's submission", async () => {
    const original = new RequestFailure("lost", "TIMEOUT");
    await expect(submitVoteResilient(teamId, {
      submit: vi.fn().mockRejectedValue(original),
      readState: vi.fn().mockResolvedValue({ ...voteResult("vote-1"), data: { ...voteState("vote-1"), teamId: "team-2" } }),
    })).rejects.toBe(original);
  });
});

describe("Phase 7C judge submission recovery", () => {
  it("skips all mutations when the server already reports SUBMITTED", async () => {
    const saveDraft = vi.fn();
    const submit = vi.fn();
    const result = await submitJudgeResilient(teamId, scores, {
      readWorkspace: vi.fn().mockResolvedValue(workspace("SUBMITTED")),
      saveDraft,
      submit,
    });
    expect(result.recovered).toBe(true);
    expect(saveDraft).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects an existing SUBMITTED state when persisted scores differ", async () => {
    const saveDraft = vi.fn();
    const submit = vi.fn();
    await expect(submitJudgeResilient(teamId, scores, {
      readWorkspace: vi.fn().mockResolvedValue(workspace("SUBMITTED", [{ criterionId: "criterion-1", score: 10 }])),
      saveDraft,
      submit,
    })).rejects.toMatchObject({ code: "JUDGE_SUBMISSION_CONFLICT" });
    expect(saveDraft).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects an existing SUBMITTED state for a different team", async () => {
    const otherTeam = { ...workspace("SUBMITTED"), activeTeamId: "team-2" };
    await expect(submitJudgeResilient(teamId, scores, {
      readWorkspace: vi.fn().mockResolvedValue(otherTeam),
      saveDraft: vi.fn(),
      submit: vi.fn(),
    })).rejects.toBeInstanceOf(JudgeSubmissionConflict);
  });

  it("rejects duplicate criterion identifiers instead of collapsing them in a Map", async () => {
    const duplicateScores = [
      { criterionId: "criterion-1", score: 80 },
      { criterionId: "criterion-1", score: 80 },
    ];
    const duplicated = {
      ...workspace("SUBMITTED"),
      scores: duplicateScores,
      criteria: [
        { id: "criterion-1", name: "발표", maxScore: 100, order: 0 },
        { id: "criterion-1", name: "발표 중복", maxScore: 100, order: 1 },
      ],
    };
    await expect(submitJudgeResilient(teamId, duplicateScores, {
      readWorkspace: vi.fn().mockResolvedValue(duplicated),
      saveDraft: vi.fn(),
      submit: vi.fn(),
    })).rejects.toBeInstanceOf(JudgeSubmissionConflict);
  });

  it("recovers both a lost draft response and a lost final-submit response", async () => {
    const readWorkspace = vi.fn()
      .mockResolvedValueOnce(workspace("NOT_STARTED", []))
      .mockResolvedValueOnce(workspace("DRAFT"))
      .mockResolvedValueOnce(workspace("SUBMITTED"));
    const saveDraft = vi.fn().mockRejectedValue(new RequestFailure("draft response lost", "NETWORK"));
    const submit = vi.fn().mockRejectedValue(new RequestFailure("submit response lost", "TIMEOUT"));
    const result = await submitJudgeResilient(teamId, scores, { readWorkspace, saveDraft, submit });
    expect(result.workspace.status).toBe("SUBMITTED");
    expect(result.recovered).toBe(true);
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("rejects recovery when a lost final-submit response resolves to different persisted scores", async () => {
    const readWorkspace = vi.fn()
      .mockResolvedValueOnce(workspace("NOT_STARTED", []))
      .mockResolvedValueOnce(workspace("SUBMITTED", [{ criterionId: "criterion-1", score: 10 }]));
    await expect(submitJudgeResilient(teamId, scores, {
      readWorkspace,
      saveDraft: vi.fn().mockResolvedValue(workspace("DRAFT")),
      submit: vi.fn().mockRejectedValue(new RequestFailure("submit response lost", "TIMEOUT")),
    })).rejects.toBeInstanceOf(JudgeSubmissionConflict);
  });

  it("returns an unconfirmed state when the server cannot verify a lost final submission", async () => {
    const readWorkspace = vi.fn()
      .mockResolvedValueOnce(workspace("NOT_STARTED", []))
      .mockRejectedValue(new RequestFailure("offline", "NETWORK"));
    await expect(submitJudgeResilient(teamId, scores, {
      readWorkspace,
      saveDraft: vi.fn().mockResolvedValue(workspace("DRAFT")),
      submit: vi.fn().mockRejectedValue(new RequestFailure("submit response lost", "TIMEOUT")),
    })).rejects.toBeInstanceOf(JudgeSubmissionUnconfirmed);
  });

  it("does not accept a lost draft response when persisted scores differ", async () => {
    const original = new RequestFailure("draft response lost", "NETWORK");
    await expect(submitJudgeResilient(teamId, scores, {
      readWorkspace: vi.fn()
        .mockResolvedValueOnce(workspace("NOT_STARTED", []))
        .mockResolvedValue(workspace("DRAFT", [{ criterionId: "criterion-1", score: 10 }])),
      saveDraft: vi.fn().mockRejectedValue(original),
      submit: vi.fn(),
    })).rejects.toBe(original);
  });
});
