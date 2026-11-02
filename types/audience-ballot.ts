import type { TeamCategory } from "@/types/team";

export type AudienceRankSubmission = {
  category: TeamCategory;
  firstTeamId: string;
  secondTeamId: string;
  submittedAt: string;
};

export type AudienceBallotTeam = {
  id: string;
  name: string;
  order: number;
  category: TeamCategory;
};

export type AudienceBallotState = {
  openCategory: TeamCategory | null;
  votingStatus: "READY" | "OPEN" | "CLOSED";
  teams: AudienceBallotTeam[];
  submissions: AudienceRankSubmission[];
};
