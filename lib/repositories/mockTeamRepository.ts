import "server-only";

import { createEmptyTeamSlots } from "@/features/event/data/teamSlots";
import { finalistProfileForName } from "@/features/event/data/finalistCandidates";
import { DomainError } from "@/lib/errors/domainError";
import type { TeamRepository } from "@/lib/repositories/teamRepository";
import type { Team, TeamUpdate } from "@/types/team";

const MOCK_EVENT_ID = "00000000-0000-4000-8000-000000000100";
const globalForTeams = globalThis as typeof globalThis & { __eventTeams?: Team[] };

function teams() {
  globalForTeams.__eventTeams ??= createEmptyTeamSlots();
  return globalForTeams.__eventTeams;
}

export function resetMockTeams() {
  globalForTeams.__eventTeams = createEmptyTeamSlots();
}

export function activateMockTeam(teamId: string) {
  const target = teams().find((team) => team.id === teamId && team.active && team.name);
  if (!target) throw new DomainError("NOT_FOUND", "활성 발표팀을 찾을 수 없습니다.", 404);
  for (const team of teams()) {
    if (team.id === teamId) team.status = "PRESENTING";
    else if (team.status === "PRESENTING") team.status = "READY";
  }
}

export function completeMockTeam(teamId: string) {
  const target = teams().find((team) => team.id === teamId && team.status === "PRESENTING");
  if (!target) throw new DomainError("INVALID_STATE", "현재 발표 중인 팀이 아닙니다.", 409);
  target.status = "DONE";
}

export class MockTeamRepository implements TeamRepository {
  async getTeams(eventId: string) {
    if (eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
    return structuredClone(teams());
  }

  async updateTeam(update: TeamUpdate) {
    if (update.eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
    const index = teams().findIndex((team) => team.id === update.id);
    if (index < 0) throw new DomainError("NOT_FOUND", "참가팀 슬롯을 찾을 수 없습니다.", 404);
    if (teams().some((team, teamIndex) => teamIndex !== index && team.order === update.order)) {
      throw new DomainError("DUPLICATE", "이미 사용 중인 발표 순서입니다.", 409);
    }
    const name = update.name?.trim() || null;
    const profile = finalistProfileForName(name);
    teams()[index] = {
      ...teams()[index],
      ...update,
      name,
      leaderName: profile?.leaderName ?? null,
      memberNames: profile?.memberNames ?? [],
      topic: profile?.topic ?? null,
      promotionEnabled: Boolean(profile),
    };
    return structuredClone(teams()[index]);
  }
}
