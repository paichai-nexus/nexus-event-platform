import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type {
  CheckInCommand,
  CheckInOutcome,
  CheckInRepository,
  CheckInSnapshot,
} from "@/lib/repositories/checkInRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RpcCheckInRow = {
  status: CheckInOutcome["status"];
  participant_id: string | null;
  participant_code: string | null;
  checked_in_at: string | null;
};

export class SupabaseCheckInRepository implements CheckInRepository {
  async checkIn(command: CheckInCommand): Promise<CheckInOutcome> {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);

    const { data, error } = await supabase.rpc("perform_check_in", {
      p_event_id: command.eventId ?? null,
      p_participant_code: command.participantCode,
      p_checked_in_by: command.checkedInBy,
      p_source: command.source,
    });

    if (error) throw new DomainError("DATABASE_ERROR", "입장 정보를 저장하지 못했습니다.", 500);
    const row = (Array.isArray(data) ? data[0] : data) as RpcCheckInRow | null;
    if (!row) return { status: "ERROR" };
    if (row.status === "NOT_FOUND" || row.status === "INVALID_EVENT" || row.status === "ERROR") {
      return { status: row.status };
    }
    if (row.status === "INACTIVE" && row.participant_id && row.participant_code) {
      return { status: "INACTIVE", participantId: row.participant_id, participantCode: row.participant_code };
    }
    if (
      (row.status === "SUCCESS" || row.status === "ALREADY_CHECKED_IN") &&
      row.participant_id &&
      row.participant_code &&
      row.checked_in_at
    ) {
      return {
        status: row.status,
        participantId: row.participant_id,
        participantCode: row.participant_code,
        checkedInAt: row.checked_in_at,
      };
    }
    return { status: "ERROR" };
  }

  async getSnapshot(eventId?: string): Promise<CheckInSnapshot> {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);

    let selectedEventId = eventId;
    if (!selectedEventId) {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id")
        .order("starts_at", { ascending: false })
        .limit(1)
        .single();
      if (eventError || !event) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
      selectedEventId = event.id;
    }
    if (!selectedEventId) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);

    const [participantsResult, countResult, recordsResult, audienceCountResult, audienceRecordsResult] = await Promise.all([
      supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", selectedEventId).eq("active", true),
      supabase.from("check_ins").select("id", { count: "exact", head: true }).eq("event_id", selectedEventId),
      supabase
        .from("check_ins")
        .select("checked_in_at, participants(participant_code)")
        .eq("event_id", selectedEventId)
        .order("checked_in_at", { ascending: false })
        .limit(50),
      supabase
        .from("audience_attendance_sessions")
        .select("id", { count: "exact", head: true })
        .eq("event_id", selectedEventId)
        .is("exited_at", null),
      supabase
        .from("audience_attendance_sessions")
        .select("participant_label, entered_at")
        .eq("event_id", selectedEventId)
        .is("exited_at", null)
        .order("entered_at", { ascending: false })
        .limit(50),
    ]);

    if (participantsResult.error || countResult.error || recordsResult.error || audienceCountResult.error || audienceRecordsResult.error) {
      throw new DomainError("DATABASE_ERROR", "입장 현황을 조회하지 못했습니다.", 500);
    }

    const staffCheckIns = (recordsResult.data ?? []).map((record) => {
      const participant = Array.isArray(record.participants) ? record.participants[0] : record.participants;
      return {
        participantId: participant?.participant_code ?? "UNKNOWN",
        time: record.checked_in_at,
      };
    });
    const audienceCheckIns = (audienceRecordsResult.data ?? []).map((record) => ({
      participantId: record.participant_label,
      time: record.entered_at,
    }));
    const checkIns = [...staffCheckIns, ...audienceCheckIns]
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 50);

    return {
      eventId: selectedEventId,
      registeredCount: participantsResult.count ?? 0,
      checkInCount: (countResult.count ?? 0) + (audienceCountResult.count ?? 0),
      checkIns,
    };
  }
}
