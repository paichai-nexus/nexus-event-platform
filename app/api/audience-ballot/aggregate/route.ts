import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { getAudienceBallotAggregate } from "@/lib/audience-jury/audienceBallotAggregateStore";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const parsed = z.string().uuid().safeParse(new URL(request.url).searchParams.get("eventId"));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422);
    return Response.json({ ok: true, data: await getAudienceBallotAggregate(parsed.data) });
  } catch (error) { return toErrorResponse(error); }
}
