import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DomainError } from "@/lib/errors/domainError";
import type { AudienceBallotState, AudienceRankSubmission } from "@/types/audience-ballot";
import type { AudienceJuryRegistration } from "@/types/audience-jury";
import type { TeamCategory } from "@/types/team";

type AuthResult = Pick<AudienceJuryRegistration, "department" | "name" | "studentNumber" | "serialNumber" | "acceptedAt">;

function client() {
  const selected = createSupabaseAdminClient();
  if (!selected) throw new DomainError("DATABASE_ERROR", "Supabase 서버 연결이 구성되지 않았습니다.", 503);
  return selected;
}

function translate(message: string): DomainError {
  if (message.includes("AUDIENCE_JURY_AUTH_FAILED") || message.includes("AUDIENCE_JURY_AUTH_REQUIRED")) {
    return new DomainError("UNAUTHORIZED", "등록된 이름, 학번 또는 시리얼 번호가 일치하지 않습니다.", 401);
  }
  if (message.includes("EVENT_NOT_FOUND")) return new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
  if (message.includes("VOTING_CLOSED") || message.includes("CATEGORY_NOT_OPEN")) {
    return new DomainError("VOTING_CLOSED", "현재 해당 부문의 청중평가 시간이 아닙니다.", 409);
  }
  if (message.includes("DUPLICATE_TEAM_SELECTION")) {
    return new DomainError("VALIDATION_ERROR", "1등과 2등은 서로 다른 팀을 선택해야 합니다.", 422);
  }
  if (message.includes("INVALID_TEAM_SELECTION")) {
    return new DomainError("VALIDATION_ERROR", "현재 부문의 유효한 참가팀만 선택할 수 있습니다.", 422);
  }
  if (message.includes("ALREADY_SUBMITTED")) {
    return new DomainError("ALREADY_SUBMITTED", "이미 해당 부문 평가를 제출했습니다.", 409);
  }
  return new DomainError("DATABASE_ERROR", "청중평가 데이터를 처리하지 못했습니다.", 503);
}

export async function authenticateSupabaseAudienceJury(
  input: { name: string; studentNumber: string; serialNumber: string },
  authToken: string,
  eventId?: string,
) {
  const { data, error } = await client().rpc("authenticate_audience_jury", {
    p_event_id: eventId ?? null,
    p_name: input.name.trim(),
    p_student_number: input.studentNumber.trim().toUpperCase(),
    p_pcu_code: input.serialNumber.trim().toUpperCase(),
    p_auth_token: authToken,
  });
  if (error) throw translate(error.message);
  return data as AuthResult;
}

export async function getSupabaseAudienceBallotState(authToken: string, eventId?: string) {
  const { data, error } = await client().rpc("get_audience_rank_ballot_state", {
    p_event_id: eventId ?? null,
    p_auth_token: authToken,
  });
  if (error) throw translate(error.message);
  return data as AudienceBallotState & { registration: AuthResult };
}

export async function verifySupabaseAudienceJuryAuth(authToken: string, eventId?: string) {
  const state = await getSupabaseAudienceBallotState(authToken, eventId);
  return state.registration;
}

export async function submitSupabaseAudienceBallot(input: {
  eventId?: string;
  authToken: string;
  category: TeamCategory;
  firstTeamId: string;
  secondTeamId: string;
}) {
  const { data, error } = await client().rpc("submit_audience_rank_ballot", {
    p_event_id: input.eventId ?? null,
    p_auth_token: input.authToken,
    p_category: input.category,
    p_first_team_id: input.firstTeamId,
    p_second_team_id: input.secondTeamId,
  });
  if (error) throw translate(error.message);
  return data as AudienceRankSubmission;
}
