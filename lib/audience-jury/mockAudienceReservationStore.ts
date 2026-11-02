import { DomainError } from "@/lib/errors/domainError";
import type { AudienceJuryDepartment } from "@/types/audience-jury";
import type { AudienceReservation, AudienceReservationSummary } from "@/types/audience-reservation";

const DEFAULT_EVENT_ID = "00000000-0000-4000-8000-000000000100";
type StoredReservation = AudienceReservation & { eventId: string };
const reservationGlobal = globalThis as typeof globalThis & { __mockAudienceReservations?: StoredReservation[] };

function reservations() {
  reservationGlobal.__mockAudienceReservations ??= [];
  return reservationGlobal.__mockAudienceReservations;
}

function eventIdOrDefault(eventId?: string) {
  return eventId ?? DEFAULT_EVENT_ID;
}

function normalizeStudentNumber(value: string) {
  return value.trim().toUpperCase();
}

function summary(rows: AudienceReservation[]): AudienceReservationSummary {
  return {
    total: rows.length,
    signed: rows.filter((row) => row.paperSignedAt).length,
    qrCheckedIn: rows.filter((row) => row.qrCheckedInAt).length,
    juryAccepted: rows.filter((row) => row.pcuCode).length,
  };
}

export function resetMockAudienceReservations() {
  reservationGlobal.__mockAudienceReservations = [];
}

export function getMockAudienceReservations(eventId?: string) {
  const selectedEventId = eventIdOrDefault(eventId);
  const rows = reservations().filter((row) => row.eventId === selectedEventId)
    .sort((left, right) => left.reservedAt.localeCompare(right.reservedAt))
    .map((stored) => {
      const row: AudienceReservation = {
        id: stored.id,
        department: stored.department,
        name: stored.name,
        studentNumber: stored.studentNumber,
        reservedAt: stored.reservedAt,
        paperSignedAt: stored.paperSignedAt,
        qrCheckedInAt: stored.qrCheckedInAt,
        pcuCode: stored.pcuCode,
      };
      return structuredClone(row);
    });
  return { rows, summary: summary(rows) };
}

export function importMockAudienceReservations(
  inputs: Array<{ department: AudienceJuryDepartment; name: string; studentNumber: string }>,
  eventId?: string,
) {
  const selectedEventId = eventIdOrDefault(eventId);
  const existing = reservations().filter((row) => row.eventId === selectedEventId);
  const seen = new Set(existing.map((row) => row.studentNumber));
  let imported = 0;
  let duplicates = 0;
  inputs.forEach((input) => {
    const studentNumber = normalizeStudentNumber(input.studentNumber);
    if (seen.has(studentNumber)) {
      duplicates += 1;
      return;
    }
    seen.add(studentNumber);
    reservations().push({
      id: crypto.randomUUID(),
      eventId: selectedEventId,
      department: input.department,
      name: input.name.trim(),
      studentNumber,
      reservedAt: new Date(Date.now() + imported).toISOString(),
      paperSignedAt: null,
      qrCheckedInAt: null,
      pcuCode: null,
    });
    imported += 1;
  });
  return { ...getMockAudienceReservations(selectedEventId), imported, duplicates };
}

export function setMockAudiencePaperSigned(id: string, signed: boolean, eventId?: string) {
  const selectedEventId = eventIdOrDefault(eventId);
  const row = reservations().find((item) => item.eventId === selectedEventId && item.id === id);
  if (!row) throw new DomainError("NOT_FOUND", "예약자를 찾을 수 없습니다.", 404);
  if (!signed && row.qrCheckedInAt) {
    throw new DomainError("INVALID_STATE", "QR 출석이 완료된 예약자는 서명을 취소할 수 없습니다.", 409);
  }
  row.paperSignedAt = signed ? new Date().toISOString() : null;
  if (!signed) row.pcuCode = null;
  return getMockAudienceReservations(selectedEventId);
}

export function verifyAndRecordMockReservationQr(
  input: { department: AudienceJuryDepartment; name: string; studentNumber: string },
  eventId?: string,
) {
  const selectedEventId = eventIdOrDefault(eventId);
  const eventRows = reservations().filter((row) => row.eventId === selectedEventId);
  if (eventRows.length === 0) return null;
  const studentNumber = normalizeStudentNumber(input.studentNumber);
  const row = eventRows.find((item) => item.studentNumber === studentNumber
    && item.name === input.name.trim()
    && item.department === input.department);
  if (!row) throw new DomainError("UNAUTHORIZED", "예약 명단의 이름·학과·학번과 일치하지 않습니다.", 401);
  if (!row.paperSignedAt) throw new DomainError("FORBIDDEN", "종이 참석표 서명 확인이 필요합니다. 운영진에게 문의해주세요.", 403);
  row.qrCheckedInAt ??= new Date().toISOString();
  return structuredClone(row);
}

export function attachMockReservationPcuCode(studentNumber: string, pcuCode: string, eventId?: string) {
  const selectedEventId = eventIdOrDefault(eventId);
  const normalized = normalizeStudentNumber(studentNumber);
  const row = reservations().find((item) => item.eventId === selectedEventId && item.studentNumber === normalized);
  if (row) row.pcuCode = pcuCode;
}
