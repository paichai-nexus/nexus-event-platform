import "server-only";
import { randomInt } from "node:crypto";

import { MOCK_PARTICIPANT_IDS } from "@/features/event/data/mockParticipants";
import { DomainError } from "@/lib/errors/domainError";
import type { PrizeRepository } from "@/lib/repositories/prizeRepository";
import type { PrizeRecord } from "@/types/prize";

const MOCK_EVENT_ID = "00000000-0000-4000-8000-000000000100";
const globalForPrizes = globalThis as typeof globalThis & { __prizeHistory?: PrizeRecord[] };

function history() {
  globalForPrizes.__prizeHistory ??= [];
  return globalForPrizes.__prizeHistory;
}

export function resetMockPrizes() {
  globalForPrizes.__prizeHistory = [];
}

export class MockPrizeRepository implements PrizeRepository {
  async getHistory(eventId: string) {
    if (eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
    return structuredClone(history());
  }

  async draw(eventId: string) {
    if (eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
    const records = history();
    const eligible = MOCK_PARTICIPANT_IDS.filter((id) => !records.some((record) => record.participantId === id));
    const participantId = eligible.length ? eligible[randomInt(eligible.length)] : null;
    if (!participantId) throw new DomainError("NOT_FOUND", "추첨 가능한 참가자가 없습니다.", 409);
    const record = { round: records.length + 1, participantId, drawnAt: new Date().toISOString() };
    records.push(record);
    return structuredClone(record);
  }
}
