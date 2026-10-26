import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import { MockEventControlRepository } from "@/lib/repositories/mockEventControlRepository";
import type { VoteRepository } from "@/lib/repositories/voteRepository";
import type { AudienceVoteState } from "@/types/voting";

type MockVote = { submissionId: string; submittedAt: string };
const globalForVotes = globalThis as typeof globalThis & { __mockVotes?: Map<string, MockVote> };

function votes() {
  globalForVotes.__mockVotes ??= new Map();
  return globalForVotes.__mockVotes;
}

function voteKey(eventId: string, teamId: string, sessionToken: string) {
  return `${eventId}:${teamId}:${sessionToken}`;
}

export class MockVoteRepository implements VoteRepository {
  private readonly events = new MockEventControlRepository();

  async getState(eventId: string | undefined, sessionToken: string): Promise<AudienceVoteState> {
    const event = await this.events.getSnapshot(eventId);
    const saved = event.activeTeamId ? votes().get(voteKey(event.eventId, event.activeTeamId, sessionToken)) : undefined;
    return {
      eligible: true,
      votingStatus: event.votingStatus,
      teamId: event.activeTeamId,
      submissionId: saved?.submissionId ?? null,
      submittedAt: saved?.submittedAt ?? null,
    };
  }

  async submit(eventId: string | undefined, sessionToken: string) {
    const event = await this.events.getSnapshot(eventId);
    if (event.votingStatus !== "OPEN" || !event.activeTeamId) {
      throw new DomainError("EVENT_CLOSED", "현재 투표가 열려 있지 않습니다.", 409);
    }
    const key = voteKey(event.eventId, event.activeTeamId, sessionToken);
    if (!votes().has(key)) votes().set(key, { submissionId: crypto.randomUUID(), submittedAt: new Date().toISOString() });
    return this.getState(event.eventId, sessionToken);
  }

  async getSnapshot(eventId: string) {
    const prefix = `${eventId}:`;
    const counts = new Map<string, number>();
    for (const [key] of votes()) {
      if (!key.startsWith(prefix)) continue;
      const teamId = key.slice(prefix.length).split(":")[0];
      counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
    }
    const teams = [...counts].map(([teamId, voteCount]) => ({ teamId, voteCount, eligibilityCount: 0 }));
    return { totalVotes: teams.reduce((sum, team) => sum + team.voteCount, 0), teams };
  }
}
