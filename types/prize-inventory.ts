export type PrizeEligibilityPool = "AUDIENCE_JURY" | "ALL_PARTICIPANTS";

export type PrizeInventoryItem = {
  id: string;
  pool: PrizeEligibilityPool;
  displayOrder: number;
  name: string;
  unitAmount: number;
  quantity: number;
  winnerCount: number;
  drawnCount: number;
  imageUrl: string | null;
  status: "UNCONFIRMED" | "CONFIRMED";
  drawStatus: "READY" | "IN_PROGRESS" | "COMPLETED";
  drawStage: import("@/types/prize-stage").PrizeDrawStage | null;
  awardOnly: boolean;
};

export type PrizeItemDraw = {
  drawId: string;
  prizeItemId: string;
  prizeName: string;
  pool: PrizeEligibilityPool;
  round: number;
  participantCode: string;
  department: string;
  maskedStudentNumber: string;
  maskedName: string;
  drawnAt: string;
};
