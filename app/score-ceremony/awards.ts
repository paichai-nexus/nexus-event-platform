import type { CeremonyTeam } from "./scoreMath";
import { scoreAtStep } from "./scoreMath";

export const AWARD_BY_RANK = ["대상", "최우수상", "우수상", "우수상", "챌린지상", "챌린지상"] as const;
export function categoryFinalRanking(teams: CeremonyTeam[]) {
  const ordered = [...teams].sort((a, b) => scoreAtStep(b, 3) - scoreAtStep(a, 3));
  const hasTie = ordered.some((team, index) => index > 0 && scoreAtStep(team, 3) === scoreAtStep(ordered[index - 1], 3));
  return {
    hasTie,
    ranked: ordered.map((team, index) => ({ team, rank: index + 1, award: AWARD_BY_RANK[index] ?? "규정 확인" })),
  };
}
