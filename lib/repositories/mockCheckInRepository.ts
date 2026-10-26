import "server-only";

import { normalizeParticipantId } from "@/features/event/lib/mockOperations";
import type {
  CheckInCommand,
  CheckInOutcome,
  CheckInRepository,
  CheckInSnapshot,
} from "@/lib/repositories/checkInRepository";

const MOCK_EVENT_ID = "00000000-0000-4000-8000-000000000100";

type MockCheckInStore = {
  records: Map<string, { participantId: string; checkedInAt: string }>;
  audienceRecords: Map<string, { participantId: string; checkedInAt: string; exitedAt: string | null }>;
  baseCount: number;
};

const globalForCheckIns = globalThis as typeof globalThis & { __eventCheckIns?: MockCheckInStore };

function getStore(): MockCheckInStore {
  if (!globalForCheckIns.__eventCheckIns) {
    globalForCheckIns.__eventCheckIns = {
      baseCount: 238,
      records: new Map([
        ["#0001", { participantId: "#0001", checkedInAt: new Date(Date.now() - 180_000).toISOString() }],
        ["#0002", { participantId: "#0002", checkedInAt: new Date(Date.now() - 120_000).toISOString() }],
        ["#0003", { participantId: "#0003", checkedInAt: new Date(Date.now() - 60_000).toISOString() }],
      ]),
      audienceRecords: new Map(),
    };
  }
  globalForCheckIns.__eventCheckIns.audienceRecords ??= new Map();
  for (const record of globalForCheckIns.__eventCheckIns.audienceRecords.values()) {
    record.exitedAt ??= null;
  }
  return globalForCheckIns.__eventCheckIns;
}

export function resetMockCheckIns() {
  globalForCheckIns.__eventCheckIns = { baseCount: 0, records: new Map(), audienceRecords: new Map() };
}

function audienceParticipantId(sessionToken: string) {
  return `AUD-${sessionToken.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export function getMockAudienceAttendance(sessionToken: string) {
  const store = getStore();
  const record = store.audienceRecords.get(sessionToken);
  const activeRecords = [...store.audienceRecords.values()].filter((item) => item.exitedAt === null);
  return {
    known: Boolean(record),
    active: Boolean(record && record.exitedAt === null),
    participantId: record?.participantId ?? audienceParticipantId(sessionToken),
    enteredAt: record?.exitedAt === null ? record.checkedInAt : null,
    activeCount: store.baseCount + store.records.size + activeRecords.length,
  };
}

export function enterMockAudienceAttendance(sessionToken: string) {
  const store = getStore();
  store.audienceRecords.set(sessionToken, {
    participantId: store.audienceRecords.get(sessionToken)?.participantId ?? audienceParticipantId(sessionToken),
    checkedInAt: new Date().toISOString(),
    exitedAt: null,
  });
  return getMockAudienceAttendance(sessionToken);
}

export function exitMockAudienceAttendance(sessionToken: string) {
  const record = getStore().audienceRecords.get(sessionToken);
  if (record) record.exitedAt = new Date().toISOString();
  return getMockAudienceAttendance(sessionToken);
}

function isKnownParticipant(code: string) {
  const numericCode = Number(code.slice(1));
  return Number.isInteger(numericCode) && numericCode >= 1 && numericCode <= 320;
}

export class MockCheckInRepository implements CheckInRepository {
  async checkIn(command: CheckInCommand): Promise<CheckInOutcome> {
    if (command.eventId && command.eventId !== MOCK_EVENT_ID) return { status: "INVALID_EVENT" };

    const participantCode = normalizeParticipantId(command.participantCode);
    if (!participantCode || !isKnownParticipant(participantCode)) return { status: "NOT_FOUND" };

    const store = getStore();
    const existing = store.records.get(participantCode);
    if (existing) {
      return {
        status: "ALREADY_CHECKED_IN",
        participantId: existing.participantId,
        participantCode,
        checkedInAt: existing.checkedInAt,
      };
    }

    const checkedInAt = new Date().toISOString();
    store.records.set(participantCode, { participantId: participantCode, checkedInAt });
    return { status: "SUCCESS", participantId: participantCode, participantCode, checkedInAt };
  }

  async getSnapshot(): Promise<CheckInSnapshot> {
    const store = getStore();
    const activeAudienceRecords = [...store.audienceRecords.values()].filter((record) => record.exitedAt === null);
    const checkIns = [...store.records.values(), ...activeAudienceRecords]
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
      .map((record) => ({ participantId: record.participantId, time: record.checkedInAt }));

    return {
      eventId: MOCK_EVENT_ID,
      registeredCount: 320,
      checkInCount: store.baseCount + store.records.size + activeAudienceRecords.length,
      checkIns,
    };
  }
}
