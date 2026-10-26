export type VotingStatus = "READY" | "OPEN" | "CLOSED";

export type AudienceSubmission = {
  teamId: string;
  participantId: string;
  submittedAt: string;
};

export type AudienceVoteState = {
  eligible: boolean;
  votingStatus: VotingStatus;
  teamId: string | null;
  submissionId: string | null;
  submittedAt: string | null;
};

export type AudienceVoteTeamCount = {
  teamId: string;
  voteCount: number;
  eligibilityCount: number;
};

export type AudienceVoteSnapshot = {
  totalVotes: number;
  teams: AudienceVoteTeamCount[];
};
