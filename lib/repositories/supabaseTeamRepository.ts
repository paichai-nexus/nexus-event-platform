import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { TeamRepository } from "@/lib/repositories/teamRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Team, TeamUpdate } from "@/types/team";
import { finalistProfileForName } from "@/features/event/data/finalistCandidates";

type TeamRow = {
  id: string;
  name: string | null;
  presentation_order: number;
  category: Team["category"];
  status: "WAITING" | "PRESENTING" | "DONE";
  active: boolean;
};

function toTeam(row: TeamRow): Team {
  const profile = finalistProfileForName(row.name);
  return {
    id: row.id,
    name: row.name,
    leaderName: profile?.leaderName ?? null,
    memberNames: profile?.memberNames ?? [],
    topic: profile?.topic ?? null,
    promotionEnabled: Boolean(profile),
    order: row.presentation_order,
    category: row.category,
    status: row.status === "WAITING" ? "READY" : row.status,
    active: row.active,
  };
}

export class SupabaseTeamRepository implements TeamRepository {
  private async client() {
    const client = await createSupabaseServerClient();
    if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    return client;
  }

  async getTeams(eventId: string) {
    const supabase = await this.client();
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, presentation_order, category, status, active")
      .eq("event_id", eventId)
      .order("presentation_order");
    if (error) throw new DomainError("DATABASE_ERROR", "참가팀을 조회하지 못했습니다.", 500);
    return (data as TeamRow[]).map(toTeam);
  }

  async updateTeam(update: TeamUpdate) {
    const supabase = await this.client();
    const { data, error } = await supabase
      .from("teams")
      .update({
        name: update.name?.trim() || null,
        presentation_order: update.order,
        category: update.category,
        status: update.status === "READY" ? "WAITING" : update.status,
        active: update.active,
      })
      .eq("id", update.id)
      .eq("event_id", update.eventId)
      .select("id, name, presentation_order, category, status, active")
      .single();
    if (error || !data) throw new DomainError("DATABASE_ERROR", "참가팀을 저장하지 못했습니다.", 500);
    return toTeam(data as TeamRow);
  }
}
