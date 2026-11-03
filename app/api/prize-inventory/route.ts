import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { isMockRuntime } from "@/lib/config/runtime";
import { toErrorResponse } from "@/lib/errors/domainError";
import { drawMockPrizeItem, drawSupabasePrizeItem, getMockPrizeInventory, getSupabasePrizeInventory } from "@/lib/prize/prizeInventoryStore";

const eventIdSchema = z.string().uuid();
const drawSchema = z.object({ eventId: eventIdSchema, prizeItemId: z.string().min(1), stage: z.enum(["FIRST", "SECOND", "THIRD"]) });
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const eventId = eventIdSchema.parse(new URL(request.url).searchParams.get("eventId"));
    const data = isMockRuntime() ? getMockPrizeInventory() : await getSupabasePrizeInventory(eventId);
    return Response.json({ ok: true, data });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const input = drawSchema.parse(await request.json());
    const data = isMockRuntime()
      ? await drawMockPrizeItem(input.eventId, input.prizeItemId, input.stage)
      : await drawSupabasePrizeItem(input.eventId, input.prizeItemId, input.stage);
    return Response.json({ ok: true, data });
  } catch (error) { return toErrorResponse(error); }
}
