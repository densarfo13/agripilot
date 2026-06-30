/**
 * check-launch-command-center.mjs — locks the pilot go/no-go ladder + its honesty invariant:
 * READY_FOR_1000 / READY_FOR_COMMERCIAL are impossible without real farmer volume + every gate;
 * build-not-green is a hard NOT_READY. Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const ENG = 'src/runtime/pilot/LaunchCommandCenter.ts';
const TEST = 'src/runtime/pilot/__tests__/LaunchCommandCenter.test.ts';
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
for (const f of [ENG, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);
const eng = rd(ENG);
if (!/export function launchGateDecision/.test(eng)) E.push('must export launchGateDecision');
if (!/export function computePilotHealthScore/.test(eng)) E.push('must export computePilotHealthScore');
for (const s of ['NOT_READY', 'PILOT_READY', 'READY_FOR_1000', 'READY_FOR_COMMERCIAL'])
  if (!eng.includes(s)) E.push('ladder missing state: ' + s);
if (!/activeFarmers/.test(eng)) E.push('must gate on real farmer volume (activeFarmers)');
if (!/buildGreen/.test(eng)) E.push('must require build green for release floor');
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('test did not PASS: ' + out.trim());
  } catch (err) { E.push('test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}
if (E.length) { console.error('[check:launch-command-center] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:launch-command-center] PASS — automatic NOT_READY→PILOT_READY→READY_FOR_1000→READY_FOR_COMMERCIAL '
  + 'ladder + 5-component health score; advances only when real-data gates are met; test green.');
