import type { ScoreInput, ScoreRow } from "@/types/scoring";

export const PROFESSIONAL_WEIGHT = 0.8;
export const AUDIENCE_WEIGHT = 0.2;

export type ScoringResult =
  | { status: "READY"; rows: ScoreRow[] }
  | { status: "SCORING_BLOCKED"; reason: string; rows: [] };

export function calculateFinalScore(professional: number, audience: number) {
  return Number((professional * PROFESSIONAL_WEIGHT + audience * AUDIENCE_WEIGHT).toFixed(1));
}

export function calculateScoreRows(inputs: ScoreInput[]): ScoreRow[] {
  const withTotals = inputs
    .map((input) => ({ ...input, finalScore: calculateFinalScore(input.professional, input.audience) }))
    .sort((a, b) => b.finalScore - a.finalScore);

  return withTotals.map((row, index, rows) => {
    const firstAtScore = rows.findIndex((candidate) => candidate.finalScore === row.finalScore);
    const tied = rows.filter((candidate) => candidate.finalScore === row.finalScore).length > 1;
    return { ...row, rank: firstAtScore + 1, tied };
  });
}

export function calculateScoringResult(inputs: ScoreInput[], criteriaConfigured: boolean): ScoringResult {
  if (!criteriaConfigured) {
    return {
      status: "SCORING_BLOCKED",
      reason: "평가기준이 확정되지 않아 최종 집계를 수행할 수 없습니다.",
      rows: [],
    };
  }
  return { status: "READY", rows: calculateScoreRows(inputs) };
}
