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
};

export type PrizeItemDraw = {
  drawId: string;
  prizeItemId: string;
  prizeName: string;
  pool: PrizeEligibilityPool;
  round: number;
  participantCode: string;
  drawnAt: string;
};
