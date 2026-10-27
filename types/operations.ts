import type { CheckInRecord, CheckInResult } from "@/types/check-in";
import type { DisplayMode, EventMode, EventStatus, NetworkState, ResultStatus } from "@/types/event";
import type { JudgeProgress } from "@/types/judging";
import type { PrizeDefinition, PrizeRecord } from "@/types/prize";
import type { ScoreInput } from "@/types/scoring";
import type { Team } from "@/types/team";
import type { VotingStatus } from "@/types/voting";
import type { AudienceVoteTeamCount } from "@/types/voting";
import type { RuntimeMode } from "@/lib/config/runtimePolicy";

export type Activity = {
  id: string;
  time: string;
  category: string;
  message: string;
};

export type EventOpsState = {
  runtimeMode: RuntimeMode;
  snapshotReady: boolean;
  snapshotError: boolean;
  eventId: string;
  mode: EventMode;
  status: EventStatus;
  networkOverride: NetworkState;
  registeredCount: number;
  checkInCount: number;
  voteCount: number;
  voteByTeam: AudienceVoteTeamCount[];
  votingStatus: VotingStatus;
  snapshotVersion: number;
  serverTime: string | null;
  activeTeamId: string | null;
  displayMode: DisplayMode;
  resultStatus: ResultStatus;
  revealStep: number;
  checkIns: CheckInRecord[];
  checkInResult: CheckInResult;
  myVotedTeamIds: string[];
  judgeProgress: JudgeProgress[];
  teams: Team[];
  scoreInputs: ScoreInput[];
  prizeHistory: PrizeRecord[];
  prizeCatalog: PrizeDefinition[];
  activities: Activity[];
  qaScenario: string | null;
};
