import type { TeamCategory } from "@/types/team";

export type AudienceBallotTeamAggregate = {
  teamId: string;
  teamName: string;
  order: number;
  category: TeamCategory;
  firstVotes: number;
  secondVotes: number;
};

export type AudienceBallotCategoryAggregate = {
  category: TeamCategory;
  submittedBallots: number;
  teams: AudienceBallotTeamAggregate[];
};

export type AudienceBallotAggregate = {
  acceptedJuryCount: number;
  categories: AudienceBallotCategoryAggregate[];
  updatedAt: string;
  officialScoresAvailable: false;
};
