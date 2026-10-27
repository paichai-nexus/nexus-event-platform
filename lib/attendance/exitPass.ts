import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { requireRuntimeMode } from "@/lib/config/runtime";
import { DomainError } from "@/lib/errors/domainError";

const PASS_LIFETIME_SECONDS = 60;
const globalForExitPass = globalThis as typeof globalThis & { __attendanceExitSecret?: string };

function getSecret() {
  if (process.env.ATTENDANCE_EXIT_SECRET) return process.env.ATTENDANCE_EXIT_SECRET;
  if (requireRuntimeMode() !== "mock") {
    throw new DomainError("DATABASE_ERROR", "퇴장 인증 보안 설정이 누락되었습니다.", 503);
  }
  globalForExitPass.__attendanceExitSecret ??= randomBytes(32).toString("hex");
  return globalForExitPass.__attendanceExitSecret;
}

function signature(purpose: "entry" | "exit", expiresAt: number) {
  return createHmac("sha256", getSecret())
    .update(`attendance-${purpose}:${expiresAt}`)
    .digest("base64url");
}

function createAttendancePass(purpose: "entry" | "exit") {
  const expiresAt = Math.floor(Date.now() / 1000) + PASS_LIFETIME_SECONDS;
  return {
    token: `${expiresAt.toString(36)}.${signature(purpose, expiresAt)}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

function isValidAttendancePass(purpose: "entry" | "exit", token: string | null | undefined) {
  if (!token) return false;
  const [encodedExpiry, suppliedSignature, ...rest] = token.split(".");
  if (!encodedExpiry || !suppliedSignature || rest.length) return false;

  const expiresAt = Number.parseInt(encodedExpiry, 36);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(expiresAt) || expiresAt < now || expiresAt > now + PASS_LIFETIME_SECONDS + 5) return false;

  const expected = Buffer.from(signature(purpose, expiresAt));
  const supplied = Buffer.from(suppliedSignature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function createAttendanceEntryPass() {
  return createAttendancePass("entry");
}

export function createAttendanceExitPass() {
  return createAttendancePass("exit");
}

export function isValidAttendanceEntryPass(token: string | null | undefined) {
  return isValidAttendancePass("entry", token);
}

export function isValidAttendanceExitPass(token: string | null | undefined) {
  return isValidAttendancePass("exit", token);
}
