import { authorizeRoles } from "@/lib/auth/authorize";
import { toErrorResponse } from "@/lib/errors/domainError";
import { getCheckInRepository } from "@/lib/repositories/repositoryFactory";
import { CheckInService } from "@/features/check-in/services/checkInService";

export async function POST(request: Request) {
  try {
    const actor = await authorizeRoles(["ADMIN", "STAFF"]);
    const input: unknown = await request.json();
    const service = new CheckInService(getCheckInRepository());
    const result = await service.checkIn(input, actor.userId);
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return toErrorResponse(error);
  }
}
