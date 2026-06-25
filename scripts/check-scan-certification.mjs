/**
 * check-scan-certification.mjs — Scan Acceptance & FarmBrain Certification gate.
 *
 * Locks the HONEST certification: deterministic safety is certified by running
 * the REAL ingestion gate + classifier; live crop-photo provider accuracy is
 * reported PENDING (never a fabricated number); Sentinel Hub is NOT_INTEGRATED;
 * the verdict is computed, not hardcoded to PRODUCTION_READY from the sandbox.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const RT = 'src/runtime/scan/certification/ScanCertificationRuntime.ts';
const TEST = 'src/runtime/scan/certification/__tests__/ScanCertification.test.ts';
for (const f of [RT, TEST]) if (!x(f)) E.push('missing: ' + f);
const rt = rd(RT);

h(rt, 'runSafetyCertifications', 'must run deterministic safety certifications');
h(rt, 'evaluateFarmBrainIngestion', 'must use the REAL ingestion gate (no mock)');
h(rt, 'classifyAgriculturalObject', 'must use the REAL classifier (no mock)');
h(rt, "'PENDING_OPERATOR_RUN'", 'live provider accuracy must be PENDING (never fabricated)');
h(rt, "'NOT_INTEGRATED'", 'Sentinel Hub must be reported NOT_INTEGRATED');
h(rt, '__scanCertificationHealth', 'must pin the health global');

// The verdict must be COMPUTED, never hardcoded to PRODUCTION_READY.
if (/overall:\s*'PRODUCTION_READY'/.test(rt))
  E.push('overall verdict must be computed, not hardcoded PRODUCTION_READY');

// No fabricated accuracy percentages in the certification source.
if (/(accuracy|identified|confidence)[^\n]*\b(8[0-9]|9[0-9]|100)\s*%/i.test(rt))
  E.push('no fabricated accuracy/confidence percentage may appear in the certification');

// The live-photo harness exists (the operator's real run).
if (!x('scripts/run-scan-acceptance.mjs')) E.push('missing live-photo harness: scripts/run-scan-acceptance.mjs');

// The 4 required reports exist.
for (const doc of ['SCAN_CERTIFICATION_REPORT.md', 'PROVIDER_SCORECARD.md',
  'FARMBRAIN_VALIDATION.md', 'PRODUCTION_READINESS.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

// Run the deterministic certification test.
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('certification test did not PASS: ' + out.trim());
  } catch (err) { E.push('certification test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:scan-certification] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-certification] PASS — deterministic safety certified (real ingestion+classifier); '
  + 'live accuracy PENDING (not faked); Sentinel NOT_INTEGRATED; verdict computed; 4 reports present.');
