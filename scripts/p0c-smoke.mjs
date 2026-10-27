#!/usr/bin/env node
// P0-C read-only operational smoke check. No authentication secrets or writes.
const baseArg = process.argv.find((arg) => arg.startsWith('--base-url='));
const base = baseArg?.slice('--base-url='.length) ?? process.env.P0C_BASE_URL;
if (!base) {
  console.error('Usage: node scripts/p0c-smoke.mjs --base-url=http://127.0.0.1:3137');
  process.exit(2);
}
let origin;
try {
  const parsed = new URL(base);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error();
  origin = parsed.origin;
} catch {
  console.error('Invalid base URL: provide a plain HTTP(S) origin without credentials or path.');
  process.exit(2);
}
const allowRemote = process.env.P0C_ALLOW_REMOTE === 'true';
const host = new URL(origin).hostname;
if (!allowRemote && !['127.0.0.1','localhost','::1','[::1]'].includes(host)) {
  console.error('BLOCKED: remote hosts require P0C_ALLOW_REMOTE=true; no requests were sent.');
  process.exit(2);
}
const expectedMode = process.env.P0C_EXPECT_MODE ?? 'staging';
const errors = [];
const ok = (condition, label, detail='') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}: ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) errors.push(label);
};
async function request(path) {
  const url = new URL(path, origin);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'manual', cache: 'no-store', headers: { accept: 'application/json' }, signal: controller.signal });
    const body = await response.json().catch(() => null);
    return { status: response.status, body, headers: response.headers };
  } finally {
    clearTimeout(timeout);
  }
}
try {
  const readiness = await request('/api/health/readiness');
  ok(readiness.status === 200 && readiness.body?.ok === true && readiness.body?.status === 'READY' && readiness.body?.mode === expectedMode,
    'readiness', `HTTP ${readiness.status}; mode=${readiness.body?.mode ?? 'unknown'}`);
  const snapshot = await request('/api/event/public-snapshot');
  ok(snapshot.status === 200 && snapshot.body?.ok === true && typeof snapshot.body?.data === 'object' && snapshot.body.data !== null,
    'public snapshot', `HTTP ${snapshot.status}`);
  const serialized = JSON.stringify(snapshot.body ?? {});
  ok(!/("judgeProgress"|"checkIns"|"access_token_hash"|"service_role")\s*:/.test(serialized), 'public snapshot excludes private fields');
  const restricted = await request('/api/event/snapshot');
  ok([401,403].includes(restricted.status), 'admin snapshot rejects unauthenticated request', `HTTP ${restricted.status}`);
} catch (error) {
  errors.push('network/request');
  console.error(`FAIL: request error: ${error instanceof Error ? error.message : String(error)}`);
}
if (errors.length) {
  console.error(`SMOKE FAILED: ${errors.length} check(s) failed; no writes attempted.`);
  process.exitCode = 1;
} else {
  console.log('SMOKE PASS: read-only operational endpoints verified.');
}
