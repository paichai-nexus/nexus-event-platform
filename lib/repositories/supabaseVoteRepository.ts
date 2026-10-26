import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { VoteRepository } from "@/lib/repositories/voteRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AudienceVoteSnapshot, AudienceVoteState, VotingStatus } from "@/types/voting";

type VoteStateRow = {
  eligible: boolean;
  voting_status: VotingStatus;
  team_id: string | null;
  submission_id: string | null;
  submitted_at: string | null;
};

function toState(data: unknown): AudienceVoteState {
  const row = (Array.isArray(data) ? data[0] : data) as VoteStateRow | null;
  if (!row) throw new DomainError("DATABASE_ERROR", "투표 상태를 확인하지 못했습니다.", 500);
  return {
    eligible: row.eligible,
    votingStatus: row.voting_status,
    teamId: row.team_id,
    submissionId: row.submission_id,
    submittedAt: row.submitted_at,
  };
}

export class SupabaseVoteRepository implements VoteRepository {
  private async client() {
    const client = await createSupabaseServerClient();
    if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    return client;
  }

  async getState(eventId: string | undefined, sessionToken: string) {
    const supabase = await this.client();
    const { data, error } = await supabase.rpc("get_audience_vote_state", {
      p_event_id: eventId ?? null,
      p_session_token: sessionToken,
    });
    if (error) throw new DomainError("DATABASE_ERROR", "투표 상태를 확인하지 못했습니다.", 500);
    return toState(data);
  }

  async submit(eventId: string | undefined, sessionToken: string) {
    const supabase = await this.client();
    const { error } = await supabase.rpc("submit_audience_vote", {
      p_event_id: eventId ?? null,
      p_session_token: sessionToken,
    });
    if (error) {
      const message = error.message ?? "";
      if (message.includes("VOTING_CLOSED")) throw new DomainError("EVENT_CLOSED", "현재 투표가 열려 있지 않습니다.", 409);
      if (message.includes("NOT_ELIGIBLE")) throw new DomainError("FORBIDDEN", "현장 입장을 완료한 참가자만 투표할 수 있습니다.", 403);
      throw new DomainError("DATABASE_ERROR", "투표를 저장하지 못했습니다.", 500);
    }
    return this.getState(eventId, sessionToken);
  }

  async getSnapshot(eventId: string): Promise<AudienceVoteSnapshot> {
    const supabase = await this.client();
    const { data, error } = await supabase.rpc("get_audience_vote_snapshot", { p_event_id: eventId });
    if (error) throw new DomainError("DATABASE_ERROR", "투표 집계를 확인하지 못했습니다.", 500);
    const teams = ((data ?? []) as Array<{ team_id: string; vote_count: number; eligibility_count: number }>).map((row) => ({
      teamId: row.team_id,
      voteCount: Number(row.vote_count),
      eligibilityCount: Number(row.eligibility_count),
    }));
    return { totalVotes: teams.reduce((sum, team) => sum + team.voteCount, 0), teams };
  }
}
