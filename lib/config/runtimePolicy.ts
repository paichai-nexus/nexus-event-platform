import { z } from "zod";

export const runtimeModeSchema = z.enum(["mock", "postgres-test", "staging", "production"]);

export type RuntimeMode = z.infer<typeof runtimeModeSchema>;

export type RuntimePolicyResult =
  | { ok: true; mode: RuntimeMode; usesMockData: boolean }
  | { ok: false; mode: RuntimeMode | "unconfigured"; errors: string[]; usesMockData: false };

type RuntimeEnvironment = Record<string, string | undefined>;

const requiredSupabaseVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_BASE_URL",
  "ATTENDANCE_EXIT_SECRET",
] as const;

function isUrl(value: string | undefined) {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function evaluateRuntimePolicy(environment: RuntimeEnvironment): RuntimePolicyResult {
  const parsedMode = runtimeModeSchema.safeParse(environment.APP_RUNTIME_MODE);
  if (!parsedMode.success) {
    return {
      ok: false,
      mode: "unconfigured",
      errors: ["APP_RUNTIME_MODE must be mock, postgres-test, staging, or production."],
      usesMockData: false,
    };
  }

  const mode = parsedMode.data;
  if (mode === "mock") {
    const errors: string[] = [];
    if (environment.ALLOW_MOCK_RUNTIME !== "true") errors.push("ALLOW_MOCK_RUNTIME=true is required for mock mode.");
    if (environment.NODE_ENV === "production" || environment.VERCEL_ENV === "production") {
      errors.push("Mock mode is forbidden in a production runtime.");
    }
    return errors.length
      ? { ok: false, mode, errors, usesMockData: false }
      : { ok: true, mode, usesMockData: true };
  }

  if (mode === "postgres-test") {
    const errors: string[] = [];
    if (environment.ALLOW_POSTGRES_TEST_RUNTIME !== "true") {
      errors.push("ALLOW_POSTGRES_TEST_RUNTIME=true is required for postgres-test mode.");
    }
    if (environment.NODE_ENV === "production" || environment.VERCEL_ENV) {
      errors.push("postgres-test mode is forbidden in production and Vercel runtimes.");
    }
    if (!environment.P0B_POSTGRES_URL) {
      errors.push("P0B_POSTGRES_URL is required in postgres-test mode.");
    } else {
      try {
        const databaseUrl = new URL(environment.P0B_POSTGRES_URL);
        if (!["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname)) {
          errors.push("P0B_POSTGRES_URL must use a loopback host.");
        }
        if (!databaseUrl.pathname.slice(1).startsWith("nexus_p0b_")) {
          errors.push("P0B_POSTGRES_URL database must start with nexus_p0b_.");
        }
      } catch {
        errors.push("P0B_POSTGRES_URL must be a valid PostgreSQL URL.");
      }
    }
    if (!environment.P0B_TEST_AUTH_SECRET || environment.P0B_TEST_AUTH_SECRET.length < 32) {
      errors.push("P0B_TEST_AUTH_SECRET must contain at least 32 characters.");
    }
    if (!environment.ATTENDANCE_EXIT_SECRET || environment.ATTENDANCE_EXIT_SECRET.length < 32) {
      errors.push("ATTENDANCE_EXIT_SECRET must contain at least 32 characters.");
    }
    return errors.length
      ? { ok: false, mode, errors, usesMockData: false }
      : { ok: true, mode, usesMockData: false };
  }

  const errors = requiredSupabaseVariables
    .filter((name) => !environment[name]?.trim())
    .map((name) => `${name} is required in ${mode} mode.`);

  if (environment.NEXT_PUBLIC_SUPABASE_URL && !isUrl(environment.NEXT_PUBLIC_SUPABASE_URL)) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }
  if (environment.APP_BASE_URL && !isUrl(environment.APP_BASE_URL)) {
    errors.push("APP_BASE_URL must be a valid URL.");
  }
  if (environment.ATTENDANCE_EXIT_SECRET && environment.ATTENDANCE_EXIT_SECRET.length < 32) {
    errors.push("ATTENDANCE_EXIT_SECRET must contain at least 32 characters.");
  }
  if (mode === "production") {
    if (environment.NEXT_PUBLIC_SUPABASE_URL && !environment.NEXT_PUBLIC_SUPABASE_URL.startsWith("https://")) {
      errors.push("Production Supabase must use HTTPS.");
    }
    if (environment.APP_BASE_URL && !environment.APP_BASE_URL.startsWith("https://")) {
      errors.push("Production APP_BASE_URL must use HTTPS.");
    }
  }

  return errors.length
    ? { ok: false, mode, errors, usesMockData: false }
    : { ok: true, mode, usesMockData: false };
}

export function runtimeModeLabel(result: RuntimePolicyResult) {
  if (!result.ok) return "CONFIG ERROR";
  if (result.mode === "mock") return "MOCK · LOCAL ONLY";
  if (result.mode === "postgres-test") return "POSTGRES TEST · ISOLATED";
  if (result.mode === "staging") return "STAGING · TEST DATA";
  return "PRODUCTION · LIVE DATA";
}
