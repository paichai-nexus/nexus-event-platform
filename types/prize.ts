export type PrizeRecord = {
  round: number;
  participantId: string;
  drawnAt: string;
};

export type PrizeDefinitionStatus = "UNCONFIRMED" | "CONFIRMED";
export type PrizeDrawStatus = "READY" | "IN_PROGRESS" | "COMPLETED";

export type PrizeDefinition = {
  id: string;
  rank: number;
  name: string | null;
  imageUrl: string | null;
  quantity: number | null;
  winnerCount: number | null;
  status: PrizeDefinitionStatus;
  drawStatus: PrizeDrawStatus;
};

export type PrizeDefinitionUpdate = PrizeDefinition & { eventId: string };
