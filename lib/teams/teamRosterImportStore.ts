import "server-only";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError } from "@/lib/errors/domainError";
import { importMockTeamRoster } from "@/lib/repositories/mockTeamRepository";
import { getTeamRepository } from "@/lib/repositories/repositoryFactory";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TeamRosterImportRow } from "@/types/team-roster-import";

function validate(rows: TeamRosterImportRow[]) {
  if (rows.length !== 19 || new Set(rows.map((row) => row.order)).size !== 19 || new Set(rows.map((row) => row.name.toLowerCase())).size !== 19) throw new DomainError("VALIDATION_ERROR", "19팀의 발표순서와 팀명은 각각 고유해야 합니다.", 422);
  if (rows.filter((row) => row.category === "STARTUP").length !== 10 || rows.filter((row) => row.category === "BUSINESS_ANALYSIS").length !== 9) throw new DomainError("VALIDATION_ERROR", "부문 구성은 창업 10팀·기업분석 9팀이어야 합니다.", 422);
}
export async function importTeamRoster(eventId: string, rows: TeamRosterImportRow[]) {
  validate(rows);
  if (isMockRuntime()) return importMockTeamRoster(eventId, rows);
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { error } = await client.rpc("import_team_roster", { p_event_id: eventId, p_rows: rows });
  if (error) {
    if (error.message.includes("TEAM_ROSTER_INVALID")) throw new DomainError("VALIDATION_ERROR", "최종 팀 명단의 팀 수·부문·중복 항목을 확인해주세요.", 422);
    if (error.message.includes("EVENT_CLOSED")) throw new DomainError("EVENT_CLOSED", "결과 확정 이후에는 팀 명단을 변경할 수 없습니다.", 409);
    throw new DomainError("DATABASE_ERROR", "팀 명단을 일괄 저장하지 못했습니다.", 503);
  }
  return getTeamRepository().getTeams(eventId);
}
