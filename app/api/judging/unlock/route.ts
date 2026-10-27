import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getJudgeRepository } from "@/lib/repositories/repositoryFactory";

const inputSchema = z.object({
  submissionId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
});

export async function POST(request: Request) {
  try {
    await authorizeRoles(["ADMIN"]);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "잠금 해제 대상과 사유를 확인해주세요.", 422);
    const data = await getJudgeRepository().unlock(parsed.data.submissionId, parsed.data.reason);
    return Response.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
