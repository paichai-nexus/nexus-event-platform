import { toErrorResponse } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    if (supabase) await supabase.auth.signOut();
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
