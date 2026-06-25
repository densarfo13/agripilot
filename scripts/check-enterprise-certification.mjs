/**
 * check-enterprise-certification.mjs — FARROWAY ENTERPRISE CERTIFICATION gate.
 *
 * Locks the two NEW quality engines (Phase 2 Data Quality, Phase 3 Decision
 * Quality) + the 13-phase umbrella: verdict COMPUTED (never hardcoded to a ready
 * tier), business honest_null (no fabricated market/funding), field evidence
 * PENDING, no fabricated accuracy/adoption %. Runs the verdict test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const DQ = 'src/runtime/quality/DataQualityEngine.ts';
const DECQ = 'src/runtime/quality/DecisionQualityEngine.ts';
const ENT = 'src/runtime/quality/EnterpriseCertificationRuntime.ts';
const TEST = 'src/runtime/quality/__tests__/EnterpriseCertification.test.ts';
for (const f of [DQ, DECQ, ENT, TEST]) if (!x(f)) E.push('missing: ' + f);

// Phase 2 — data quality: 4 dimensions + low→rescan.
const dq = rd(DQ);
for (const dim of ['completeness', 'freshness', 'consistency', 'confidence'])
  h(dq, dim, 'data quality must score: ' + dim);
h(dq, 'recommendNextScan', 'data quality must recommend a rescan when low');
h(dq, '__dataQualityHealth', 'must pin __dataQualityHealth');

// Phase 3 — decision quality: rejects weak.
const decq = rd(DECQ);
h(decq, 'export function assessDecisionQuality', 'must export assessDecisionQuality');
h(decq, 'export function rejectWeakRecommendations', 'must reject weak recommendations');
h(decq, 'notGeneric', 'must reject generic recommendations');
h(decq, '__decisionQualityHealth', 'must pin __decisionQualityHealth');

// 13-phase umbrella.
const ent = rd(ENT);
h(ent, 'export function certifyEnterprise', 'must export certifyEnterprise');
h(ent, '__enterpriseCertificationHealth', 'must pin __enterpriseCertificationHealth');
h(ent, "n: 13", 'must assess all 13 phases');
h(ent, "status: 'honest_null'", 'business engine (Phase 8) must be honest_null (no fabrication)');
h(ent, "liveFieldEvidence: 'PENDING'", 'live field evidence must be PENDING (never fabricated)');
if (/verdict:\s*'READY_FOR_(NATIONAL|GLOBAL|1000)/.test(ent))
  E.push('verdict must be computed, not hardcoded to a ready tier');
if (/(accuracy|adoption)[^\n]*\b\d{2,3}\s*%/i.test(ent))
  E.push('no fabricated accuracy/adoption percentage in the certification');

// 6 required reports.
for (const doc of ['ENTERPRISE_CERTIFICATION.md', 'SCAN_CERTIFICATION.md',
  'RECOMMENDATION_QUALITY_REPORT.md', 'DATA_QUALITY_REPORT.md',
  'FIELD_VALIDATION_PLAN.md', 'FINAL_RELEASE_SCORECARD.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('enterprise test did not PASS: ' + out.trim());
  } catch (err) { E.push('enterprise test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:enterprise-certification] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:enterprise-certification] PASS — Data + Decision Quality engines; 13-phase verdict computed; '
  + 'business honest_null; field evidence PENDING (not faked); 6 reports; test green.');
