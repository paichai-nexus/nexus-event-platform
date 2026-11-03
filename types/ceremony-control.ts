export const CEREMONY_PHASES = ["FIRST_DRAW", "AUDIENCE_CANDIDATES", "SECOND_DRAW", "JUDGE_REVIEW", "RESULTS", "BEST_REVIEWER", "THIRD_DRAW", "COMPLETE"] as const;
export type CeremonyPhase = typeof CEREMONY_PHASES[number];
export type CeremonyControlState = { eventId: string; phase: CeremonyPhase; phaseIndex: number; updatedAt: string | null };
