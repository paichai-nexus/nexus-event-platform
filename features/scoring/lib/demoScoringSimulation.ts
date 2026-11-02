export type DemoScoringInput = {
  teamId: string;
  teamName: string;
  judgeScores: [number, number, number];
  audienceVotes: number;
};

export type DemoScoringRow = DemoScoringInput & {
  judgeTotal: number;
  judgeAverage: number;
  professionalScore100: number;
  audienceScore100: number;
  score8020: number;
  score7030: number;
};

export const DEMO_AUDIENCE_ELIGIBLE_COUNT = 12;

export const DEMO_SCORING_INPUTS: DemoScoringInput[] = [
  { teamId: "DEMO-01", teamName: "EVER OASIS", judgeScores: [174, 180, 177], audienceVotes: 10 },
  { teamId: "DEMO-02", teamName: "밋턴", judgeScores: [185, 182, 179], audienceVotes: 8 },
  { teamId: "DEMO-03", teamName: "시너지", judgeScores: [168, 172, 170], audienceVotes: 6 },
];

function round(value: number) {
  return Number(value.toFixed(2));
}

export function calculateDemoScoring(inputs: DemoScoringInput[]): DemoScoringRow[] {
  const highestVoteCount = Math.max(0, ...inputs.map((input) => input.audienceVotes));
  return inputs.map((input) => {
    const judgeTotal = input.judgeScores.reduce((sum, score) => sum + score, 0);
    const judgeAverage = judgeTotal / input.judgeScores.length;
    const professionalScore100 = judgeAverage / 2;
    const audienceScore100 = highestVoteCount ? input.audienceVotes / highestVoteCount * 100 : 0;
    return {
      ...input,
      judgeTotal,
      judgeAverage: round(judgeAverage),
      professionalScore100: round(professionalScore100),
      audienceScore100: round(audienceScore100),
      score8020: round(professionalScore100 * 0.8 + audienceScore100 * 0.2),
      score7030: round(professionalScore100 * 0.7 + audienceScore100 * 0.3),
    };
  });
}
