#!/usr/bin/env node
// Static, read-only diagnostic. This does not call APIs or alter data.
import { readFileSync } from 'node:fs';

const context = readFileSync('features/event/context/EventOpsProvider.tsx','utf8');
const results = readFileSync('app/admin/results/page.tsx','utf8');
const errors = [];
if (!results.includes('calculateScoreRows(state.scoreInputs)')) errors.push('Results UI no longer uses expected scoreInputs binding; manual review required');
const hydration = context.match(/case "HYDRATE_SERVER_STATE":([\s\S]*?)case "SNAPSHOT_FAILED":/);
if (!hydration) errors.push('Could not inspect HYDRATE_SERVER_STATE');
const updatesInputs = hydration && /scoreInputs\s*:/.test(hydration[1]);
console.log(`RESULTS UI scoreInputs binding: ${results.includes('calculateScoreRows(state.scoreInputs)') ? 'FOUND' : 'UNKNOWN'}`);
console.log(`Server hydration updates scoreInputs: ${updatesInputs ? 'YES' : 'NO'}`);
if (!updatesInputs) console.log('GAP: actual persisted vote/judge data has no confirmed path into FINAL RESULT through server hydration. Do not claim end-to-end scoring is ready.');
for (const e of errors) console.error('ERROR:', e);
if (errors.length) process.exitCode=2;
