import { isAmbiguousMutationFailure, retryRead } from "../../../lib/network/resilientFetch";
import type { JudgeWorkspace, JudgeWorkspaceScore } from "../../../types/judging";

type JudgeOperations = {
  readWorkspace: () => Promise<JudgeWorkspace>;
  saveDraft: () => Promise<JudgeWorkspace>;
  submit: () => Promise<JudgeWorkspace>;
};

class JudgeStateNotConfirmed extends Error {}

export class JudgeSubmissionConflict extends Error {
  readonly code = "JUDGE_SUBMISSION_CONFLICT";

  constructor() {
    super("서버에 이미 제출된 팀 또는 점수가 현재 입력값과 일치하지 않습니다. 관리자에게 확인해주세요.");
    this.name = "JudgeSubmissionConflict";
  }
}

export class JudgeSubmissionUnconfirmed extends Error {
  readonly code = "JUDGE_SUBMISSION_UNCONFIRMED";

  constructor() {
    super("최종 제출 여부를 서버에서 확인하지 못했습니다. 다시 제출하기 전에 서버 상태를 확인해주세요.");
    this.name = "JudgeSubmissionUnconfirmed";
  }
}

function scoresMatch(actual: JudgeWorkspaceScore[], expected: JudgeWorkspaceScore[]) {
  if (actual.length !== expected.length) return false;
  if (new Set(actual.map((score) => score.criterionId)).size !== actual.length) return false;
  if (new Set(expected.map((score) => score.criterionId)).size !== expected.length) return false;
  const actualById = new Map(actual.map((score) => [score.criterionId, score.score]));
  return expected.every((score) => actualById.get(score.criterionId) === score.score);
}

function workspaceMatches(workspace: JudgeWorkspace, teamId: string, scores: JudgeWorkspaceScore[]) {
  return workspace.activeTeamId === teamId
    && (workspace.status === "DRAFT" || workspace.status === "SUBMITTED")
    && scoresMatch(workspace.scores, scores);
}

function submittedWorkspaceMatches(workspace: JudgeWorkspace, teamId: string, scores: JudgeWorkspaceScore[]) {
  return workspace.status === "SUBMITTED" && workspaceMatches(workspace, teamId, scores);
}

function requireMatchingSubmittedWorkspace(workspace: JudgeWorkspace, teamId: string, scores: JudgeWorkspaceScore[]) {
  if (!submittedWorkspaceMatches(workspace, teamId, scores)) throw new JudgeSubmissionConflict();
  return workspace;
}

export async function saveJudgeDraftResilient(
  teamId: string,
  scores: JudgeWorkspaceScore[],
  operations: Pick<JudgeOperations, "readWorkspace" | "saveDraft">,
) {
  try {
    return { workspace: await operations.saveDraft(), recovered: false };
  } catch (error) {
    if (!isAmbiguousMutationFailure(error)) throw error;
    try {
      const workspace = await retryRead(async () => {
        const current = await operations.readWorkspace();
        if (!workspaceMatches(current, teamId, scores)) throw new JudgeStateNotConfirmed();
        return current;
      });
      return { workspace, recovered: true };
    } catch {
      throw error;
    }
  }
}

export async function submitJudgeResilient(
  teamId: string,
  scores: JudgeWorkspaceScore[],
  operations: JudgeOperations,
) {
  const before = await retryRead(operations.readWorkspace);
  if (before.status === "SUBMITTED") {
    return { workspace: requireMatchingSubmittedWorkspace(before, teamId, scores), recovered: true };
  }

  const saved = await saveJudgeDraftResilient(teamId, scores, operations);
  if (saved.workspace.status === "SUBMITTED") {
    return { workspace: requireMatchingSubmittedWorkspace(saved.workspace, teamId, scores), recovered: true };
  }

  try {
    const submitted = await operations.submit();
    return {
      workspace: requireMatchingSubmittedWorkspace(submitted, teamId, scores),
      recovered: saved.recovered,
    };
  } catch (error) {
    if (error instanceof JudgeSubmissionConflict) throw error;
    if (!isAmbiguousMutationFailure(error)) throw error;
    try {
      const workspace = await retryRead(async () => {
        const current = await operations.readWorkspace();
        if (current.status !== "SUBMITTED") throw new JudgeStateNotConfirmed();
        return requireMatchingSubmittedWorkspace(current, teamId, scores);
      }, { shouldRetry: (readError) => !(readError instanceof JudgeSubmissionConflict) });
      return { workspace, recovered: true };
    } catch (verificationError) {
      if (verificationError instanceof JudgeSubmissionConflict) throw verificationError;
      throw new JudgeSubmissionUnconfirmed();
    }
  }
}
