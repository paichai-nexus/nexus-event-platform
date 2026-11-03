import { createHash } from "node:crypto";
import { DomainError } from "@/lib/errors/domainError";
import type { AudienceJuryDepartment } from "@/types/audience-jury";
import type { EventPart, PartAttendanceRecord, PartAttendanceSnapshot } from "@/types/part-attendance";

const DEFAULT_EVENT_ID = "00000000-0000-4000-8000-000000000100";
type StoreGlobal = typeof globalThis & { __mockPartAttendance?: PartAttendanceRecord[] };
const storeGlobal = globalThis as StoreGlobal;

function records() {
  return storeGlobal.__mockPartAttendance ??= [];
}

function normalizeStudentNumber(value: string) {
  return value.trim().toUpperCase();
}

function participantCode(studentNumber: string) {
  return `ENT-${createHash("sha256").update(studentNumber).digest("hex").slice(0, 8).toUpperCase()}`;
}

const departmentStarts: Record<AudienceJuryDepartment, number> = {
  "경영학과": 101,
  "IT경영정보학과": 121,
  "관광경영학과": 141,
  "항공서비스학과": 161,
  "글로벌비즈니스학과": 181,
  "호텔항공경영학과": 201,
};

export function resetMockPartAttendance() {
  storeGlobal.__mockPartAttendance = [];
}

export function submitMockPartAttendance(input: {
  eventId?: string;
  part: EventPart;
  department: AudienceJuryDepartment;
  studentNumber: string;
  name: string;
}) {
  const eventId = input.eventId ?? DEFAULT_EVENT_ID;
  const studentNumber = normalizeStudentNumber(input.studentNumber);
  const name = input.name.trim();
  const existingIdentity = records().find((row) => row.eventId === eventId && row.studentNumber === studentNumber);
  if (existingIdentity && (existingIdentity.name !== name || existingIdentity.department !== input.department)) {
    throw new DomainError("INVALID_STATE", "같은 학번으로 등록된 이름 또는 학과가 일치하지 않습니다. 운영진에게 문의해주세요.", 409);
  }
  const existingPart = records().find((row) => row.eventId === eventId && row.studentNumber === studentNumber && row.part === input.part);
  if (existingPart) return { record: structuredClone(existingPart), duplicate: true };

  const record: PartAttendanceRecord = {
    id: crypto.randomUUID(),
    eventId,
    participantCode: participantCode(studentNumber),
    part: input.part,
    department: input.department,
    studentNumber,
    name,
    submittedAt: new Date().toISOString(),
    jurySerialNumber: null,
    juryCapacityReached: false,
  };
  if (input.part === 1) {
    const accepted = records().filter((row) => row.eventId === eventId && row.part === 1 && row.department === input.department && row.jurySerialNumber).length;
    record.juryCapacityReached = accepted >= 20;
    if (!record.juryCapacityReached) record.jurySerialNumber = `PCU-${String(departmentStarts[input.department] + accepted).padStart(3, "0")}`;
  }
  records().push(record);
  return { record: structuredClone(record), duplicate: false };
}

export function getMockPartAttendanceSnapshot(eventId = DEFAULT_EVENT_ID): PartAttendanceSnapshot {
  const rows = records().filter((row) => row.eventId === eventId);
  const partOne = new Set(rows.filter((row) => row.part === 1).map((row) => row.studentNumber));
  const partTwo = new Set(rows.filter((row) => row.part === 2).map((row) => row.studentNumber));
  const unique = new Set(rows.map((row) => row.studentNumber));
  return {
    partOneCount: partOne.size,
    partTwoCount: partTwo.size,
    bothCount: [...partOne].filter((studentNumber) => partTwo.has(studentNumber)).length,
    uniqueCount: unique.size,
    latest: rows.slice().sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)).slice(0, 10).map(({ part, department, participantCode, submittedAt }) => ({ part, department, participantCode, submittedAt })),
  };
}

export function getMockPartAttendancePool(eventId = DEFAULT_EVENT_ID, part: EventPart) {
  const rows = records().filter((row) => row.eventId === eventId);
  return [...new Map(rows.filter((row) => row.part === part).map((row) => [row.studentNumber, row])).values()]
    .map((row) => row.participantCode)
    .sort();
}

export function getMockPartAttendanceIdentity(eventId: string, participantCodeValue: string) {
  const row = records().find((candidate) => candidate.eventId === eventId && candidate.participantCode === participantCodeValue);
  return row ? structuredClone(row) : null;
}

export function getMockPartAttendanceDrawPool(eventId = DEFAULT_EVENT_ID) {
  const partOne = new Set(getMockPartAttendancePool(eventId, 1));
  return getMockPartAttendancePool(eventId, 2).filter((code) => partOne.has(code));
}
