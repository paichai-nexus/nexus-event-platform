#!/usr/bin/env node
// Read-only role matrix. The simulated actor mode MUST only target a local
// postgres-test server, never a staging/production Supabase deployment.
const arg = (name) => process.argv.find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3);
const rawBase = arg('base-url') ?? process.env.P0C_ROLE_BASE_URL;
const mode = arg('mode') ?? 'unauthenticated';
const secret = process.env.P0B_TEST_AUTH_SECRET;
const eventId = arg('event-id') ?? '00000000-0000-4000-8000-000000000100';
const adminId = '00000000-0000-4000-8000-000000009001';
const judgeId = '00000000-0000-4000-8000-000000009101';
function fail(message, code = 2) { console.error(`BLOCKED: ${message}`); process.exit(code); }
if (!rawBase) fail('Provide --base-url=http://127.0.0.1:PORT');
let base;
try {
  const url = new URL(rawBase);
  if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !['127.0.0.1','localhost','[::1]','::1'].includes(url.hostname)) throw Error();
  base = url.origin;
} catch { fail('Only plain local HTTP origins are allowed.'); }
if (!['unauthenticated','postgres-test'].includes(mode)) fail('mode must be unauthenticated or postgres-test');
if (mode === 'postgres-test' && (!secret || secret.length < 16)) fail('P0B_TEST_AUTH_SECRET (16+ chars) required for isolated postgres-test mode');
const checks = [];
async function get(path, headers={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const result = await fetch(new URL(path, base), {method:'GET',redirect:'manual',cache:'no-store',headers:{accept:'application/json', ...headers},signal:controller.signal});
    const body = await result.json().catch(()=>null);
    return {status:result.status,body};
  } finally {clearTimeout(timer)}
}
function check(name, got, allowed) {
  const pass = allowed.includes(got.status) && (got.status !== 200 || got.body?.ok === true);
  checks.push(pass);
  console.log(`${pass?'PASS':'FAIL'}: ${name} (HTTP ${got.status}; expected ${allowed.join('/')})`);
}
function actor(userId) {return {'x-p0b-test-secret':secret,'x-p0b-test-user':userId};}
try {
  const ready = await get('/api/health/readiness');
  const expectedMode = mode === 'postgres-test' ? 'postgres-test':'staging';
  if (ready.status !== 200 || ready.body?.mode !== expectedMode || ready.body?.status !== 'READY') fail(`unexpected runtime: HTTP ${ready.status}, mode=${ready.body?.mode ?? 'unknown'}; expected ${expectedMode}`,1);
  const paths = [
    ['/api/event/snapshot','admin snapshot'],
    [`/api/prizes?eventId=${eventId}`,'prize history'],
    [`/api/judging?eventId=${eventId}`,'judge progress'],
    [`/api/judging?view=workspace&eventId=${eventId}`,'judge workspace'],
  ];
  for (const [path,name] of paths) check(`anonymous ${name}`,await get(path),[401,403]);
  if (mode === 'postgres-test') {
    const matrix = [
      [adminId,'ADMIN',[[0,[200]],[1,[200]],[2,[200]],[3,[403]]]],
      [judgeId,'JUDGE',[[0,[403]],[1,[403]],[2,[403]],[3,[200]]]],
    ];
    for (const [id,role, cases] of matrix) for (const [idx,statuses] of cases) {
      const [path,name] = paths[idx];
      check(`${role} ${name}`,await get(path,actor(id)),statuses);
    }
  }
} catch(e) {console.error(`FAIL: ${e instanceof Error?e.message:String(e)}`);process.exit(1)}
if (checks.some(x=>!x)) process.exit(1);
console.log(`ROLE CHECK PASS: ${checks.length} read-only authorization checks (${mode}).`);
