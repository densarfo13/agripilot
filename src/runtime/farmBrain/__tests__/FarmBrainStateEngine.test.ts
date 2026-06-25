/**
 * FarmBrainStateEngine.test.ts — FARM_BRAIN_STATE_V1 behavioral test.
 *
 * Self-running (no framework): `tsx FarmBrainStateEngine.test.ts`. Exits 1 on
 * the first failed assertion. Verifies the honesty contract that the whole
 * mission rests on — never fabricate, never "not enough data", always a next
 * action, single canonical reduce.
 */
import { reduceFarmBrainState } from '../FarmBrainStateEngine';
import { emptyFarmBrainState, FARM_BRAIN_STATE_VERSION } from '../FarmBrainStateContracts';

let passed = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error('  ✗ ' + msg); process.exit(1); }
  passed++;
}

// ── Empty state is honest, never "not enough data". ──
const e = emptyFarmBrainState();
ok(e.version === FARM_BRAIN_STATE_VERSION, 'empty state carries the version');
ok(e.farmHealth.band === 'unknown', 'empty health band is unknown (not faked)');
ok(e.diseaseRisk.status === 'waiting_for_first_scan', 'disease waits for first scan');
ok(e.marketReadiness.status === 'no_live_feed', 'market honestly no_live_feed');
ok(e.fundingEligibility.status === 'no_live_feed', 'funding honestly no_live_feed');
ok(e.fundingEligibility.value === null, 'funding value is null — NEVER a fabricated number');
ok(e.todaysTasks.length === 0, 'empty state has no tasks yet');

// RULE 3 — a scan with zero signal STILL yields a next action, never "not enough data".
const bare = reduceFarmBrainState(e, { type: 'scan', at: 1000 }, {});
ok(bare.todaysTasks.length >= 1, 'RULE 3: always at least one next action');
ok(bare.hasFirstScan === true, 'scan event flips hasFirstScan');
ok(bare.lastEvent === 'scan', 'lastEvent recorded');

// ── A real FarmBrain envelope flows into the canonical state (RULE 1/4). ──
const withFb = reduceFarmBrainState(e, { type: 'scan', at: 2000 }, {
  farmBrain: {
    riskScore: 30, confidenceScore: 88, diseaseLikelihood: 72,
    growthStage: 'Vegetative', nextAction: 'Spray onion today',
    followUpTask: { title: 'Re-check in 3 days', reason: 'Early thrips signs', timeRequiredMin: 12 },
  },
  farmHealthScore: 70,
  cropName: 'Onion',
  timelineEntry: { kind: 'scan', label: 'Scan completed' },
});
ok(withFb.farmHealth.value === 70, 'farm health uses the real score');
ok(withFb.farmHealth.band === 'good', 'score 70 → good band');
ok(withFb.diseaseRisk.value === 72, 'disease risk reflects the envelope');
ok(withFb.diseaseRisk.status === 'ok', 'disease ≥60 is ok status');
ok(withFb.growthStage.value === 'Vegetative', 'growth stage detected, not estimated');
ok(withFb.growthStage.status === 'ok', 'detected stage is ok status');
ok(withFb.confidence === 88, 'overall confidence = FarmBrain confidence');
// RULE 6 — recommendation carries the full rationale.
const rec = withFb.todaysTasks[0];
ok(rec.action === 'Spray onion today', 'RULE 6: action present');
ok(rec.reason.length > 0, 'RULE 6: reason present');
ok(rec.confidence === 88, 'RULE 6: confidence present');
ok(rec.urgency === 'high', 'RULE 6: urgency high when disease ≥60');
ok(rec.timeRequiredMin === 12, 'RULE 6: time required carried through');
ok(rec.expectedBenefit.length > 0, 'RULE 6: expected benefit present');
ok(withFb.timeline.length === 1, 'RULE 11: timeline entry appended');

// ── Honesty under load: yield/market/funding NEVER fabricate, even with a scan. ──
ok(withFb.yieldPrediction.value === null, 'yield $ stays null — never fabricated');
ok(withFb.marketReadiness.status === 'no_live_feed', 'market still no_live_feed');
ok(withFb.fundingEligibility.value === null, 'funding stays null — never fabricated');

// ── Totality: a malformed event/signal returns prior state, never throws. ──
const survived = reduceFarmBrainState(withFb, { type: 'scan', at: NaN } as any, { farmBrain: null } as any);
ok(!!survived && survived.version === FARM_BRAIN_STATE_VERSION, 'reducer is total — never throws');

console.log('[test:farm-brain-state] PASS — ' + passed + ' assertions (honest, no fabrication).');
