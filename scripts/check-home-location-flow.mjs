/**
 * check-home-location-flow.mjs — Farmer-First Home §1 location flow.
 * Locks: the loading state while detecting + the never-stuck fallback on denied
 * (explanation + "Enter manually" + "Continue with general guidance"), wired into
 * Home with 44px touch targets and tSafe strings. Runs the pure state test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const has = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const STATE = 'src/components/home/locationFlowState.js';
const COMP = 'src/components/home/LocationFlowStatus.jsx';
const TEST = 'src/components/home/__tests__/locationFlowState.test.js';
for (const f of [STATE, COMP, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

const st = rd(STATE);
has(st, 'export function locationFlowView', 'must export locationFlowView');
has(st, "DETECTING", 'must define DETECTING status');
has(st, "DENIED", 'must define DENIED status');

const comp = rd(COMP);
has(comp, 'home-location-loading', 'component must render a loading state while detecting');
has(comp, 'home-location-fallback', 'component must render a fallback on denial');
has(comp, 'home-location-continue', 'fallback must offer "Continue with general guidance" (the anti-stuck path)');
has(comp, 'home-location-manual', 'fallback must offer "Enter manually"');
has(comp, 'tSafe', 'component must use tSafe for strings (localizable)');
if (!/minHeight:\s*44/.test(comp)) E.push('buttons must meet the 44px touch-target guideline');

const home = rd('src/pages/Home.jsx');
has(home, 'LocationFlowStatus', 'Home must render LocationFlowStatus');
has(home, 'LOCATION_STATUS.DETECTING', 'Home must set DETECTING while the GPS request is in flight (loading state)');
has(home, 'LOCATION_STATUS.DENIED', 'Home must set DENIED on permission denied / unavailable (fallback)');
has(home, 'onContinueGeneral', 'Home must wire the continue-with-general-guidance escape hatch');
has(home, 'onEnterManually', 'Home must wire the enter-manually fallback');

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('location-flow test did not PASS: ' + out.trim());
  } catch (err) { E.push('location-flow test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:home-location-flow] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:home-location-flow] PASS — loading state while detecting + never-stuck fallback '
  + '(explain + manual + continue-with-general-guidance) wired into Home; 44px targets; tSafe; test green.');
