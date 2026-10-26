import "server-only";

import type { AttendanceRepository } from "@/lib/repositories/attendanceRepository";
import {
  enterMockAudienceAttendance,
  exitMockAudienceAttendance,
  getMockAudienceAttendance,
} from "@/lib/repositories/mockCheckInRepository";

export class MockAttendanceRepository implements AttendanceRepository {
  async getStatus(sessionToken: string) {
    return getMockAudienceAttendance(sessionToken);
  }

  async enter(sessionToken: string) {
    return enterMockAudienceAttendance(sessionToken);
  }

  async exit(sessionToken: string) {
    return exitMockAudienceAttendance(sessionToken);
  }
}
