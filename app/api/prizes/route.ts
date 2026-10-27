import { PrizeService } from "@/features/prize/services/prizeService";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getPrizeRepository } from "@/lib/repositories/repositoryFactory";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const eventId = new URL(request.url).searchParams.get("eventId");
    if (!eventId) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422);
    const service = new PrizeService(getPrizeRepository());
    return Response.json({ ok: true, data: await service.getHistory(eventId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await authorizeRoles(["ADMIN", "STAFF"]);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("eventId" in body) || typeof body.eventId !== "string") {
      throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422);
    }
    const service = new PrizeService(getPrizeRepository());
    return Response.json({ ok: true, data: await service.draw(body.eventId, actor.userId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
