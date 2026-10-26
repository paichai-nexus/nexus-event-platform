import type { AudienceAttendanceState } from "@/types/attendance";

export interface AttendanceRepository {
  getStatus(sessionToken: string, eventId?: string): Promise<AudienceAttendanceState>;
  enter(sessionToken: string, eventId?: string): Promise<AudienceAttendanceState>;
  exit(sessionToken: string, eventId?: string): Promise<AudienceAttendanceState>;
}
