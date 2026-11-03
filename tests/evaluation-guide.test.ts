import { describe, expect, it } from "vitest";
import { DOCUMENT_CRITERIA, PRESENTATION_CRITERIA, QNA_CRITERIA, SCORING_SUMMARY } from "@/features/scoring/data/evaluationGuide";
import { CEREMONY_RUN_OF_SHOW } from "@/features/event/data/eventGuide";

const total = (items: Array<{ points: number }>) => items.reduce((sum, item) => sum + item.points, 0);

describe("evaluation guide integrity", () => {
  it("keeps each professional judge rubric at 200 points", () => {
    expect(total(DOCUMENT_CRITERIA)).toBe(50);
    expect(total(PRESENTATION_CRITERIA.STARTUP)).toBe(100);
    expect(total(PRESENTATION_CRITERIA.BUSINESS_ANALYSIS)).toBe(100);
    expect(total(QNA_CRITERIA)).toBe(50);
  });

  it("keeps the supplied raw numbers visible without treating them as an approved 70:30 formula", () => {
    expect(SCORING_SUMMARY.judgeCount * SCORING_SUMMARY.pointsPerJudge).toBe(600);
    expect(SCORING_SUMMARY.audienceCount * SCORING_SUMMARY.audiencePointsPerPerson).toBe(240);
    expect(SCORING_SUMMARY.judgeRawMaximum + SCORING_SUMMARY.audienceRawMaximum).toBe(840);
    expect(SCORING_SUMMARY.judgeRawMaximum / SCORING_SUMMARY.statedRawTotal).not.toBeCloseTo(0.7, 4);
    expect(SCORING_SUMMARY.policyStatus).toBe("POLICY_APPROVAL_REQUIRED");
  });

  it("keeps the confirmed audience vote, draw, result reveal, and ceremony order", () => {
    expect(CEREMONY_RUN_OF_SHOW.map((item) => item.order)).toEqual([11, 12, 14, 15, 16]);
    expect(CEREMONY_RUN_OF_SHOW[0].detail).toContain("커피 쿠폰 15명");
    expect(CEREMONY_RUN_OF_SHOW[1].detail).toContain("1위 후보 2팀");
    expect(CEREMONY_RUN_OF_SHOW[2].detail).toContain("올리브영 2만원 6명");
    expect(CEREMONY_RUN_OF_SHOW[4].detail).toContain("에어팟 1명");
  });
});
