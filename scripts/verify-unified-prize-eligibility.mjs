import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";

// Verify 2 eligible groups unioned and deduplicated, no voting-only IDs.
function simulate(general, audienceActive, audienceExited, votesOnly, count) {
  const pool = [...new Set([...general, ...audienceActive])];
  assert(pool.every(p => !audienceExited.includes(p) || general.includes(p)));
  assert(pool.every(p => !votesOnly.includes(p) || general.includes(p) || audienceActive.includes(p)));
  const winners=[];
  while(winners.length<count && pool.length) winners.push(pool.splice(randomInt(pool.length),1)[0]);
  return { winners, remaining:pool.length };
}
function ids(prefix,n){return Array.from({length:n},(_,i)=>`${prefix}${String(i+1).padStart(4,"0")}`)}
const general=ids("#",100), audience=ids("AUD-",120);
const overlap=[general[0],general[1],general[2]];
const result=simulate(general,[...audience,...overlap],ids("EXIT-",8),ids("VOT-",20),1000);
assert.equal(result.winners.length,220);
assert.equal(new Set(result.winners).size,220);
assert.equal(result.remaining,0);
console.log("PASS: 100 general + 120 audience + 3 cross-group repeats = 220 unique winners");
for (const n of [120,241]) {
  const r=simulate(ids("G-",n), [], [], [], n);
  assert.equal(new Set(r.winners).size,n);
  assert.equal(r.remaining,0);
  console.log(`PASS: ${n} checked-in candidates, no repeats, exhausted after ${n} draws`);
}
const sql=readFileSync("supabase/migrations/018_unified_prize_eligibility.sql","utf8");
const mock=readFileSync("lib/repositories/mockPrizeRepository.ts","utf8");
const attendance=readFileSync("lib/repositories/mockCheckInRepository.ts","utf8");
assert.match(sql,/audience_attendance_sessions/);
assert.match(sql,/check_ins/);
assert.match(sql,/a\.exited_at is null/);
assert.match(sql,/prize_draws d/);
assert.match(sql,/pg_advisory_xact_lock/);
assert.match(mock,/getMockPrizeEligibleParticipantIds/);
assert.match(attendance,/new Set\(/);
console.log("PASS: both real attendance sources, active check, winner exclusion, lock, mock union present");
console.log("NOTE: This is a local simulation/static audit, not a Supabase integration test.");
