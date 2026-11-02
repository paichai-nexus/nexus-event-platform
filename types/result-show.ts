export type ResultShowAward = { title: string; teamName: string; detail: string };
export type BestReviewer = { participantCode: string; name: string; department: string; reviewExcerpt: string };
export type ResultShowScene = "REVIEW" | "RESULT" | "BEST_REVIEWER";
export type ResultShowDeck = {
  eventId: string;
  judgeComment: string;
  awards: ResultShowAward[];
  bestReviewer: BestReviewer | null;
  status: "DRAFT" | "APPROVED";
  currentScene: ResultShowScene;
  approvedAt: string | null;
  updatedAt: string;
};
