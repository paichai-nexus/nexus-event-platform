import { describe, expect, it } from "vitest";
import { calculateDemoScoring, DEMO_SCORING_INPUTS } from "@/features/scoring/lib/demoScoringSimulation";

describe("traceable demo scoring simulation", () => {
  it("shows every intermediate value for both policy candidates", () => {
    expect(calculateDemoScoring(DEMO_SCORING_INPUTS)).toEqual([
      expect.objectContaining({ teamId: "DEMO-01", judgeTotal: 531, judgeAverage: 177, professionalScore100: 88.5, audienceScore100: 100, score8020: 90.8, score7030: 91.95 }),
      expect.objectContaining({ teamId: "DEMO-02", judgeTotal: 546, judgeAverage: 182, professionalScore100: 91, audienceScore100: 80, score8020: 88.8, score7030: 87.7 }),
      expect.objectContaining({ teamId: "DEMO-03", judgeTotal: 510, judgeAverage: 170, professionalScore100: 85, audienceScore100: 60, score8020: 80, score7030: 77.5 }),
    ]);
  });

  it("does not invent an audience score when every team has zero votes", () => {
    const rows = calculateDemoScoring(DEMO_SCORING_INPUTS.map((input) => ({ ...input, audienceVotes: 0 })));
    expect(rows.every((row) => row.audienceScore100 === 0)).toBe(true);
  });
});
