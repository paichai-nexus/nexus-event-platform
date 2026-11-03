import { DomainError } from "@/lib/errors/domainError";
import { attachMockReservationPcuCode, verifyAndRecordMockReservationQr } from "@/lib/audience-jury/mockAudienceReservationStore";
import {
  AUDIENCE_JURY_DEPARTMENTS,
  AUDIENCE_JURY_PCU_RANGES,
  formatAudienceJuryPcuCode,
  type AudienceJuryDepartment,
  type AudienceJuryRegistration,
  type AudienceJuryState,
} from "@/types/audience-jury";

const CAPACITY_PER_DEPARTMENT = 20;
const DEFAULT_EVENT_ID = "00000000-0000-4000-8000-000000000100";
const PARTICIPANT_CODE_PATTERN = /^PCU-(?:00[1-9]|0[1-9][0-9]|1[01][0-9]|120)$/;

type StoredRegistration = AudienceJuryRegistration & { eventId: string; sessionToken: string };
type JuryGlobal = typeof globalThis & { __mockAudienceJury?: StoredRegistration[] };
const juryGlobal = globalThis as JuryGlobal;

function registrations() {
  juryGlobal.__mockAudienceJury ??= [];
  const eventIds = new Set(juryGlobal.__mockAudienceJury.map((registration) => registration.eventId));
  eventIds.forEach((eventId) => {
    const eventRegistrations = juryGlobal.__mockAudienceJury!
      .filter((registration) => registration.eventId === eventId)
      .sort((left, right) => left.acceptedAt.localeCompare(right.acceptedAt));
    const codes = eventRegistrations.map((registration) => registration.serialNumber);
    const needsMigration = codes.some((code) => !PARTICIPANT_CODE_PATTERN.test(code ?? "")) || new Set(codes).size !== codes.length;
    if (needsMigration) {
      eventRegistrations.forEach((registration, index) => {
        const departmentPosition = eventRegistrations
          .slice(0, index + 1)
          .filter((item) => item.department === registration.department).length;
        registration.serialNumber = participantCode(registration.department, departmentPosition);
      });
    }
  });
  return juryGlobal.__mockAudienceJury;
}

function participantCode(department: AudienceJuryDepartment, position: number) {
  if (!Number.isInteger(position) || position < 1 || position > CAPACITY_PER_DEPARTMENT) {
    throw new DomainError("INVALID_STATE", "청중평가단 참가자 코드를 더 이상 발급할 수 없습니다.", 409);
  }
  const range = AUDIENCE_JURY_PCU_RANGES[department];
  return formatAudienceJuryPcuCode(range.start + position - 1);
}

function normalizeSerialNumber(value: string) {
  return value.trim().toUpperCase();
}

function normalizedEventId(eventId?: string) {
  return eventId ?? DEFAULT_EVENT_ID;
}

export function resetMockAudienceJury() {
  juryGlobal.__mockAudienceJury = [];
}

export function getMockAudienceJuryRegistration(sessionToken: string, eventId?: string) {
  const selectedEventId = normalizedEventId(eventId);
  return registrations().find((item) => item.eventId === selectedEventId && item.sessionToken === sessionToken) ?? null;
}

export function getMockAudienceJuryState(sessionToken: string, eventId?: string): AudienceJuryState {
  const selectedEventId = normalizedEventId(eventId);
  const eventRegistrations = registrations().filter((item) => item.eventId === selectedEventId);
  return {
    registration: getMockAudienceJuryRegistration(sessionToken, selectedEventId),
    departments: AUDIENCE_JURY_DEPARTMENTS.map((department) => {
      const accepted = eventRegistrations.filter((item) => item.department === department).length;
      const range = AUDIENCE_JURY_PCU_RANGES[department];
      return {
        department,
        accepted,
        remaining: CAPACITY_PER_DEPARTMENT - accepted,
        capacity: CAPACITY_PER_DEPARTMENT,
        pcuStart: formatAudienceJuryPcuCode(range.start),
        pcuEnd: formatAudienceJuryPcuCode(range.end),
      };
    }),
    totalAccepted: eventRegistrations.length,
    totalCapacity: AUDIENCE_JURY_DEPARTMENTS.length * CAPACITY_PER_DEPARTMENT,
  };
}

export function registerMockAudienceJury(
  sessionToken: string,
  input: { department: AudienceJuryDepartment; name: string; studentNumber: string },
  eventId?: string,
) {
  const selectedEventId = normalizedEventId(eventId);
  const existingSession = getMockAudienceJuryRegistration(sessionToken, selectedEventId);
  if (existingSession) return getMockAudienceJuryState(sessionToken, selectedEventId);

  const normalizedStudentNumber = input.studentNumber.trim().toUpperCase();
  if (registrations().some((item) => item.eventId === selectedEventId && item.studentNumber === normalizedStudentNumber)) {
    throw new DomainError("DUPLICATE", "이미 청중평가단으로 등록된 학번입니다.", 409);
  }
  const accepted = registrations().filter((item) => item.eventId === selectedEventId && item.department === input.department).length;
  verifyAndRecordMockReservationQr(input, selectedEventId);
  if (accepted >= CAPACITY_PER_DEPARTMENT) {
    throw new DomainError("INVALID_STATE", `${input.department} 청중평가단 20명이 마감되었습니다.`, 409);
  }

  const serialNumber = participantCode(input.department, accepted + 1);
  registrations().push({
    eventId: selectedEventId,
    sessionToken,
    department: input.department,
    name: input.name.trim(),
    studentNumber: normalizedStudentNumber,
    position: accepted + 1,
    serialNumber,
    capacity: CAPACITY_PER_DEPARTMENT,
    acceptedAt: new Date().toISOString(),
  });
  attachMockReservationPcuCode(normalizedStudentNumber, serialNumber, selectedEventId);
  return getMockAudienceJuryState(sessionToken, selectedEventId);
}

export function authenticateMockAudienceJury(input: { name: string; studentNumber: string; serialNumber: string }, eventId?: string) {
  const selectedEventId = normalizedEventId(eventId);
  const normalizedStudentNumber = input.studentNumber.trim().toUpperCase();
  const normalizedName = input.name.trim();
  const registration = registrations().find((item) =>
    item.eventId === selectedEventId
    && item.studentNumber === normalizedStudentNumber
    && item.name === normalizedName
    && item.serialNumber === normalizeSerialNumber(input.serialNumber)
  );
  if (!registration) throw new DomainError("UNAUTHORIZED", "등록된 이름, 학번 또는 시리얼 번호가 일치하지 않습니다.", 401);
  registration.sessionToken = crypto.randomUUID();
  return { token: registration.sessionToken, registration: getMockAudienceJuryState(registration.sessionToken, selectedEventId).registration };
}

export function verifyMockAudienceJuryAuth(authToken: string, eventId?: string) {
  return getMockAudienceJuryRegistration(authToken, eventId);
}

export function getMockAudienceJuryDrawPool(eventId?: string) {
  const selectedEventId = normalizedEventId(eventId);
  return registrations()
    .filter((registration) => registration.eventId === selectedEventId)
    .map((registration) => ({
      participantCode: registration.serialNumber,
      department: registration.department,
      departmentPosition: registration.position,
    }))
    .sort((left, right) => left.participantCode.localeCompare(right.participantCode));
}
