import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getPrizeStages, lockPrizeStage } from "@/lib/prize/prizeStageStore";
const eventId = z.string().uuid();
const lock = z.object({ eventId, stage: z.enum(["SECOND", "THIRD"]) });
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { await authorizeRoles(["ADMIN", "STAFF"]); const parsed = eventId.safeParse(new URL(request.url).searchParams.get("eventId")); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422); return Response.json({ ok: true, data: await getPrizeStages(parsed.data) }); } catch (error) { return toErrorResponse(error); } }
export async function POST(request: Request) { try { await authorizeRoles(["ADMIN"]); const parsed = lock.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "럭키드로우 차수를 확인해주세요.", 422); return Response.json({ ok: true, data: await lockPrizeStage(parsed.data.eventId, parsed.data.stage) }); } catch (error) { return toErrorResponse(error); } }
