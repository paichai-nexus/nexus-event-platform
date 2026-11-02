import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getPaperJudgeScores, savePaperJudgeScore } from "@/lib/judging/paperJudgeScoreStore";

const eventId = z.string().uuid();
const input = z.object({
  eventId, teamId: z.string().min(1).max(100), judgeSlot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  documentScore: z.number().int().min(0).max(50), presentationScore: z.number().int().min(0).max(100),
  qnaScore: z.number().int().min(0).max(50), status: z.enum(["DRAFT", "SUBMITTED"]),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const parsed = eventId.safeParse(new URL(request.url).searchParams.get("eventId"));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422);
    return Response.json({ ok: true, data: await getPaperJudgeScores(parsed.data) });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "종이 심사표 입력값을 확인해주세요.", 422);
    return Response.json({ ok: true, data: await savePaperJudgeScore(parsed.data) });
  } catch (error) { return toErrorResponse(error); }
}
