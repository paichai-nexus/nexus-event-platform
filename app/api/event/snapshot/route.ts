import { authorizeRoles } from "@/lib/auth/authorize";
import { toErrorResponse } from "@/lib/errors/domainError";
import { getCheckInRepository, getEventControlRepository, getJudgeRepository, getPrizeCatalogRepository, getTeamRepository, getVoteRepository } from "@/lib/repositories/repositoryFactory";
import { getPrizeRepository } from "@/lib/repositories/repositoryFactory";
import { CheckInService } from "@/features/check-in/services/checkInService";
import { EventControlService } from "@/features/event/services/eventControlService";
import { PrizeService } from "@/features/prize/services/prizeService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
    const checkInService = new CheckInService(getCheckInRepository());
    const eventService = new EventControlService(getEventControlRepository());
    const event = await eventService.getSnapshot(eventId);
    const prizeService = new PrizeService(getPrizeRepository());
    const [checkIn, prizeHistory, teams, prizeCatalog, votes, judgeProgress] = await Promise.all([
      checkInService.getSnapshot(event.eventId),
      prizeService.getHistory(event.eventId),
      getTeamRepository().getTeams(event.eventId),
      getPrizeCatalogRepository().getCatalog(event.eventId),
      getVoteRepository().getSnapshot(event.eventId),
      getJudgeRepository().getProgress(event.eventId),
    ]);
    return Response.json(
      { ok: true, data: { ...checkIn, ...event, serverTime: new Date().toISOString(), prizeHistory, teams, prizeCatalog, voteCount: votes.totalVotes, voteByTeam: votes.teams, judgeProgress } },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
