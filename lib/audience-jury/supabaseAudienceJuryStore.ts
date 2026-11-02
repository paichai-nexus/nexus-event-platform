import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DomainError } from "@/lib/errors/domainError";
import type { AudienceJuryDepartment, AudienceJuryState } from "@/types/audience-jury";
import type { AudienceReservation, AudienceReservationSummary } from "@/types/audience-reservation";

type ReservationRow = {
  id: string;
  department: AudienceJuryDepartment;
  student_number: string;
  attendee_name: string;
  reserved_at: string;
  paper_signed_at: string | null;
  qr_checked_in_at: string | null;
  pcu_code: string | null;
};

type JuryStateRow = {
  registration: AudienceJuryState["registration"];
  departments: AudienceJuryState["departments"];
  total_accepted: number;
  total_capacity: number;
};

function mapReservation(row: ReservationRow): AudienceReservation {
  return {
    id: row.id,
    department: row.department,
    studentNumber: row.student_number,
    name: row.attendee_name,
    reservedAt: row.reserved_at,
    paperSignedAt: row.paper_signed_at,
    qrCheckedInAt: row.qr_checked_in_at,
    pcuCode: row.pcu_code,
  };
}

function summarize(rows: AudienceReservation[]): AudienceReservationSummary {
  return {
    total: rows.length,
    signed: rows.filter((row) => row.paperSignedAt).length,
    qrCheckedIn: rows.filter((row) => row.qrCheckedInAt).length,
    juryAccepted: rows.filter((row) => row.pcuCode).length,
  };
}

async function requireStaffClient() {
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 연결이 구성되지 않았습니다.", 503);
  return client;
}

function requireAdminClient() {
  const client = createSupabaseAdminClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 서버 연결이 구성되지 않았습니다.", 503);
  return client;
}

