import { EventControlService, eventControlInputSchema } from "@/features/event/services/eventControlService";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getEventControlRepository } from "@/lib/repositories/repositoryFactory";

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = eventControlInputSchema.safeParse(body);
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 제어 요청이 올바르지 않습니다.", 422);
    const adminOnly = ["SET_MODE", "RESET_REHEARSAL", "SET_REVEAL_STEP"].includes(parsed.data.action);
    await authorizeRoles(adminOnly ? ["ADMIN"] : ["ADMIN", "STAFF"]);
    const service = new EventControlService(getEventControlRepository());
    const result = await service.execute(parsed.data);
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return toErrorResponse(error);
  }
}
