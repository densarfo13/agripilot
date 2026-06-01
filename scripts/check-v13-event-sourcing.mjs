#!/usr/bin/env node
/**
 * scripts/check-v13-event-sourcing.mjs — event sourcing must be immutable,
 * idempotent, tenant-scoped, and never written from the UI.
 *
 * Fails if:
 *   • the 4 event files are missing
 *   • EventContract does not declare the 26 canonical events
 *   • the runtime does not assert idempotencyRequired + tenantScopeRequired
 *     + noUIDirectWrites
 *   • an event file uses a deep '../' project import (siblings './' are OK)
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const DIR = 'src/runtime/v13/events';
const FILES = ['EventContract.ts', 'EventIdempotency.ts', 'EventReplayReadiness.ts', 'EventSourcingRuntime.ts'];
for (const f of FILES) {
  if (!read(`${DIR}/${f}`)) F.push(`${DIR}/${f}: missing`);
}
if (!F.length) P.push('all 4 event-sourcing files present');

const CANONICAL = [
  'UserCreated', 'UserLoggedIn', 'FarmCreated', 'GardenCreated', 'PlantCreated',
  'ScanStarted', 'ScanCompleted', 'ScanFailed', 'DiagnosisCreated', 'RecommendationCreated',
  'TaskCreated', 'TaskCompleted', 'FollowUpScanRequested', 'FollowUpScanCompleted',
  'OutcomeRecorded', 'DiseaseTrendDetected', 'PestTrendDetected', 'WeatherRiskDetected',
  'HarvestReadinessChecked', 'BuyerInterestCreated', 'ListingCreated', 'NGOProgramCreated',
  'FarmerEnrolled', 'InterventionAssigned', 'InterventionCompleted', 'EvidenceUploaded',
  'ReportGenerated',
];
const contract = read(`${DIR}/EventContract.ts`);
const missingEvents = CANONICAL.filter((e) => !contract.includes(e));
if (missingEvents.length) F.push(`EventContract missing canonical events: ${missingEvents.slice(0, 5).join(', ')}${missingEvents.length > 5 ? '…' : ''}`);
else P.push('all 26 canonical events declared');

const runtime = read(`${DIR}/EventSourcingRuntime.ts`);
if (runtime) {
  for (const [flag, re] of [
    ['idempotencyRequired', /idempotencyRequired:\s*true/],
    ['tenantScopeRequired', /tenantScopeRequired:\s*true/],
    ['noUIDirectWrites', /noUIDirectWrites:\s*true/],
  ]) {
    if (!re.test(runtime)) F.push(`EventSourcingRuntime must assert ${flag}`);
  }
  if (!/immutableAppendReady|immutable/i.test(runtime)) F.push('EventSourcingRuntime must assert immutable append-only');
  if (!F.some((m) => m.includes('idempotencyRequired') || m.includes('tenantScopeRequired') || m.includes('noUIDirectWrites') || m.includes('immutable')))
    P.push('runtime asserts immutable append + idempotency + tenant scope + no UI writes');
}

// No deep imports in the events cluster (siblings allowed).
for (const f of FILES) {
  const src = strip(read(`${DIR}/${f}`));
  if (src && /from\s*['"]\.\.\//.test(src)) F.push(`${f}: deep '../' import not allowed (siblings './' only)`);
}
if (!F.some((m) => m.includes("deep '../'"))) P.push('no deep imports in the event cluster (siblings only)');

if (F.length) {
  console.error('[check:v13-event-sourcing] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v13-event-sourcing] PASS — immutable, idempotent, tenant-scoped, no UI writes.');
for (const m of P) console.log('  ✓ ' + m);
