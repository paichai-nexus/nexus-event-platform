import "server-only";

import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { DomainError } from "@/lib/errors/domainError";
import { requireRuntimeMode } from "@/lib/config/runtime";
import type { StaffRole } from "@/lib/auth/roles";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DatabaseAccess =
  | { role: "superuser" }
  | { role: "service_role" }
  | { role: "authenticated"; userId: string };

function configuration() {
  if (requireRuntimeMode() !== "postgres-test") {
    throw new DomainError("DATABASE_ERROR", "PostgreSQL 통합 테스트 모드가 아닙니다.", 503);
  }
  const databaseUrl = process.env.P0B_POSTGRES_URL;
  const authSecret = process.env.P0B_TEST_AUTH_SECRET;
  if (!databaseUrl || !authSecret) {
    throw new DomainError("DATABASE_ERROR", "PostgreSQL 통합 테스트 설정이 누락되었습니다.", 503);
  }
  const parsed = new URL(databaseUrl);
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) || !parsed.pathname.slice(1).startsWith("nexus_p0b_")) {
    throw new DomainError("DATABASE_ERROR", "격리된 P0-B 데이터베이스만 사용할 수 있습니다.", 503);
  }
  return {
    databaseUrl,
    authSecret,
    psqlPath: process.env.P0B_PSQL_PATH || "/opt/homebrew/opt/postgresql@17/bin/psql",
  };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function accessPrelude(access: DatabaseAccess) {
  if (access.role === "superuser") return "";
  if (access.role === "service_role") return "set local role service_role;";
  if (!uuidPattern.test(access.userId)) throw new DomainError("UNAUTHORIZED", "테스트 사용자 식별자가 올바르지 않습니다.", 401);
  return `select set_config('request.jwt.claim.sub', :'p0b_actor_id', true); set local role authenticated;`;
}

export async function runPostgresTestJson<T>(
  statement: string,
  variables: Record<string, string | number | null> = {},
  access: DatabaseAccess = { role: "superuser" },
): Promise<T> {
  return executePostgresTestJson(statement, variables, access, false);
}

/**
 * Read-only P0-B/P0-C HTTP integration query. The caller supplies the already
 * authorized actor so PostgreSQL evaluates the query as `authenticated` with
 * the same auth.uid() used by Supabase RLS.
 */
export async function runPostgresTestReadJson<T>(
  statement: string,
  variables: Record<string, string | number | null>,
  userId: string,
): Promise<T> {
  return executePostgresTestJson(statement, variables, { role: "authenticated", userId }, true);
}

async function executePostgresTestJson<T>(
  statement: string,
  variables: Record<string, string | number | null>,
  access: DatabaseAccess,
  readOnly: boolean,
): Promise<T> {
  const config = configuration();
  const args = [config.databaseUrl, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"];
  const allVariables = access.role === "authenticated" ? { ...variables, p0b_actor_id: access.userId } : variables;
  for (const [name, value] of Object.entries(allVariables)) {
    if (!/^[a-z][a-z0-9_]*$/i.test(name)) throw new Error(`Unsafe psql variable name: ${name}`);
    args.push("-v", `${name}=${value ?? ""}`);
  }
  const sql = `begin; ${readOnly ? "set transaction read only;" : ""} ${accessPrelude(access)} ${statement} commit;`;

  try {
    const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(config.psqlPath, args, { stdio: ["pipe", "pipe", "pipe"] });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let outputSize = 0;
      const append = (chunks: Buffer[], chunk: Buffer) => {
        outputSize += chunk.length;
        if (outputSize > 4 * 1024 * 1024) {
          child.kill();
          reject(new Error("PostgreSQL integration output exceeded 4 MiB."));
          return;
        }
        chunks.push(chunk);
      };
      child.stdout.on("data", (chunk: Buffer) => append(stdoutChunks, chunk));
      child.stderr.on("data", (chunk: Buffer) => append(stderrChunks, chunk));
      child.on("error", reject);
      child.on("close", (code) => {
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        if (code === 0) resolve({ stdout, stderr });
        else reject(Object.assign(new Error(`psql exited with code ${code}`), { stdout, stderr }));
      });
      child.stdin.end(sql);
    });
    const line = stdout.split("\n").map((value) => value.trim()).filter(Boolean).findLast((value) => value === "null" || value.startsWith("{") || value.startsWith("["));
    if (!line) throw new Error(`PostgreSQL integration query did not return JSON. Output: ${JSON.stringify(stdout.trim())}`);
    return JSON.parse(line) as T;
  } catch (error) {
    const processError = error as Error & { stderr?: string; stdout?: string };
    const detail = processError.stderr?.trim() || processError.stdout?.trim() || processError.message || "Unknown PostgreSQL integration error";
    throw new DomainError("DATABASE_ERROR", `격리 PostgreSQL 요청 실패: ${detail}`, 500);
  }
}

export async function getPostgresTestRequestUserId() {
  const requestHeaders = await headers();
  const suppliedSecret = requestHeaders.get("x-p0b-test-secret") ?? "";
  const suppliedUserId = requestHeaders.get("x-p0b-test-user") ?? "";
  const { authSecret } = configuration();
  if (!safeEqual(suppliedSecret, authSecret) || !uuidPattern.test(suppliedUserId)) {
    throw new DomainError("UNAUTHORIZED", "격리 통합 테스트 인증이 필요합니다.", 401);
  }
  return suppliedUserId;
}

export async function authorizePostgresTestActor(allowedRoles: readonly StaffRole[]) {
  const userId = await getPostgresTestRequestUserId();
  const actor = await runPostgresTestJson<{ userId: string; role: StaffRole; active: boolean } | null>(
    `select coalesce(
      (select jsonb_build_object('userId', profile.user_id, 'role', profile.role, 'active', profile.active)::text
       from public.profiles profile where profile.user_id = :'user_id'::uuid),
      'null'
    )::text;`,
    { user_id: userId },
  );
  if (!actor?.active || !allowedRoles.includes(actor.role)) {
    throw new DomainError("FORBIDDEN", "이 작업을 수행할 테스트 권한이 없습니다.", 403);
  }
  return { userId: actor.userId, role: actor.role, mock: false as const };
}

export function postgresRowsJson(query: string) {
  return `select coalesce(jsonb_agg(to_jsonb(p0b_row)), '[]'::jsonb)::text from (${query}) p0b_row;`;
}

export function postgresOneJson(query: string) {
  return `select coalesce((select to_jsonb(p0b_row)::text from (${query}) p0b_row limit 1), 'null');`;
}
