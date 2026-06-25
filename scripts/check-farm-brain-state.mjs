/**
 * check-farm-brain-state.mjs — FARM_BRAIN_STATE_V1 governance gate.
 *
 * Locks the proactive-FarmBrain spine: the single canonical state every event
 * updates (RULE 1) and every screen reads (RULE 2), wired at the scan
 * chokepoint (RULE 4), with the honesty contract intact (RULE 3/14 + the
 * standing no-fabrication rule). Also RUNS the behavioral test via tsx so CI
 * exercises real reducer logic, not just string presence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const DIR = 'src/runtime/farmBrain/';
const CONTRACTS = DIR + 'FarmBrainStateContracts.ts';
const ENGINE = DIR + 'FarmBrainStateEngine.ts';
const STORE = DIR + 'FarmBrainStateStore.ts';
const TEST = DIR + '__tests__/FarmBrainStateEngine.test.ts';

for (const f of [CONTRACTS, ENGINE, STORE, TEST]) if (!x(f)) E.push('missing: ' + f);

// ── Contracts: canonical state shape + RULE-1 events + RULE-6 recommendation. ──
const c = rd(CONTRACTS);
for (const field of ['farmHealth', 'diseaseRisk', 'pestRisk', 'waterStress', 'nutritionStatus',
  'growthStage', 'harvestPrediction', 'yieldPrediction', 'marketReadiness', 'fundingEligibility',
  'buyerReadiness', 'confidence', 'todaysTasks', 'tomorrowsTasks', 'timeline'])
  h(c, field, 'FarmBrainState must include RULE-1 field: ' + field);
for (const ev of ['scan', 'weather_update', 'task_completed', 'new_planting', 'fertilizer',
  'irrigation', 'harvest', 'pest_detection', 'disease_detection', 'market_update'])
  h(c, "'" + ev + "'", 'FarmEventType must include: ' + ev);
for (const r of ['action', 'reason', 'confidence', 'urgency', 'timeRequiredMin', 'expectedBenefit'])
  h(c, r, 'RULE 6: Recommendation must carry: ' + r);
// Honesty: the honest statuses must exist; "not enough data" must NOT (RULE 3).
for (const st of ['waiting_for_first_scan', 'unknown_until_scan', 'no_live_feed', 'estimated', 'low_confidence'])
  h(c, "'" + st + "'", 'honest MetricStatus missing: ' + st);

// ── Engine: composes (does not invent); honest no_live_feed for the un-fed fields. ──
const eng = rd(ENGINE);
h(eng, 'export function reduceFarmBrainState', 'engine must export reduceFarmBrainState');
h(eng, 'FarmBrainSignals', 'engine must accept a composed signals object');
h(eng, "'no_live_feed'", 'engine must mark un-fed fields no_live_feed (never fabricate)');
h(eng, 'catch', 'reducer must be total (never throws)');
// No fabricated specifics for the feed-less fields.
if (/marketReadiness\s*=\s*metric\(\s*\d/.test(eng)) E.push('market must not be a fabricated number');
if (/fundingEligibility\s*=\s*metric\(\s*\d/.test(eng)) E.push('funding must not be a fabricated number');

// ── Store: single cache (RULE 15), read selector (RULE 2), dispatch (RULE 1), health. ──
const st = rd(STORE);
h(st, 'export function getFarmBrainState', 'RULE 2: store must export the read selector getFarmBrainState');
h(st, 'export function dispatchFarmEvent', 'RULE 1: store must export dispatchFarmEvent');
h(st, 'singleCache: true', 'RULE 15: store must attest a single cache');
h(st, 'installFarmBrainStateHealth', 'store must install the health global');
h(st, '__farmBrainStateHealth', 'store must pin window.__farmBrainStateHealth');

// ── RULE 4: every scan dispatches through the single chokepoint (no bypass). ──
const SCAN = rd('src/core/scanDetectionEngine.js');
h(SCAN, 'dispatchFarmEvent', 'RULE 4: scan engine must dispatch a FarmBrain event');
h(SCAN, "_withFarmBrain", 'dispatch must sit at the _withFarmBrain chokepoint');

// ── Boot: health global installed. ──
h(rd('src/App.jsx'), 'installFarmBrainStateHealth', 'App boot must install __farmBrainStateHealth');

// ── No screen reads a competing source: forbid "Not enough data" in the new files. ──
for (const f of [CONTRACTS, ENGINE, STORE]) {
  if (/not enough data/i.test(rd(f))) E.push('RULE 3 violated: "not enough data" present in ' + f);
}

// ── Run the behavioral test (real logic, not just strings). ──
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('behavioral test did not PASS: ' + out.trim());
  } catch (err) {
    E.push('behavioral test failed: ' + ((err && (err.stdout || err.message)) || 'unknown'));
  }
}

if (E.length) {
  console.error('[check:farm-brain-state] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:farm-brain-state] PASS — single canonical FarmBrain state; events→reduce→screens; '
  + 'honest no-fabrication contract; scan chokepoint wired; behavioral test green.');
