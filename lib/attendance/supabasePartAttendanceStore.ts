import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AudienceJuryDepartment } from "@/types/audience-jury";
import type { EventPart, PartAttendanceRecord, PartAttendanceSnapshot } from "@/types/part-attendance";

const DEFAULT_EVENT_ID = "00000000-0000-4000-8000-000000000100";

async function client() {
  const value = await createSupabaseServerClient();
  if (!value) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  return value;
}

function mapSnapshot(value: Record<string, unknown>): PartAttendanceSnapshot {
  return {
    partOneCount: Number(value.part_one_count ?? 0),
    partTwoCount: Number(value.part_two_count ?? 0),
    bothCount: Number(value.both_count ?? 0),
    uniqueCount: Number(value.unique_count ?? 0),
    latest: Array.isArray(value.latest) ? value.latest.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        part: Number(item.part) as EventPart,
        department: String(item.department) as AudienceJuryDepartment,
        participantCode: String(item.participant_code),
        submittedAt: String(item.submitted_at),
      };
    }) : [],
  };
}

export async function getSupabasePartAttendanceSnapshot(eventId = DEFAULT_EVENT_ID) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("get_part_attendance_snapshot", { p_event_id: eventId });
  if (error || !data) throw new DomainError("DATABASE_ERROR", "출석 현황을 조회하지 못했습니다.", 503);
  return mapSnapshot(data as Record<string, unknown>);
}

export async function submitSupabasePartAttendance(input: {
  eventId?: string;
  part: EventPart;
  department: AudienceJuryDepartment;
  studentNumber: string;
  name: string;
}) {
  const supabase = await client();
  const eventId = input.eventId ?? DEFAULT_EVENT_ID;
  const { data, error } = await supabase.rpc("submit_part_attendance", {
    p_event_id: eventId,
    p_part: input.part,
    p_department: input.department,
    p_student_number: input.studentNumber,
    p_name: input.name,
  });
  if (error || !data) {
    if (error?.message.includes("ATTENDANCE_IDENTITY_MISMATCH")) throw new DomainError("INVALID_STATE", "같은 학번으로 등록된 이름 또는 학과가 일치하지 않습니다. 운영진에게 문의해주세요.", 409);
    throw new DomainError("DATABASE_ERROR", "출석을 저장하지 못했습니다.", 503);
  }
  const value = data as Record<string, unknown>;
  const record: PartAttendanceRecord = {
    id: String(value.id), eventId, participantCode: String(value.participant_code), part: Number(value.part) as EventPart,
    department: String(value.department) as AudienceJuryDepartment, studentNumber: input.studentNumber.trim().toUpperCase(),
    name: input.name.trim(), submittedAt: String(value.submitted_at),
  };
  return { record, duplicate: Boolean(value.duplicate), snapshot: await getSupabasePartAttendanceSnapshot(eventId) };
}
