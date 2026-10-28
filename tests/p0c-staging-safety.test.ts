import { describe, expect, it } from "vitest";
import {
  evaluateStagingValidationPolicy,
  extractSupabaseProjectRef,
  stagingDatabaseTargetsProject,
  type StagingValidationEnvironment,
} from "../lib/config/stagingValidation";
import { STAGING_READ_ONLY_SCENARIOS } from "../lib/integration/stagingReadOnlyScenarios";

const stagingRef = "s".repeat(20);
const productionRef = "p".repeat(20);

function validEnvironment(): StagingValidationEnvironment {
  return {
    APP_RUNTIME_MODE: "staging",
    ALLOW_STAGING_TESTS: "true",
    NEXT_PUBLIC_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    APP_BASE_URL: "https://staging.example.invalid",
    ATTENDANCE_EXIT_SECRET: "x".repeat(32),
    STAGING_SUPABASE_PROJECT_REF: stagingRef,
    STAGING_SUPABASE_PROJECT_REF_ALLOWLIST: stagingRef,
    PRODUCTION_SUPABASE_PROJECT_REFS: productionRef,
    STAGING_APP_ORIGIN_ALLOWLIST: "https://staging.example.invalid",
    PRODUCTION_APP_ORIGINS: "https://production.example.invalid",
  };
}

describe("P0-C staging validation safety policy", () => {
  it("allows an explicitly approved non-production staging target", () => {
    expect(evaluateStagingValidationPolicy(validEnvironment())).toEqual({ ok: true, projectRef: stagingRef });
  });

  it.each([
    ["wrong runtime", { APP_RUNTIME_MODE: "production" }],
    ["approval missing", { ALLOW_STAGING_TESTS: "false" }],
    ["allowlist missing", { STAGING_SUPABASE_PROJECT_REF_ALLOWLIST: "" }],
    ["production registry missing", { PRODUCTION_SUPABASE_PROJECT_REFS: "" }],
    ["anon key missing", { NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }],
    ["service key missing", { SUPABASE_SERVICE_ROLE_KEY: "" }],
    ["HTTPS app URL missing", { APP_BASE_URL: "http://localhost:3000" }],
    ["attendance secret missing", { ATTENDANCE_EXIT_SECRET: "" }],
  ])("blocks when %s", (_label, override) => {
    expect(evaluateStagingValidationPolicy({ ...validEnvironment(), ...override }).ok).toBe(false);
  });

  it("rejects URLs whose hosted project ref cannot be identified exactly", () => {
    for (const value of [
      "https://supabase.example.com",
      `http://${stagingRef}.supabase.co`,
      `https://${stagingRef}.supabase.co/rest/v1`,
      `https://${stagingRef}.supabase.co?project=other`,
      "not-a-url",
    ]) expect(extractSupabaseProjectRef(value)).toBeNull();
  });

  it("blocks a mismatch between URL, configured ref, and allowlist", () => {
    const otherRef = "o".repeat(20);
    expect(evaluateStagingValidationPolicy({ ...validEnvironment(), STAGING_SUPABASE_PROJECT_REF: otherRef }).ok).toBe(false);
    expect(evaluateStagingValidationPolicy({ ...validEnvironment(), STAGING_SUPABASE_PROJECT_REF_ALLOWLIST: otherRef }).ok).toBe(false);
    expect(evaluateStagingValidationPolicy({ ...validEnvironment(), STAGING_APP_ORIGIN_ALLOWLIST: "https://other.example.invalid" }).ok).toBe(false);
  });

  it("blocks a staging ref registered as production", () => {
    const result = evaluateStagingValidationPolicy({ ...validEnvironment(), PRODUCTION_SUPABASE_PROJECT_REFS: stagingRef });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Staging project ref conflicts with a registered production ref.");
    const appResult = evaluateStagingValidationPolicy({ ...validEnvironment(), PRODUCTION_APP_ORIGINS: "https://staging.example.invalid" });
    expect(appResult.ok).toBe(false);
    if (!appResult.ok) expect(appResult.errors).toContain("APP_BASE_URL conflicts with a registered Production app origin.");
  });

  it("accepts only SSL database URLs that prove the same project ref", () => {
    expect(stagingDatabaseTargetsProject(`postgresql://postgres:secret@db.${stagingRef}.supabase.co:5432/postgres?sslmode=require`, stagingRef)).toBe(true);
    expect(stagingDatabaseTargetsProject(`postgresql://postgres.${stagingRef}:secret@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require`, stagingRef)).toBe(true);
    expect(stagingDatabaseTargetsProject(`postgresql://postgres:secret@db.${productionRef}.supabase.co:5432/postgres?sslmode=require`, stagingRef)).toBe(false);
    expect(stagingDatabaseTargetsProject(`postgresql://postgres:secret@db.${stagingRef}.supabase.co:5432/postgres`, stagingRef)).toBe(false);
  });
});

describe("P0-C hosted read-only role scenarios", () => {
  it("defines ADMIN, STAFF, JUDGE, and anonymous checks without data mutations", () => {
    expect(new Set(STAGING_READ_ONLY_SCENARIOS.map((scenario) => scenario.actor))).toEqual(
      new Set(["ANONYMOUS", "ADMIN", "STAFF", "JUDGE"]),
    );
    expect(STAGING_READ_ONLY_SCENARIOS.every((scenario) => scenario.path.startsWith("/api/"))).toBe(true);
    expect(STAGING_READ_ONLY_SCENARIOS.some((scenario) => scenario.actor === "ADMIN" && scenario.expectedStatus === 200)).toBe(true);
    expect(STAGING_READ_ONLY_SCENARIOS.some((scenario) => scenario.actor === "STAFF" && scenario.expectedStatus === 200)).toBe(true);
    expect(STAGING_READ_ONLY_SCENARIOS.some((scenario) => scenario.actor === "JUDGE" && scenario.expectedStatus === 200)).toBe(true);
    expect(STAGING_READ_ONLY_SCENARIOS.some((scenario) => scenario.actor === "ANONYMOUS" && scenario.expectedStatus === 401)).toBe(true);
  });
});
