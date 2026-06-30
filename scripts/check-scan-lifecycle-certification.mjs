/**
 * check-scan-lifecycle-certification.mjs — locks the automatic scan-pipeline certification ladder
 * + its honesty invariant: PRODUCTION_CERTIFIED is impossible without real volume + measured
 * accuracy. Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const ENG = 'src/runtime/scan/certification/scanLifecycleCertification.ts';
const TEST = 'src/runtime/scan/certification/__tests__/scanLifecycleCertification.test.ts';
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
for (const f of [ENG, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);
const eng = rd(ENG);
if (!/export function certifyScanLifecycle/.test(eng)) E.push('must export certifyScanLifecycle');
for (const s of ['DEVELOPMENT', 'PILOT', 'STAGING', 'PRODUCTION_CERTIFIED'])
  if (!eng.includes(s)) E.push('lifecycle missing state: ' + s);
// Honesty lock: the engine must gate on volume + verifiedAccuracy (no certify on absent data).
if (!/verifiedAccuracy/.test(eng)) E.push('must require verifiedAccuracy for PRODUCTION_CERTIFIED');
if (!/volume <= 0/.test(eng)) E.push('must floor zero-volume to DEVELOPMENT');
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('test did not PASS: ' + out.trim());
  } catch (err) { E.push('test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}
if (E.length) { console.error('[check:scan-lifecycle-certification] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-lifecycle-certification] PASS — automatic DEVELOPMENT→PILOT→STAGING→PRODUCTION_CERTIFIED '
  + 'ladder from real metrics; zero-volume/unverified-accuracy can never certify; test green.');
