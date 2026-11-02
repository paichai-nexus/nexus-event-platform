import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { advanceCeremonyControl, getCeremonyControl } from "@/lib/ceremony/ceremonyControlStore";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
const eventId = z.string().uuid();
const update = z.object({ eventId, phase: z.enum(["AUDIENCE_CANDIDATES", "SECOND_DRAW", "JUDGE_REVIEW", "RESULTS", "BEST_REVIEWER", "THIRD_DRAW", "COMPLETE"]) });
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { await authorizeRoles(["ADMIN", "STAFF"]); const parsed = eventId.safeParse(new URL(request.url).searchParams.get("eventId")); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422); return Response.json({ ok: true, data: await getCeremonyControl(parsed.data) }); } catch (error) { return toErrorResponse(error); } }
export async function POST(request: Request) { try { await authorizeRoles(["ADMIN"]); const parsed = update.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 진행 단계를 확인해주세요.", 422); return Response.json({ ok: true, data: await advanceCeremonyControl(parsed.data.eventId, parsed.data.phase) }); } catch (error) { return toErrorResponse(error); } }
