export const PRIZE_DRAW_STAGES = ["FIRST", "SECOND", "THIRD"] as const;
export type PrizeDrawStage = typeof PRIZE_DRAW_STAGES[number];
export type PrizeStageSnapshot = { stage: PrizeDrawStage; label: string; eligibleCount: number; lockedAt: string | null; locked: boolean };
