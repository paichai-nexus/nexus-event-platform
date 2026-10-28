import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { evaluateStagingValidationPolicy } from "../lib/config/stagingValidation.ts";
import { STAGING_READ_ONLY_SCENARIOS, type StagingActor } from "../lib/integration/stagingReadOnlyScenarios.ts";

const policy = evaluateStagingValidationPolicy(process.env);
if (!policy.ok) {
  console.error(`BLOCKED: ${policy.errors.join(" ")}`);
  process.exit(2);
}

const eventId = process.env.P0C_STAGING_EVENT_ID?.trim() ?? "";
const eventIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accountVariables = {
  ADMIN: "P0C_STAGING_ADMIN_COOKIE",
  STAFF: "P0C_STAGING_STAFF_COOKIE",
  JUDGE: "P0C_STAGING_JUDGE_COOKIE",
} as const;
const missingAccountVariables = Object.values(accountVariables).filter((name) => !process.env[name]?.trim());
if (!eventIdPattern.test(eventId) || missingAccountVariables.length) {
  const reasons = [
    ...(!eventIdPattern.test(eventId) ? ["P0C_STAGING_EVENT_ID"] : []),
    ...missingAccountVariables,
  ];
  console.error(`BLOCKED: approved read-only staging test inputs are missing: ${reasons.join(", ")}`);
  process.exit(2);
}

const appBaseUrl = process.env.APP_BASE_URL!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function get(path: string, cookie?: string) {
  return fetch(new URL(path.replace(":eventId", eventId), appBaseUrl), {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
}

const supabase = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const readiness = await get("/api/health/readiness");
assert.equal(readiness.status, 200, `staging readiness must succeed: HTTP ${readiness.status}`);
const readinessBody = await readiness.json() as Record<string, unknown>;
assert.equal(readinessBody.mode, "staging", "application runtime must report staging mode");
assert.equal(readinessBody.status, "READY", "application dependencies must be ready");

const directAnonRead = await supabase.from("events").select("id").limit(1);
assert.ok(directAnonRead.error, "anonymous direct PostgREST events read must be denied");

const cookies = new Map<Exclude<StagingActor, "ANONYMOUS">, string>(
  (["ADMIN", "STAFF", "JUDGE"] as const).map((actor) => [actor, process.env[accountVariables[actor]]!]),
);

for (const scenario of STAGING_READ_ONLY_SCENARIOS) {
  const cookie = scenario.actor === "ANONYMOUS" ? undefined : cookies.get(scenario.actor);
  const response = await get(scenario.path, cookie);
  assert.equal(response.status, scenario.expectedStatus, `${scenario.label}: HTTP ${response.status}`);
  if (scenario.expectedStatus === 200 && scenario.path.startsWith("/api/scoring/diagnostics")) {
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.status, "POLICY_APPROVAL_REQUIRED");
    assert.equal(body.officialScoresAvailable, false);
    assert.equal(/"(?:rank|finalScore|officialRank|resultSnapshot)"/.test(JSON.stringify(body)), false);
  }
}

console.log("PASS: hosted Supabase Auth, PostgREST denial, and read-only role scenarios completed without data mutation.");
