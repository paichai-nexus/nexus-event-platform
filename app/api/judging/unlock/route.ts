import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { isSupabaseConfigured } from "@/lib/config/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  submissionId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
});

export async function POST(request: Request) {
  try {
    await authorizeRoles(["ADMIN"]);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "잠금 해제 대상과 사유를 확인해주세요.", 422);
    if (!isSupabaseConfigured()) {
      throw new DomainError("NOT_FOUND", "서버 Mock에는 실제 심사 제출 데이터가 없습니다.", 404);
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    const { data, error } = await supabase.rpc("unlock_judge_submission", {
      p_submission_id: parsed.data.submissionId,
      p_reason: parsed.data.reason,
    });
    if (error || !data) throw new DomainError("DATABASE_ERROR", "심사 제출 잠금을 해제하지 못했습니다.", 500);
    return Response.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
