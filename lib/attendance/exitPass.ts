import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PASS_LIFETIME_SECONDS = 60;
const globalForExitPass = globalThis as typeof globalThis & { __attendanceExitSecret?: string };

function getSecret() {
  if (process.env.ATTENDANCE_EXIT_SECRET) return process.env.ATTENDANCE_EXIT_SECRET;
  globalForExitPass.__attendanceExitSecret ??= randomBytes(32).toString("hex");
  return globalForExitPass.__attendanceExitSecret;
}

function signature(expiresAt: number) {
  return createHmac("sha256", getSecret())
    .update(`attendance-exit:${expiresAt}`)
    .digest("base64url");
}

export function createAttendanceExitPass() {
  const expiresAt = Math.floor(Date.now() / 1000) + PASS_LIFETIME_SECONDS;
  return {
    token: `${expiresAt.toString(36)}.${signature(expiresAt)}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function isValidAttendanceExitPass(token: string | null | undefined) {
  if (!token) return false;
  const [encodedExpiry, suppliedSignature, ...rest] = token.split(".");
  if (!encodedExpiry || !suppliedSignature || rest.length) return false;

  const expiresAt = Number.parseInt(encodedExpiry, 36);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(expiresAt) || expiresAt < now || expiresAt > now + PASS_LIFETIME_SECONDS + 5) return false;

  const expected = Buffer.from(signature(expiresAt));
  const supplied = Buffer.from(suppliedSignature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
