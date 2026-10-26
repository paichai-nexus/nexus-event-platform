import "server-only";
import { DomainError } from "@/lib/errors/domainError";
import type { PromoVideoRepository } from "@/lib/repositories/promoVideoRepository";
import type { PromoVideo, PromoVideoInput } from "@/types/promo";
const MOCK_EVENT_ID = "00000000-0000-4000-8000-000000000100";
const globalForPromo = globalThis as typeof globalThis & { __promoVideo?: PromoVideo | null };
export class MockPromoVideoRepository implements PromoVideoRepository {
  async get(eventId?: string) { if (eventId && eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404); return structuredClone(globalForPromo.__promoVideo ?? null); }
  async save(eventId: string, input: PromoVideoInput) { if (eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404); globalForPromo.__promoVideo = { id: globalForPromo.__promoVideo?.id ?? crypto.randomUUID(), ...input }; return structuredClone(globalForPromo.__promoVideo); }
}
