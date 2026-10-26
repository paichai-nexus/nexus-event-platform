import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config/runtime";
import { DomainError } from "@/lib/errors/domainError";
import { hasRequiredRole, type StaffRole } from "@/lib/auth/roles";

export type { StaffRole } from "@/lib/auth/roles";

export type AuthorizedActor<TRole extends StaffRole = StaffRole> = {
  userId: string;
  role: TRole;
  mock: boolean;
};

export async function authorizeRoles<const TRoles extends readonly StaffRole[]>(roles: TRoles): Promise<AuthorizedActor<TRoles[number]>> {
  if (!isSupabaseConfigured()) {
    return { userId: "00000000-0000-4000-8000-000000000001", role: roles[0], mock: true };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new DomainError("UNAUTHORIZED", "로그인이 필요합니다.", 401);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("user_id", userData.user.id)
    .single();

  if (profileError || !hasRequiredRole(profile?.role, profile?.active, roles)) {
    throw new DomainError("FORBIDDEN", "이 작업을 수행할 권한이 없습니다.", 403);
  }

  return { userId: userData.user.id, role: profile.role as TRoles[number], mock: false };
}
