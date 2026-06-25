/**
 * DecisionEngine.test.ts — FARROWAY DECISION ENGINE acceptance (§11).
 * Self-running: `tsx DecisionEngine.test.ts`. Covers empty states, scan→decision,
 * task+outcome linkage, no conflicts, dedupe, and the no-jargon rule.
 */
import { buildDailyDecision } from '../FarrowayDecisionEngine';
import { containsJargon, sanitizeFarmerText } from '../DecisionExplainer';
import { rankDecisions } from '../DecisionPriorityRanker';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }
function eq(a: any, b: any, m: string) { if (a !== b) { console.error(`  ✗ ${m} — got ${JSON.stringify(a)}`); process.exit(1); } passed++; }

// 1. New farm, no crop → CTA to add crop.
const d1 = buildDailyDecision({ farmId: 'f1', todayISO: '2026-06-25' });
ok(d1.isEmptyState, 'no crop → empty state');
ok(!!d1.cta && d1.cta.action === 'add_crop', 'no crop → add_crop CTA');
ok(d1.dailyDecision.length > 0, 'empty state still shows a next action (never blank)');

// 2. Crop but no planting date / stage → add planting date CTA.
const d2 = buildDailyDecision({ farmId: 'f1', crop: 'Onion', todayISO: '2026-06-25' });
ok(d2.isEmptyState && d2.cta!.action === 'add_planting_date', 'crop without stage → planting-date CTA');

// 3. Crop + stage + scan → a real, specific decision with task + outcome linkage.
const d3 = buildDailyDecision({
  farmId: 'f1', crop: 'Onion', cropId: 'onion-1', plantingDate: '2026-05-01', latestScan: {},
  todayISO: '2026-06-25',
  farmBrainState: { hasFirstScan: true, crop: 'Onion',
    growthStage: { value: 'Vegetative' }, diseaseRisk: { value: 50 },
    todaysTasks: [{ action: 'Inspect 10 onion plants', confidence: 88, urgency: 'medium' }] },
  weather: { humidity: 75 },
});
ok(!d3.isEmptyState, 'full context → real decision');
ok(d3.dailyDecision.includes('Inspect'), 'decision is specific (not generic)');
ok(!!d3.reason && d3.reason.length > 0, 'decision has a reason');
ok(typeof d3.confidence === 'number' && d3.confidence > 0, 'decision has confidence');
ok(d3.taskRef.startsWith('task:'), 'decision links to a task');
ok(d3.outcomePath.startsWith('outcome:'), 'task links to an outcome path');
ok(d3.evidence.length > 0 && d3.evidence.every((e) => e.startsWith('✓')), 'evidence lines present');
ok(d3.supportingInsights.length <= 3, 'at most 3 supporting insights');

// 4. Dedupe key is present and stable for the same farm/crop/kind/day.
const d3b = buildDailyDecision({
  farmId: 'f1', crop: 'Onion', cropId: 'onion-1', plantingDate: '2026-05-01', latestScan: {},
  todayISO: '2026-06-25',
  farmBrainState: { hasFirstScan: true, crop: 'Onion', growthStage: { value: 'Vegetative' },
    diseaseRisk: { value: 50 }, todaysTasks: [{ action: 'Inspect 10 onion plants', confidence: 88, urgency: 'medium' }] },
});
eq(d3.dedupeKey, d3b.dedupeKey, 'same context → identical dedupe key (no duplicate decision)');

// 5. No jargon reaches the farmer.
ok(!containsJargon(d3.dailyDecision), 'decision has no jargon');
ok(!containsJargon(d3.reason), 'reason has no jargon');
eq(sanitizeFarmerText('Plant.id model says spray'), 'the scan Farroway says spray', 'sanitizer strips provider+ai words');

// 6. Ranker never returns conflicting actions.
const ranked = rankDecisions([
  { kind: 'harvest', text: 'Harvest', confidence: 90, urgency: 'high' },
  { kind: 'irrigate', text: 'Irrigate', confidence: 85, urgency: 'high' },
]);
ok(ranked.primary!.kind === 'harvest', 'higher-priority action wins');
ok(!ranked.supporting.some((s) => s.kind === 'irrigate'), 'conflicting action (irrigate vs harvest) dropped');

console.log('[test:decision-engine] PASS — ' + passed + ' assertions (one decision, linked, deduped, no jargon).');
