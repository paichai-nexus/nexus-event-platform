import "server-only";

import { getMockAudienceBallotAggregate } from "@/lib/audience-jury/mockAudienceBallotStore";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AudienceBallotAggregate } from "@/types/audience-ballot-aggregate";
import type { TeamCategory } from "@/types/team";

type TeamRow = { id: string; name: string | null; presentation_order: number; category: TeamCategory; active: boolean };
type BallotRow = { category: TeamCategory; first_team_id: string; second_team_id: string };

export async function getAudienceBallotAggregate(eventId: string): Promise<AudienceBallotAggregate> {
  if (isMockRuntime()) return getMockAudienceBallotAggregate(eventId);
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const [teamsResult, ballotsResult, juryResult] = await Promise.all([
    client.from("teams").select("id, name, presentation_order, category, active").eq("event_id", eventId).eq("active", true).order("presentation_order"),
    client.from("audience_rank_ballots").select("category, first_team_id, second_team_id").eq("event_id", eventId),
    client.from("audience_jury_reservations").select("id", { count: "exact", head: true }).eq("event_id", eventId).not("pcu_code", "is", null),
  ]);
  if (teamsResult.error || ballotsResult.error || juryResult.error) throw new DomainError("DATABASE_ERROR", "청중평가 원표 집계를 조회하지 못했습니다.", 503);
  const teams = teamsResult.data as TeamRow[];
  const ballots = ballotsResult.data as BallotRow[];
  const categories = (["STARTUP", "BUSINESS_ANALYSIS"] as const).map((category) => {
    const categoryBallots = ballots.filter((ballot) => ballot.category === category);
    return {
      category,
      submittedBallots: categoryBallots.length,
      teams: teams.filter((team) => team.category === category && team.name).map((team) => ({
        teamId: team.id, teamName: team.name!, order: team.presentation_order, category,
        firstVotes: categoryBallots.filter((ballot) => ballot.first_team_id === team.id).length,
        secondVotes: categoryBallots.filter((ballot) => ballot.second_team_id === team.id).length,
      })),
    };
  });
  return { acceptedJuryCount: juryResult.count ?? 0, categories, updatedAt: new Date().toISOString(), officialScoresAvailable: false };
}
