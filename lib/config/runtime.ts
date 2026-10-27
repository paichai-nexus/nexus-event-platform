import "server-only";

import { z } from "zod";
import { DomainError } from "@/lib/errors/domainError";
import { evaluateRuntimePolicy, runtimeModeLabel, type RuntimeMode } from "@/lib/config/runtimePolicy";

const serverEnvironmentSchema = z.object({
  APP_RUNTIME_MODE: z.enum(["staging", "production"]),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  ATTENDANCE_EXIT_SECRET: z.string().min(32),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

function runtimeInput() {
  return {
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
  };
}

export function getRuntimePolicy() {
  return evaluateRuntimePolicy(runtimeInput());
}

export function requireRuntimeMode(): RuntimeMode {
  const policy = getRuntimePolicy();
  if (!policy.ok) {
    console.error("Runtime configuration rejected", { mode: policy.mode, errors: policy.errors });
    throw new DomainError("DATABASE_ERROR", "서버 실행 모드가 안전하게 구성되지 않았습니다.", 503);
  }
  return policy.mode;
}

export function isMockRuntime() {
  return requireRuntimeMode() === "mock";
}

export function runtimeDisplayState() {
  const policy = getRuntimePolicy();
  return { mode: policy.mode, label: runtimeModeLabel(policy), valid: policy.ok, usesMockData: policy.ok && policy.usesMockData };
}

export function getServerEnvironment(): ServerEnvironment | null {
  const mode = requireRuntimeMode();
  if (mode === "mock" || mode === "postgres-test") return null;
  const parsed = serverEnvironmentSchema.safeParse({
    APP_RUNTIME_MODE: mode,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_BASE_URL: process.env.APP_BASE_URL,
    ATTENDANCE_EXIT_SECRET: process.env.ATTENDANCE_EXIT_SECRET,
  });

  if (!parsed.success) throw new DomainError("DATABASE_ERROR", "Supabase 서버 설정이 올바르지 않습니다.", 503);
  return parsed.data;
}

export function isSupabaseConfigured() {
  const mode = requireRuntimeMode();
  return mode === "staging" || mode === "production";
}

export function isPostgresTestRuntime() {
  return requireRuntimeMode() === "postgres-test";
}

export function usesPersistentStorage() {
  return requireRuntimeMode() !== "mock";
}
