import type { Team } from "../../../types/team.ts";
import { FINALIST_CANDIDATES } from "./finalistCandidates.ts";

export const TOTAL_TEAM_COUNT = 12;
export const STARTUP_TEAM_COUNT = 6;
export const BUSINESS_ANALYSIS_TEAM_COUNT = 6;

export function createEmptyTeamSlots(): Team[] {
  return Array.from({ length: TOTAL_TEAM_COUNT }, (_, index) => {
    const order = index + 1;
    const candidate = FINALIST_CANDIDATES[index];
    const remainingCategory = order <= STARTUP_TEAM_COUNT ? "STARTUP" : "BUSINESS_ANALYSIS";
    return {
      id: `TEAM-${String(order).padStart(2, "0")}`,
      name: candidate?.name ?? null,
      department: candidate?.department ?? null,
      advisorName: candidate?.advisorName ?? null,
      leaderName: candidate?.leaderName ?? null,
      memberNames: candidate?.memberNames ?? [],
      topic: candidate?.topic ?? null,
      promotionEnabled: Boolean(candidate),
      order,
      category: candidate?.category ?? remainingCategory,
      status: "READY",
      active: true,
    };
  });
}

export function teamDisplayName(team: Pick<Team, "name" | "order">) {
  return team.name?.trim() || `${String(team.order).padStart(2, "0")}번 팀 · 팀명 미등록`;
}

export function teamSlotCode(team: Pick<Team, "category" | "order">) {
  const categoryOrder = team.category === "STARTUP" ? team.order : team.order - STARTUP_TEAM_COUNT;
  return `${team.category === "STARTUP" ? "S" : "B"}${String(categoryOrder).padStart(2, "0")}`;
}
