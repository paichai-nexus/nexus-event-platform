import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRuntimePolicy } from "@/lib/config/runtime";
import { postgresOneJson, runPostgresTestJson } from "@/lib/integration/postgresTest";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = getRuntimePolicy();
  if (!runtime.ok) {
    return Response.json({ ok: false, mode: runtime.mode, status: "CONFIGURATION_ERROR" }, { status: 503 });
  }
  if (runtime.mode === "mock") {
    return Response.json({ ok: true, mode: runtime.mode, status: "EXPLICIT_MOCK" });
  }

  if (runtime.mode === "postgres-test") {
    try {
      const database = await runPostgresTestJson<{ database: string }>(postgresOneJson(`select current_database() as database`));
      return Response.json({ ok: true, mode: runtime.mode, status: "READY", database: database.database }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("PostgreSQL test readiness failed", error);
      return Response.json({ ok: false, mode: runtime.mode, status: "DEPENDENCY_UNAVAILABLE" }, { status: 503 });
    }
  }

  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) throw new Error("Admin client unavailable");
    const [database, authentication] = await Promise.all([
      supabase.from("events").select("id", { head: true, count: "exact" }).limit(1),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
    ]);
    if (database.error || authentication.error) throw database.error ?? authentication.error;
    return Response.json({ ok: true, mode: runtime.mode, status: "READY" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Readiness check failed", error);
    return Response.json({ ok: false, mode: runtime.mode, status: "DEPENDENCY_UNAVAILABLE" }, { status: 503 });
  }
}
