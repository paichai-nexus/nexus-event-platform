export type ScoringPolicyStatus = "DRAFT" | "APPROVED";

export type ScoringPolicyGovernance = {
  id: string | null;
  eventId: string;
  version: string;
  professionalWeight: number;
  audienceWeight: number;
  judgeCount: number;
  professionalMaxPerJudge: number;
  audienceConversionRule: string;
  tieBreakRule: string;
  categoryAggregationRule: string;
  status: ScoringPolicyStatus;
  approvedAt: string | null;
  updatedAt: string;
};

export type ScoringPolicyDraftInput = Pick<
  ScoringPolicyGovernance,
  | "version"
  | "professionalWeight"
  | "audienceWeight"
  | "judgeCount"
  | "professionalMaxPerJudge"
  | "audienceConversionRule"
  | "tieBreakRule"
  | "categoryAggregationRule"
>;
