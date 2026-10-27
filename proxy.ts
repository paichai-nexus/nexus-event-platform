import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { evaluateRuntimePolicy } from "@/lib/config/runtimePolicy";

export async function proxy(request: NextRequest) {
  const runtime = evaluateRuntimePolicy({
    APP_RUNTIME_MODE: process.env.APP_RUNTIME_MODE,
    ALLOW_MOCK_RUNTIME: process.env.ALLOW_MOCK_RUNTIME,
    ALLOW_POSTGRES_TEST_RUNTIME: process.env.ALLOW_POSTGRES_TEST_RUNTIME,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_BASE_URL: process.env.APP_BASE_URL,
    ATTENDANCE_EXIT_SECRET: process.env.ATTENDANCE_EXIT_SECRET,
    P0B_POSTGRES_URL: process.env.P0B_POSTGRES_URL,
    P0B_TEST_AUTH_SECRET: process.env.P0B_TEST_AUTH_SECRET,
  });
  if (!runtime.ok) {
    return new NextResponse("Runtime configuration unavailable", { status: 503 });
  }
  if (runtime.mode === "mock") return NextResponse.next();
  if (runtime.mode === "postgres-test") {
    const suppliedSecret = request.headers.get("x-p0b-test-secret");
    const suppliedUser = request.headers.get("x-p0b-test-user");
    if (!suppliedSecret || suppliedSecret !== process.env.P0B_TEST_AUTH_SECRET || !suppliedUser) {
      return new NextResponse("Isolated integration authentication required", { status: 401 });
    }
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return new NextResponse("Authentication unavailable", { status: 503 });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/judge/:path*"],
};
