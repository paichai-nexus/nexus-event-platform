import type { PrizeRecord } from "@/types/prize";

export interface PrizeRepository {
  getHistory(eventId: string): Promise<PrizeRecord[]>;
  draw(eventId: string, actorUserId: string): Promise<PrizeRecord>;
}
