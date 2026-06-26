/**
 * check-evidence-tier.mjs — Scan Intelligence evidence-tier gate.
 *
 * Locks the honest contract: 6 tiers; the validated models (crop calendar, live
 * weather, soil provider) produce REAL estimated/live values; CV fields stay
 * awaiting_model with null values (never fabricated); lab fields are LAB_REQUIRED
 * and never estimated. Runs the 180+ assertion test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ENG = 'src/runtime/scan/evidence/EvidenceTierEngine.ts';
const TEST = 'src/runtime/scan/evidence/__tests__/EvidenceTier.test.ts';
for (const f of [ENG, TEST]) if (!x(f)) E.push('missing: ' + f);
const eng = rd(ENG);

h(eng, 'export function evaluateField', 'must export evaluateField');
h(eng, 'export function classifyFieldTier', 'must export classifyFieldTier');
h(eng, '__evidenceTierHealth', 'must pin the health global');
// All 6 tiers present.
for (const t of ['DIRECT_MEASURED', 'MODEL_ESTIMATED', 'FUSED_ESTIMATE', 'LIVE_PROVIDER', 'LAB_REQUIRED', 'UNKNOWN'])
  h(eng, "'" + t + "'", 'must define tier: ' + t);
// The full field record shape.
for (const k of ['tier', 'status', 'value', 'confidence', 'source', 'reason', 'estimated', 'lastUpdated'])
  h(eng, k, 'field record must include: ' + k);
// Composes the REAL validated models (not invented ones).
h(eng, 'computeLifecycleSnapshot', 'MODEL_ESTIMATED calendar fields must compose the real crop calendar');
h(eng, 'WeatherRisk', 'LIVE_PROVIDER weather fields must compose the real weather engine');
// rec() must null confidence/lastUpdated when value is null (no value → no metadata).
h(eng, 'value == null ? null', 'a null value must carry null confidence + lastUpdated');
// No fabricated numeric literal assigned to a CV/lab field path.
if (/(fruitCount|leafDamagePct|nitrogen|phosphorus|healthScore)\s*[:=]\s*\d{1,4}\b/.test(eng))
  E.push('a CV/lab field must not be given a literal numeric value');

// 3 reports.
for (const doc of ['EVIDENCE_ENGINE.md', 'SCAN_STATUS_MATRIX.md', 'CV_ESTIMATION_RULES.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('evidence-tier test did not PASS: ' + out.trim());
  } catch (err) { E.push('evidence-tier test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:evidence-tier] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:evidence-tier] PASS — 6 evidence tiers; calendar/weather/soil produce real estimated/live values; '
  + 'CV awaiting_model + lab LAB_REQUIRED never fabricated; value only with real metadata; test green.');
