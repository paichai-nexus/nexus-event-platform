import { toErrorResponse } from "@/lib/errors/domainError";
import { toPublicEventSnapshot } from "@/features/event/services/eventSnapshotService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMockRuntime, isPostgresTestRuntime } from "@/lib/config/runtime";
import { getEventControlRepository, getTeamRepository } from "@/lib/repositories/repositoryFactory";
import { DomainError } from "@/lib/errors/domainError";
import type { EventControlSnapshot } from "@/lib/repositories/eventControlRepository";
import type { Team } from "@/types/team";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
    let event: EventControlSnapshot;
    let teams: Team[];
    if (isMockRuntime() || isPostgresTestRuntime()) {
      event = await getEventControlRepository().getSnapshot(eventId);
      teams = await getTeamRepository().getTeams(event.eventId);
    } else {
      const supabase = createSupabaseAdminClient();
      if (!supabase) throw new DomainError("DATABASE_ERROR", "공개 행사 정보를 조회할 수 없습니다.", 503);
      let eventQuery = supabase.from("events").select("id, mode, status, voting_status, version, active_team_id, display_mode, result_status, reveal_step");
      eventQuery = eventId ? eventQuery.eq("id", eventId) : eventQuery.order("starts_at", { ascending: false }).limit(1);
      const eventResult = await eventQuery.single();
      if (eventResult.error || !eventResult.data) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
      const row = eventResult.data;
      event = {
        eventId: row.id,
        mode: row.mode,
        status: row.status,
        votingStatus: row.voting_status,
        version: Number(row.version),
        activeTeamId: row.active_team_id,
        displayMode: row.display_mode,
        resultStatus: row.result_status,
        revealStep: Number(row.reveal_step),
      } as EventControlSnapshot;
      const teamResult = await supabase.from("teams")
        .select("id, name, presentation_order, category, status, active")
        .eq("event_id", event.eventId)
        .eq("active", true)
        .order("presentation_order");
      if (teamResult.error) throw new DomainError("DATABASE_ERROR", "참가팀을 조회하지 못했습니다.", 500);
      teams = (teamResult.data ?? []).map((team) => ({
        id: team.id,
        name: team.name,
        leaderName: null,
        memberNames: [],
        topic: null,
        promotionEnabled: false,
        order: team.presentation_order,
        category: team.category,
        status: team.status === "WAITING" ? "READY" : team.status,
        active: team.active,
      })) as Team[];
    }
    return Response.json(
      { ok: true, data: toPublicEventSnapshot(event, teams) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
