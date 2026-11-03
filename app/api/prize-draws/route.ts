import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getMockPrizeDraws, getSupabasePrizeDraws } from "@/lib/prize/prizeInventoryStore";

export const dynamic = "force-dynamic";
const eventIdSchema = z.string().uuid();

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const parsed = eventIdSchema.safeParse(new URL(request.url).searchParams.get("eventId"));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422);
    const data = isMockRuntime() ? getMockPrizeDraws(parsed.data) : await getSupabasePrizeDraws(parsed.data);
    return Response.json({ ok: true, data });
  } catch (error) { return toErrorResponse(error); }
}
