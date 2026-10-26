export type ScoreInput = {
  teamId: string;
  teamName: string;
  professional: number;
  audience: number;
};

export type ScoreRow = ScoreInput & {
  finalScore: number;
  rank: number;
  tied: boolean;
};
