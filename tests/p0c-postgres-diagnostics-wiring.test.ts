import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCORING_POLICY_READY } from "../features/scoring/data/evaluationPolicy";

const route = readFileSync(new URL("../app/api/scoring/diagnostics/route.ts", import.meta.url), "utf8");
const adapter = readFileSync(new URL("../lib/scoring/postgresScoringDiagnostics.ts", import.meta.url), "utf8");
const runner = readFileSync(new URL("../lib/integration/postgresTest.ts", import.meta.url), "utf8");

describe("P0-C PostgreSQL scoring diagnostics wiring", () => {
  it("activates the PostgreSQL adapter only for the explicit test runtime", () => {
    expect(route).toMatch(/runtimeMode === "postgres-test"/);
    expect(route).toMatch(/readPostgresScoringDiagnostics\(eventId, actor\.userId\)/);
  });

  it("preserves the staging and production Supabase read path", () => {
    expect(route).toContain("createSupabaseServerClient");
    expect(route).toContain('db.from("teams")');
    expect(route).toContain('db.rpc("get_audience_vote_snapshot"');
  });

  it("uses authenticated RLS in a read-only transaction without service-role bypass", () => {
    expect(adapter).toContain("runPostgresTestReadJson");
    expect(adapter).toContain("get_audience_vote_snapshot");
    expect(adapter).not.toMatch(/role:\s*["'](?:superuser|service_role)/);
    expect(adapter).not.toMatch(/\b(?:insert|update|delete|truncate|alter|drop)\b/i);
    expect(runner).toContain('set transaction read only;');
    expect(runner).toContain('{ role: "authenticated", userId }');
  });

  it("keeps official scoring and result publication disabled", () => {
    expect(SCORING_POLICY_READY).toBe(false);
    expect(route).not.toContain("result_snapshots");
    expect(adapter).not.toContain("result_snapshots");
  });
});
