import type { AudienceJuryDepartment } from "@/types/audience-jury";

export type EventPart = 1 | 2;

export type PartAttendanceRecord = {
  id: string;
  eventId: string;
  participantCode: string;
  part: EventPart;
  department: AudienceJuryDepartment;
  studentNumber: string;
  name: string;
  submittedAt: string;
};

export type PartAttendanceSnapshot = {
  partOneCount: number;
  partTwoCount: number;
  bothCount: number;
  uniqueCount: number;
  latest: Array<Pick<PartAttendanceRecord, "part" | "department" | "participantCode" | "submittedAt">>;
};
