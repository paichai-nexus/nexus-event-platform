import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getEventControlRepository, getTeamRepository } from "@/lib/repositories/repositoryFactory";

const eventIdSchema = z.string().uuid();
const updateSchema = z.object({
  eventId: eventIdSchema,
  id: z.string().min(1),
  name: z.string().trim().max(100).nullable(),
  order: z.number().int().min(1).max(19),
  category: z.enum(["STARTUP", "BUSINESS_ANALYSIS"]),
  status: z.enum(["READY", "PRESENTING", "DONE"]),
  active: z.boolean(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const parsed = eventIdSchema.safeParse(new URL(request.url).searchParams.get("eventId"));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422);
    return Response.json({ ok: true, data: await getTeamRepository().getTeams(parsed.data) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "참가팀 입력값을 확인해주세요.", 422);
    const event = await getEventControlRepository().getSnapshot(parsed.data.eventId);
    if (["FINALIZED", "ENDED"].includes(event.status)) {
      throw new DomainError("EVENT_CLOSED", "결과 확정 이후에는 참가팀을 수정할 수 없습니다.", 409);
    }
    return Response.json({ ok: true, data: await getTeamRepository().updateTeam(parsed.data) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
