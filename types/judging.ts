export type JudgeProgress = {
  id: string;
  completed: number;
  total: number;
};

export type JudgeScore = {
  judgeId: string;
  teamId: string;
  criterionId: string;
  score: number;
  submitted: boolean;
};

export type JudgeCriterion = {
  id: string;
  name: string;
  maxScore: number;
  order: number;
};

export type JudgeWorkspaceScore = {
  criterionId: string;
  score: number;
};

export type JudgeWorkspace = {
  eventId: string;
  activeTeamId: string | null;
  assignedTeamIds: string[];
  criteria: JudgeCriterion[];
  submissionId: string | null;
  status: "DRAFT" | "SUBMITTED" | "NOT_STARTED";
  scores: JudgeWorkspaceScore[];
  submittedAt: string | null;
};
