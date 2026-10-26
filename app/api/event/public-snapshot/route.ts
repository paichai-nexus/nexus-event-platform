import { toErrorResponse } from "@/lib/errors/domainError";
import { getEventControlRepository, getTeamRepository } from "@/lib/repositories/repositoryFactory";
import { toPublicEventSnapshot } from "@/features/event/services/eventSnapshotService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
    const event = await getEventControlRepository().getSnapshot(eventId);
    const teams = await getTeamRepository().getTeams(event.eventId);
    return Response.json(
      { ok: true, data: toPublicEventSnapshot(event, teams) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