async function resolveEventId(client: SupabaseClient, eventId?: string) {
  if (eventId) return eventId;
  const { data, error } = await client.from("events").select("id").order("starts_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new DomainError("DATABASE_ERROR", "행사 정보를 조회하지 못했습니다.", 503);
  if (!data?.id) throw new DomainError("NOT_FOUND", "등록된 행사가 없습니다.", 404);
  return data.id as string;
}

async function listWithClient(client: SupabaseClient, eventId: string) {
  const { data, error } = await client
    .from("audience_jury_reservations")
    .select("id, department, student_number, attendee_name, reserved_at, paper_signed_at, qr_checked_in_at, pcu_code")
    .eq("event_id", eventId)
    .order("reserved_at", { ascending: true });
  if (error) throw new DomainError("DATABASE_ERROR", "청중평가단 예약 명단을 조회하지 못했습니다.", 503);
  const rows = (data as ReservationRow[]).map(mapReservation);
  return { rows, summary: summarize(rows) };
}

export async function getSupabaseAudienceReservations(eventId?: string) {
  const client = await requireStaffClient();
  const selectedEventId = await resolveEventId(client, eventId);
  return listWithClient(client, selectedEventId);
}

export async function importSupabaseAudienceReservations(
  inputs: Array<{ department: AudienceJuryDepartment; name: string; studentNumber: string }>,
  eventId?: string,
) {
  const client = await requireStaffClient();
  const selectedEventId = await resolveEventId(client, eventId);
  const studentNumbers = inputs.map((input) => input.studentNumber.trim().toUpperCase());
  const { data: existing, error: existingError } = await client
    .from("audience_jury_reservations")
    .select("student_number")
    .eq("event_id", selectedEventId)
    .in("student_number", studentNumbers);
  if (existingError) throw new DomainError("DATABASE_ERROR", "기존 예약자 중복 여부를 확인하지 못했습니다.", 503);
  const seen = new Set((existing ?? []).map((row) => row.student_number as string));
  const additions: Array<{ event_id: string; department: AudienceJuryDepartment; attendee_name: string; student_number: string }> = [];
  let duplicates = 0;
  inputs.forEach((input) => {
    const studentNumber = input.studentNumber.trim().toUpperCase();
    if (seen.has(studentNumber)) { duplicates += 1; return; }
    seen.add(studentNumber);
    additions.push({ event_id: selectedEventId, department: input.department, attendee_name: input.name.trim(), student_number: studentNumber });
  });
  if (additions.length) {
    const { error } = await client.from("audience_jury_reservations").insert(additions);
    if (error) throw new DomainError("DATABASE_ERROR", "예약자 명단을 저장하지 못했습니다.", 503);
  }
  return { ...(await listWithClient(client, selectedEventId)), imported: additions.length, duplicates };
}

export async function setSupabaseAudiencePaperSigned(id: string, signed: boolean, eventId?: string) {
  const client = await requireStaffClient();
  const selectedEventId = await resolveEventId(client, eventId);
  const { data: existing, error: readError } = await client
    .from("audience_jury_reservations")
    .select("qr_checked_in_at")
    .eq("event_id", selectedEventId)
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new DomainError("DATABASE_ERROR", "예약자 상태를 확인하지 못했습니다.", 503);
  if (!existing) throw new DomainError("NOT_FOUND", "예약자를 찾을 수 없습니다.", 404);
  if (!signed && existing.qr_checked_in_at) throw new DomainError("INVALID_STATE", "QR 출석이 완료된 예약자는 서명을 취소할 수 없습니다.", 409);
  const { error } = await client
    .from("audience_jury_reservations")
    .update({ paper_signed_at: signed ? new Date().toISOString() : null })
    .eq("event_id", selectedEventId)
    .eq("id", id);
  if (error) throw new DomainError("DATABASE_ERROR", "서명 상태를 저장하지 못했습니다.", 503);
  return listWithClient(client, selectedEventId);
}

function mapState(data: JuryStateRow[] | null): AudienceJuryState {
  const row = data?.[0];
  if (!row) throw new DomainError("DATABASE_ERROR", "청중평가단 상태를 조회하지 못했습니다.", 503);
  return {
    registration: row.registration ?? null,
    departments: row.departments ?? [],
    totalAccepted: row.total_accepted,
    totalCapacity: row.total_capacity,
  };
}

function translateRegistrationError(message: string) {
  if (message.includes("RESERVATION_MISMATCH")) return new DomainError("UNAUTHORIZED", "예약 명단의 이름·학과·학번과 일치하지 않습니다.", 401);
  if (message.includes("PAPER_SIGNATURE_REQUIRED")) return new DomainError("FORBIDDEN", "종이 참석표 서명 확인이 필요합니다. 운영진에게 문의해주세요.", 403);
  if (message.includes("ALREADY_REGISTERED")) return new DomainError("DUPLICATE", "이미 다른 기기에서 등록된 학번입니다.", 409);
  if (message.includes("DEPARTMENT_CAPACITY_REACHED")) return new DomainError("INVALID_STATE", "해당 학과 청중평가단 20명이 마감되었습니다.", 409);
  return new DomainError("DATABASE_ERROR", "청중평가단 등록을 처리하지 못했습니다.", 503);
}

export async function getSupabaseAudienceJuryState(sessionToken: string, eventId?: string) {
  const client = requireAdminClient();
  const { data, error } = await client.rpc("get_audience_jury_state", { p_event_id: eventId ?? null, p_session_token: sessionToken });
  if (error) throw translateRegistrationError(error.message);
  return mapState(data as JuryStateRow[] | null);
}

export async function registerSupabaseAudienceJury(
  sessionToken: string,
  input: { department: AudienceJuryDepartment; name: string; studentNumber: string },
  eventId?: string,
) {
  const client = requireAdminClient();
  const { data, error } = await client.rpc("register_audience_jury", {
    p_event_id: eventId ?? null,
    p_session_token: sessionToken,
    p_department: input.department,
    p_name: input.name.trim(),
    p_student_number: input.studentNumber.trim().toUpperCase(),
  });
  if (error) throw translateRegistrationError(error.message);
  return mapState(data as JuryStateRow[] | null);
}
