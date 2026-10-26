import type { CheckInRecord } from "@/types/check-in";

export type CheckInCommand = {
  eventId?: string;
  participantCode: string;
  checkedInBy: string;
  source: "QR" | "MANUAL";
};

export type CheckInOutcome =
  | { status: "SUCCESS"; participantId: string; participantCode: string; checkedInAt: string }
  | { status: "ALREADY_CHECKED_IN"; participantId: string; participantCode: string; checkedInAt: string }
  | { status: "NOT_FOUND" }
  | { status: "INACTIVE"; participantId: string; participantCode: string }
  | { status: "INVALID_EVENT" }
  | { status: "ERROR" };

export type CheckInSnapshot = {
  eventId: string;
  registeredCount: number;
  checkInCount: number;
  checkIns: CheckInRecord[];
};

export interface CheckInRepository {
  checkIn(command: CheckInCommand): Promise<CheckInOutcome>;
  getSnapshot(eventId?: string): Promise<CheckInSnapshot>;
}
