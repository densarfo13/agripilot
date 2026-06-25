/**
 * check-farmbrain-x.mjs — FarmBrain X certification gate.
 *
 * Locks the certification composite: all 15 sections enumerated, the verdict
 * COMPUTED (not a hardcoded string), market/funding honestly honest_null, the
 * §4 recommendation fields present, and the certification doc shipped. Runs the
 * verdict-logic test so CI exercises it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const RT = 'src/runtime/farmBrain/FarmBrainXRuntime.ts';
const TEST = 'src/runtime/farmBrain/__tests__/FarmBrainX.test.ts';
const REPORT = 'FARMBRAIN_X_CERTIFICATION.md';
for (const f of [RT, TEST, REPORT]) if (!x(f)) E.push('missing: ' + f);

const rt = rd(RT);
h(rt, 'export function certifyFarmBrainX', 'must export certifyFarmBrainX');
h(rt, '__farmBrainXHealth', 'must pin window.__farmBrainXHealth');
h(rt, 'singleSourceOfTruth: true', 'must attest FarmBrain as single source of truth');
// All 15 sections enumerated.
for (let n = 1; n <= 15; n++) {
  if (!new RegExp('n:\\s*' + n + '\\b').test(rt)) E.push('section ' + n + ' missing from the manifest');
}
// Market + funding must be honest_null (never certified ready without a feed).
if (!/Market Engine'[^}]*honest_null/s.test(rt)) E.push('Market Engine must be honest_null (no live feed)');
if (!/Funding Engine'[^}]*honest_null/s.test(rt)) E.push('Funding Engine must be honest_null (no live feed)');
// Verdict must be computed, not a hardcoded literal verdict.
if (/verdict:\s*'READY_FOR_SCALE'/.test(rt) || /verdict:\s*'READY_FOR_100_FARMERS'/.test(rt))
  E.push('verdict must be computed by certifyFarmBrainX, not hardcoded');

// §4 recommendation fields present in the contract.
const C = rd('src/runtime/farmBrain/FarmBrainStateContracts.ts');
for (const f of ['cost', 'risk', 'nextReviewDate']) h(C, f, 'Recommendation must carry §4 field: ' + f);

// Run the verdict-logic test.
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('verdict test did not PASS: ' + out.trim());
  } catch (err) {
    E.push('verdict test failed: ' + ((err && (err.stdout || err.message)) || 'unknown'));
  }
}

if (E.length) {
  console.error('[check:farmbrain-x] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:farmbrain-x] PASS — 15 sections certified; verdict computed; market/funding honest_null; '
  + '§4 recommendation fields; verdict test green.');
