import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw new DomainError("DATABASE_ERROR", "Supabase가 설정되지 않아 실제 로그인을 사용할 수 없습니다.", 503);
    }
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "이메일과 비밀번호를 확인해주세요.", 422);

    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) throw new DomainError("UNAUTHORIZED", "로그인 정보가 올바르지 않습니다.", 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("user_id", data.user.id)
      .single();
    if (!profile?.active || !["ADMIN", "STAFF", "JUDGE"].includes(profile.role)) {
      await supabase.auth.signOut();
      throw new DomainError("FORBIDDEN", "활성화된 운영 계정이 아닙니다.", 403);
    }

    return Response.json({ ok: true, data: { role: profile.role } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
