import type { JudgeProgress, JudgeWorkspace, JudgeWorkspaceScore } from "@/types/judging";

export interface JudgeRepository {
  getWorkspace(eventId: string, activeTeamId: string | null, judgeUserId: string): Promise<JudgeWorkspace>;
  saveDraft(eventId: string, teamId: string, scores: JudgeWorkspaceScore[]): Promise<JudgeWorkspace>;
  submit(eventId: string, teamId: string): Promise<JudgeWorkspace>;
  getProgress(eventId: string): Promise<JudgeProgress[]>;
  unlock(submissionId: string, reason: string): Promise<unknown>;
}
