import type { AudienceVoteSnapshot, AudienceVoteState } from "@/types/voting";

export interface VoteRepository {
  getState(eventId: string | undefined, sessionToken: string): Promise<AudienceVoteState>;
  submit(eventId: string | undefined, sessionToken: string): Promise<AudienceVoteState>;
  getSnapshot(eventId: string): Promise<AudienceVoteSnapshot>;
}
