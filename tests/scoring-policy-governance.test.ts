import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_POLICY_DRAFT, validateScoringPolicyDraft, validateScoringPolicyForApproval } from "@/features/scoring/lib/scoringPolicyGovernance";
import { SCORING_POLICY_READY } from "@/features/scoring/data/evaluationPolicy";

describe("scoring policy governance", () => {
  it("keeps official scoring locked even when governance workflow exists", () => {
    expect(SCORING_POLICY_READY).toBe(false);
  });

  it("accepts the documented 70/30 candidate as a draft", () => {
    expect(validateScoringPolicyDraft(DEFAULT_SCORING_POLICY_DRAFT)).toEqual([]);
  });

  it("does not approve a policy without conversion, tie, and category rules", () => {
    expect(validateScoringPolicyForApproval(DEFAULT_SCORING_POLICY_DRAFT)).toEqual(expect.arrayContaining([
      "청중평가 환산식을 확정해주세요.", "동점 처리 규칙을 확정해주세요.", "부문별 집계 규칙을 확정해주세요.",
    ]));
  });

  it("rejects weights whose sum is not 100", () => {
    expect(validateScoringPolicyDraft({ ...DEFAULT_SCORING_POLICY_DRAFT, professionalWeight: 80 })).toContain("전문심사와 청중평가 비율의 합은 100이어야 합니다.");
  });

  it("accepts an approval-complete policy without activating calculations", () => {
    const complete = { ...DEFAULT_SCORING_POLICY_DRAFT, audienceConversionRule: "승인된 환산식", tieBreakRule: "승인된 동점 규칙", categoryAggregationRule: "부문별 분리 집계" };
    expect(validateScoringPolicyForApproval(complete)).toEqual([]);
    expect(SCORING_POLICY_READY).toBe(false);
  });
});
