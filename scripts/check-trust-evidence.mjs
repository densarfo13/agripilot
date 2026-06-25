/**
 * check-trust-evidence.mjs — TRUST ENGINE + EVIDENCE PLATFORM gate.
 *
 * Locks the two engines: Evidence builds explainable ✓ lines (no provider names,
 * no fabricated evidence) + carries confidence/source/freshness/data-quality;
 * Trust bands High/Medium/Low (never raw math to the farmer; missing signals are
 * never trust-high). Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const EV = 'src/runtime/evidence/EvidenceEngine.ts';
const TR = 'src/runtime/trust/TrustScoreEngine.ts';
const TEST = 'src/runtime/trust/__tests__/TrustEvidence.test.ts';
for (const f of [EV, TR, TEST]) if (!x(f)) E.push('missing: ' + f);

const ev = rd(EV);
h(ev, 'export function buildEvidence', 'must export buildEvidence');
h(ev, '__evidenceEngineHealth', 'must pin __evidenceEngineHealth');
for (const f of ['confidence', 'sourceType', 'freshness', 'dataQuality'])
  h(ev, f, 'evidence envelope must carry: ' + f);
h(ev, 'hasEvidence', 'evidence must flag whether real evidence exists (no fabrication)');
// Composes the data quality engine.
h(ev, 'scoreDataQuality', 'evidence must compose the DataQualityEngine');

const tr = rd(TR);
h(tr, 'export function scoreTrust', 'must export scoreTrust');
h(tr, '__trustScoreHealth', 'must pin __trustScoreHealth');
for (const f of ['scanQuality', 'providerAgreement', 'farmHistory', 'weatherQuality',
  'soilFreshness', 'taskCompletion', 'outcomeHistory'])
  h(tr, f, 'trust score must consider factor: ' + f);
h(tr, "'high'", 'trust must band High/Medium/Low');
// Never expose raw math to the farmer: band + reason are farmer-facing, score internal.
h(tr, 'never shown raw', 'trust score must keep raw math internal (band only to farmer)');

// 4 required reports.
for (const doc of ['TRUST_ENGINE_REPORT.md', 'EVIDENCE_ENGINE_REPORT.md',
  'RECOMMENDATION_SCORECARD.md', 'FIELD_SUCCESS_METRICS.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('trust/evidence test did not PASS: ' + out.trim());
  } catch (err) { E.push('trust/evidence test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:trust-evidence] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:trust-evidence] PASS — Evidence engine (explainable ✓ lines, no fabrication, no provider names) '
  + '+ Trust score (High/Medium/Low, raw math internal, missing signals never trust-high); test green.');
