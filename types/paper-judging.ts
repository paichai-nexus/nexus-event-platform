export type PaperJudgeScore = {
  id: string;
  eventId: string;
  teamId: string;
  judgeSlot: 1 | 2 | 3;
  documentScore: number;
  presentationScore: number;
  qnaScore: number;
  totalScore: number;
  status: "DRAFT" | "SUBMITTED";
  updatedAt: string;
  submittedAt: string | null;
};

export type PaperJudgeScoreInput = Pick<PaperJudgeScore, "eventId" | "teamId" | "judgeSlot" | "documentScore" | "presentationScore" | "qnaScore" | "status">;
