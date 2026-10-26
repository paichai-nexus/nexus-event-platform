import type { PrizeDefinition, PrizeDefinitionUpdate } from "@/types/prize";

export interface PrizeCatalogRepository {
  getCatalog(eventId: string): Promise<PrizeDefinition[]>;
  updatePrize(update: PrizeDefinitionUpdate): Promise<PrizeDefinition>;
}
