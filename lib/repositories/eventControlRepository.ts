import type { DisplayMode, EventMode, EventStatus, ResultStatus } from "@/types/event";
import type { VotingStatus } from "@/types/voting";

export type EventControlSnapshot = {
  eventId: string;
  mode: EventMode;
  status: EventStatus;
  votingStatus: VotingStatus;
  version: number;
  activeTeamId: string | null;
  displayMode: DisplayMode;
  resultStatus: ResultStatus;
  revealStep: number;
};

export interface EventControlRepository {
  getSnapshot(eventId?: string): Promise<EventControlSnapshot>;
  setVotingStatus(eventId: string, status: VotingStatus): Promise<EventControlSnapshot>;
  setMode(eventId: string, mode: EventMode): Promise<EventControlSnapshot>;
  setStatus(eventId: string, status: EventStatus): Promise<EventControlSnapshot>;
  setActiveTeam(eventId: string, teamId: string | null): Promise<EventControlSnapshot>;
  completeActiveTeam(eventId: string): Promise<EventControlSnapshot>;
  setDisplayMode(eventId: string, displayMode: DisplayMode): Promise<EventControlSnapshot>;
  setRevealStep(eventId: string, revealStep: number): Promise<EventControlSnapshot>;
  resetRehearsal(eventId: string): Promise<EventControlSnapshot>;
}
