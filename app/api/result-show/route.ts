import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { approveResultShow, getResultShowDeck, saveResultShowDraft, setResultShowScene } from "@/lib/results/resultShowStore";

const eventId = z.string().uuid();
const award = z.object({ title: z.string().trim().min(1).max(100), teamName: z.string().trim().min(1).max(100), detail: z.string().trim().max(200) });
const bestReviewer = z.object({ participantCode: z.string().trim().min(1).max(30), name: z.string().trim().min(1).max(100), department: z.string().trim().min(1).max(100), reviewExcerpt: z.string().trim().min(1).max(500) });
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SAVE"), eventId, judgeComment: z.string().trim().min(1).max(2000), awards: z.array(award).min(1).max(20), bestReviewer: bestReviewer.nullable() }),
  z.object({ action: z.literal("APPROVE"), eventId }),
  z.object({ action: z.literal("SET_SCENE"), eventId, scene: z.enum(["REVIEW", "RESULT", "BEST_REVIEWER"]) }),
]);
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { await authorizeRoles(["ADMIN", "STAFF"]); const parsed = eventId.safeParse(new URL(request.url).searchParams.get("eventId")); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422); return Response.json({ ok: true, data: await getResultShowDeck(parsed.data) }); } catch (error) { return toErrorResponse(error); } }
export async function POST(request: Request) { try { const parsed = action.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "결과 SHOW 입력값을 확인해주세요.", 422); await authorizeRoles(parsed.data.action === "SAVE" ? ["ADMIN", "STAFF"] : ["ADMIN"]); const data = parsed.data.action === "SAVE" ? await saveResultShowDraft(parsed.data.eventId, parsed.data.judgeComment, parsed.data.awards, parsed.data.bestReviewer) : parsed.data.action === "APPROVE" ? await approveResultShow(parsed.data.eventId) : await setResultShowScene(parsed.data.eventId, parsed.data.scene); return Response.json({ ok: true, data }); } catch (error) { return toErrorResponse(error); } }
