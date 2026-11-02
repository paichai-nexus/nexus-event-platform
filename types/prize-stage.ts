export type PrizeDrawStage = "SECOND" | "THIRD";
export type PrizeStageSnapshot = { stage: PrizeDrawStage; label: string; eligibleCount: number; lockedAt: string | null; locked: boolean };
