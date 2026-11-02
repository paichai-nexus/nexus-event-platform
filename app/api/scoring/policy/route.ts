import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { approveScoringPolicy, getScoringPolicy, saveScoringPolicyDraft } from "@/lib/scoring/scoringPolicyStore";

const eventId = z.string().uuid();
const draft = z.object({
  action: z.literal("SAVE"), eventId, version: z.string().trim().min(1).max(50),
  professionalWeight: z.number().int().min(0).max(100), audienceWeight: z.number().int().min(0).max(100),
  judgeCount: z.number().int().positive().max(20), professionalMaxPerJudge: z.number().int().positive().max(1000),
  audienceConversionRule: z.string().trim().max(2000), tieBreakRule: z.string().trim().max(2000), categoryAggregationRule: z.string().trim().max(2000),
});
const action = z.discriminatedUnion("action", [draft, z.object({ action: z.literal("APPROVE"), eventId, policyId: z.string().uuid() })]);
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const parsed = eventId.safeParse(new URL(request.url).searchParams.get("eventId"));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422);
    return Response.json({ ok: true, data: await getScoringPolicy(parsed.data) });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const parsed = action.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "평가정책 입력값을 확인해주세요.", 422);
    await authorizeRoles(parsed.data.action === "APPROVE" ? ["ADMIN"] : ["ADMIN", "STAFF"]);
    const data = parsed.data.action === "APPROVE"
      ? await approveScoringPolicy(parsed.data.eventId, parsed.data.policyId)
      : await saveScoringPolicyDraft(parsed.data.eventId, parsed.data);
    return Response.json({ ok: true, data });
  } catch (error) { return toErrorResponse(error); }
}
