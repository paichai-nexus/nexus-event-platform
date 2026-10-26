import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { PrizeCatalogRepository } from "@/lib/repositories/prizeCatalogRepository";
import type { PrizeDefinition, PrizeDefinitionUpdate } from "@/types/prize";

const MOCK_EVENT_ID = "00000000-0000-4000-8000-000000000100";
const globalForCatalog = globalThis as typeof globalThis & { __prizeCatalog?: PrizeDefinition[] };

function emptyCatalog(): PrizeDefinition[] {
  return Array.from({ length: 11 }, (_, index) => ({
    id: `PRIZE-${index + 2}`,
    rank: index + 2,
    name: null,
    imageUrl: null,
    quantity: null,
    winnerCount: null,
    status: "UNCONFIRMED",
    drawStatus: "READY",
  }));
}

function catalog() {
  globalForCatalog.__prizeCatalog ??= emptyCatalog();
  return globalForCatalog.__prizeCatalog;
}

export function resetMockPrizeCatalog() {
  globalForCatalog.__prizeCatalog = emptyCatalog();
}

export class MockPrizeCatalogRepository implements PrizeCatalogRepository {
  async getCatalog(eventId: string) {
    if (eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
    return structuredClone(catalog());
  }

  async updatePrize(update: PrizeDefinitionUpdate) {
    if (update.eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
    const index = catalog().findIndex((prize) => prize.id === update.id && prize.rank === update.rank);
    if (index < 0) throw new DomainError("NOT_FOUND", "경품 슬롯을 찾을 수 없습니다.", 404);
    catalog()[index] = {
      ...update,
      name: update.name?.trim() || null,
      imageUrl: update.imageUrl?.trim() || null,
    };
    return structuredClone(catalog()[index]);
  }
}
