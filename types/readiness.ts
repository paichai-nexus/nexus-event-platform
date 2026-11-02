export type ReadinessLevel = "PASS" | "WARN" | "BLOCK";
export type ReadinessCheck = { id: string; label: string; level: ReadinessLevel; detail: string; href?: string };
export type ReadinessInput = { runtimeMode: string; backendReady: boolean; snapshotReady: boolean; teamCount: number; completeTeamProfiles: number; reservationCount: number; signedCount: number; secondDrawLocked: boolean; thirdDrawLocked: boolean; resultShowApproved: boolean; bestReviewerReady: boolean; scoringPolicyDocumentApproved: boolean; scoringPolicyReady: boolean };
