/**
 * check-scan-terminal-state.mjs — locks the canonical scan terminal-state machine:
 * every scan resolves to one of the 11 states (never a dead-end) and the safety lock
 * (only confident success may mutate farm) holds. Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const SRC = 'src/runtime/scan/resolveScanTerminalState.ts';
const TEST = 'src/runtime/scan/__tests__/resolveScanTerminalState.test.ts';
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const src = rd(SRC);
if (!src) E.push('missing: ' + SRC);
for (const s of ['SUCCESS_IDENTIFIED','SUCCESS_HEALTH_ISSUE','BAD_IMAGE','NO_PLANT_DETECTED','LOW_CONFIDENCE',
  'PROVIDER_UNAVAILABLE','AUTH_FAILED','RATE_LIMITED','UPLOAD_FAILED','QUEUED_FOR_REVIEW','SAVED_FOR_RETRY'])
  if (!src.includes(s)) E.push('terminal state missing: ' + s);
if (!/mayMutateFarm/.test(src)) E.push('safety lock (mayMutateFarm) missing');
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
    if (!/PASS/.test(out)) E.push('test did not PASS: ' + out.trim());
  } catch (err) { E.push('test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}
if (E.length) { console.error('[check:scan-terminal-state] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-terminal-state] PASS — 11 terminal states + safety lock; every scan resolves, never a dead-end; test green.');
