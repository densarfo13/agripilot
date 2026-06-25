/**
 * check-farmbrain-scan-ingestion.mjs — P0 §9.
 *
 * Locks the safe-ingestion invariant: a weak scan can NEVER enter FarmBrain.
 * The ingestion gate must require plant-known + confidence ≥ 70 + trust +
 * provider auth + photo quality, and the scan chokepoint must GATE the
 * FarmBrain dispatch on that decision (no unconditional ingest).
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(); const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ENG = 'src/runtime/farmBrain/FarmBrainScanIngestion.ts';
const CON = 'src/runtime/farmBrain/FarmBrainScanContracts.ts';
for (const f of [ENG, CON]) if (!x(f)) E.push('missing: ' + f);

const c = rd(CON);
h(c, 'FARMBRAIN_INGEST_CONFIDENCE_MIN_PCT', 'contract must define the 70% confidence floor');
if (!/FARMBRAIN_INGEST_CONFIDENCE_MIN_PCT\s*=\s*70/.test(c)) E.push('confidence floor must be 70');

const e = rd(ENG);
h(e, 'export function evaluateFarmBrainIngestion', 'must export evaluateFarmBrainIngestion');
h(e, '__farmBrainIngestionHealth', 'must pin window.__farmBrainIngestionHealth');
for (const b of ['plant_unknown', 'confidence_below_70', 'trust_gate_failed',
  'provider_auth_failed', 'photo_quality_failed', 'review_only', 'provider_unavailable'])
  h(e, b, 'ingestion must block on: ' + b);

// The scan chokepoint must gate the dispatch on shouldIngest (no unconditional).
const SCAN = rd('src/core/scanDetectionEngine.js');
h(SCAN, 'decideFarmBrainIngestion', 'scan engine must call the ingestion gate');
h(SCAN, 'ingest.shouldIngest', 'FarmBrain dispatch must be gated on shouldIngest');
// Guard against a regression to an unconditional dispatch.
if (/\n\s*dispatchFarmEvent\('scan'/.test(SCAN) && !/if\s*\(ingest[^)]*shouldIngest\)/.test(SCAN)) {
  E.push('dispatchFarmEvent(scan) must be guarded by an ingest.shouldIngest check');
}

if (E.length) { console.error('[check:farmbrain-scan-ingestion] FAIL — ' + E.length + ' issue(s):'); for (const e2 of E) console.error('  - ' + e2); process.exit(1); }
console.log('[check:farmbrain-scan-ingestion] PASS — weak scans cannot enter FarmBrain; '
  + 'dispatch gated on plant-known + confidence≥70 + trust + auth + photo quality.');
