import type { ScoringPolicyDraftInput } from "@/types/scoring-policy";

export const DEFAULT_SCORING_POLICY_DRAFT: ScoringPolicyDraftInput = {
  version: "2026-DRAFT",
  professionalWeight: 70,
  audienceWeight: 30,
  judgeCount: 3,
  professionalMaxPerJudge: 200,
  audienceConversionRule: "",
  tieBreakRule: "",
  categoryAggregationRule: "",
};

export function validateScoringPolicyDraft(input: ScoringPolicyDraftInput) {
  const errors: string[] = [];
  if (!input.version.trim()) errors.push("정책 버전을 입력해주세요.");
  if (!Number.isInteger(input.professionalWeight) || input.professionalWeight < 0 || input.professionalWeight > 100) errors.push("전문심사 비율은 0~100 사이 정수여야 합니다.");
  if (!Number.isInteger(input.audienceWeight) || input.audienceWeight < 0 || input.audienceWeight > 100) errors.push("청중평가 비율은 0~100 사이 정수여야 합니다.");
  if (input.professionalWeight + input.audienceWeight !== 100) errors.push("전문심사와 청중평가 비율의 합은 100이어야 합니다.");
  if (!Number.isInteger(input.judgeCount) || input.judgeCount <= 0) errors.push("심사위원 수는 양의 정수여야 합니다.");
  if (!Number.isInteger(input.professionalMaxPerJudge) || input.professionalMaxPerJudge <= 0) errors.push("심사위원 1인당 만점은 양의 정수여야 합니다.");
  return errors;
}

export function validateScoringPolicyForApproval(input: ScoringPolicyDraftInput) {
  const errors = validateScoringPolicyDraft(input);
  if (!input.audienceConversionRule.trim()) errors.push("청중평가 환산식을 확정해주세요.");
  if (!input.tieBreakRule.trim()) errors.push("동점 처리 규칙을 확정해주세요.");
  if (!input.categoryAggregationRule.trim()) errors.push("부문별 집계 규칙을 확정해주세요.");
  return errors;
}
