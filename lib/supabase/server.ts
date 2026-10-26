import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnvironment } from "@/lib/config/runtime";

export async function createSupabaseServerClient() {
  const environment = getServerEnvironment();
  if (!environment) return null;

  const cookieStore = await cookies();
  return createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot write cookies. Route Handlers and Proxy refresh sessions.
          }
        },
      },
    },
  );
}
