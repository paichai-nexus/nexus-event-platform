import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnvironment } from "@/lib/config/runtime";

export function createSupabaseAdminClient() {
  const environment = getServerEnvironment();
  if (!environment?.SUPABASE_SERVICE_ROLE_KEY) return null;

  return createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
