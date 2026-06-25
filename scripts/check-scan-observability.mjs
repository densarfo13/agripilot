/**
 * check-scan-observability.mjs — SCAN_OBSERVABILITY_V1.
 * Locks the per-scan observability pipeline: model + migration, server
 * capture/aggregation/CSV, admin endpoints, dashboard card, and the
 * client outcome reporter wired at the task + plant chokepoints.
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(), E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

// Schema model + migration.
const SCHEMA = rd('server/prisma/schema.prisma');
h(SCHEMA, 'model ScanObservabilityEvent', 'schema must define ScanObservabilityEvent');
h(SCHEMA, 'scanId         String   @unique', 'scanId must be @unique (no duplicate rows)');
for (const f of ['photoQuality', 'provider', 'cropName', 'confidence', 'healthDetected',
  'insectDetected', 'taskCreated', 'plantSaved', 'durationMs'])
  h(SCHEMA, f, 'model must capture field: ' + f);
const MIG = 'server/prisma/migrations/20260624000000_scan_observability/migration.sql';
if (!x(MIG)) E.push('missing migration: ' + MIG);
else { const s = rd(MIG); h(s, 'CREATE TABLE IF NOT EXISTS "scan_observability_events"', 'migration must create the table');
  h(s, 'scan_id', 'migration must have scan_id column'); }

// Server module.
const SVC = 'server/src/ml/scanObservability.js';
if (!x(SVC)) E.push('missing: ' + SVC); else { const s = rd(SVC);
  for (const fn of ['recordScanObservation', 'recordScanOutcome', 'getScanObservability', 'buildObservabilityCsv'])
    h(s, 'export async function ' + fn, 'must export ' + fn);
  h(s, 'upsert', 'must upsert by scanId (no duplicate rows)');
  h(s, 'mostScannedCrops', 'aggregate must include mostScannedCrops');
  h(s, 'mostCommonDiseases', 'aggregate must include mostCommonDiseases');
  h(s, 'mostCommonInsects', 'aggregate must include mostCommonInsects');
  h(s, 'avgConfidence', 'aggregate must include avgConfidence');
  h(s, 'failureRate', 'aggregate must include failureRate (SCAN_ANALYTICS_V1)');
  h(s, 'creditsConsumed', 'aggregate must include creditsConsumed (SCAN_ANALYTICS_V1)');
}

// Endpoints + capture.
const APP = rd('server/src/app.js');
h(APP, "'/api/admin/scan-observability'", 'must mount GET /api/admin/scan-observability');
h(APP, 'scan-observability/export.csv', 'must mount the CSV export route');
h(APP, "'/api/scan/observability/outcome'", 'must mount the outcome POST route');
h(APP, 'recordScanObservation', 'analyze route must capture an observation');
h(APP, '_obsT0', 'analyze route must measure durationMs');

// Admin card + page mount.
const CARD = 'src/components/admin/ScanObservabilityCard.jsx';
if (!x(CARD)) E.push('missing: ' + CARD); else { const s = rd(CARD);
  h(s, '/api/admin/scan-observability', 'card must fetch the aggregate endpoint');
  h(s, 'export.csv', 'card must offer CSV download');
  h(s, 'scan-observability-card', 'card must carry its testid');
}
h(rd('src/pages/admin/ScanHealthPage.jsx'), 'ScanObservabilityCard', 'ScanHealthPage must mount ScanObservabilityCard');

// Client reporter wired at BOTH chokepoints.
const REP = 'src/lib/scan/observabilityReporter.js';
if (!x(REP)) E.push('missing: ' + REP); else h(rd(REP), 'export function reportScanOutcome', 'reporter must export reportScanOutcome');
h(rd('src/core/scanToTask.js'), 'reportScanOutcome', 'scanToTask must report taskCreated');
h(rd('src/pages/ScanPage.jsx'), 'reportScanOutcome', 'ScanPage must report plantSaved');

if (E.length) { console.error('[check:scan-observability] FAIL — ' + E.length + ' issue(s):'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-observability] PASS — model+migration, capture/aggregate/CSV, admin endpoints+card, outcome reporter wired at task+plant chokepoints.');
