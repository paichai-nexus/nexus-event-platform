import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { AttendanceRepository } from "@/lib/repositories/attendanceRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AudienceAttendanceState } from "@/types/attendance";

type AttendanceRpcRow = {
  known: boolean;
  active: boolean;
  participant_id: string;
  entered_at: string | null;
  active_count: number;
};

function toAttendanceState(data: unknown): AudienceAttendanceState {
  const row = (Array.isArray(data) ? data[0] : data) as AttendanceRpcRow | null;
  if (!row) throw new DomainError("DATABASE_ERROR", "입장 상태를 확인하지 못했습니다.", 500);
  return {
    known: row.known,
    active: row.active,
    participantId: row.participant_id,
    enteredAt: row.entered_at,
    activeCount: Number(row.active_count),
  };
}

export class SupabaseAttendanceRepository implements AttendanceRepository {
  private async execute(action: "get_audience_attendance" | "enter_audience_attendance" | "exit_audience_attendance", sessionToken: string, eventId?: string) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    const { data, error } = await supabase.rpc(action, {
      p_event_id: eventId ?? null,
      p_session_token: sessionToken,
    });
    if (error) throw new DomainError("DATABASE_ERROR", "현장 입장 상태를 저장하지 못했습니다.", 500);
    return toAttendanceState(data);
  }

  getStatus(sessionToken: string, eventId?: string) {
    return this.execute("get_audience_attendance", sessionToken, eventId);
  }

  enter(sessionToken: string, eventId?: string) {
    return this.execute("enter_audience_attendance", sessionToken, eventId);
  }

  exit(sessionToken: string, eventId?: string) {
    return this.execute("exit_audience_attendance", sessionToken, eventId);
  }
}
