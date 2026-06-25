/**
 * check-pilot-certification.mjs — FARROWAY PILOT CERTIFICATION v1.0 gate.
 *
 * Locks the umbrella certification: composes the real scan certification, the
 * verdict is COMPUTED (never hardcoded to READY_FOR_*), live field evidence is
 * PENDING (never fabricated), feature freeze is attested, and the 4 certification
 * reports exist. Runs the verdict test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const RT = 'src/runtime/scan/certification/PilotCertificationRuntime.ts';
const TEST = 'src/runtime/scan/certification/__tests__/PilotCertification.test.ts';
for (const f of [RT, TEST]) if (!x(f)) E.push('missing: ' + f);
const rt = rd(RT);

h(rt, 'scanCertificationHealth', 'must compose the real scan certification');
h(rt, 'export function certifyPilot', 'must export certifyPilot');
h(rt, '__pilotCertificationHealth', 'must pin the health global');
h(rt, 'featureFreeze: true', 'must attest the feature freeze (mission)');
h(rt, "liveFieldEvidence: 'PENDING'", 'live field evidence must be PENDING (never fabricated)');

// Verdict must be computed, not hardcoded to a ready tier.
if (/verdict:\s*'READY_FOR_(100|1000)_FARMERS'/.test(rt))
  E.push('verdict must be computed by certifyPilot, not hardcoded READY_FOR_*');
// No fabricated accuracy/adoption numbers.
if (/(accuracy|adoption|DAU|WAU)[^\n]*\b\d{2,3}\s*%/i.test(rt))
  E.push('no fabricated accuracy/adoption percentage may appear in the certification');

// The 4 required certification reports exist.
for (const doc of ['PILOT_CERTIFICATION.md', 'FARMBRAIN_CERTIFICATION.md',
  'PROVIDER_SCORECARD.md', 'FIELD_VALIDATION.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('pilot certification test did not PASS: ' + out.trim());
  } catch (err) { E.push('pilot certification test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:pilot-certification] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:pilot-certification] PASS — 8-phase umbrella; verdict computed; feature freeze; '
  + 'live field evidence PENDING (not faked); 4 reports present; test green.');
