/**
 * EvidenceTier.test.ts — Scan Intelligence evidence tiers.
 * Self-running: `tsx EvidenceTier.test.ts`. Proves the honest contract:
 * fields classify into the right tier; the validated models (crop calendar, live
 * weather) genuinely produce estimated/live values; CV fields are awaiting_model
 * with null values; lab fields are LAB_REQUIRED and never estimated.
 */
import { classifyFieldTier, evaluateField, evaluateScanFields, evidenceTierHealth, ALL_TIER_FIELDS } from '../EvidenceTierEngine';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── Tier classification ──
ok(classifyFieldTier('fruitCount') === 'DIRECT_MEASURED', 'fruit count → Tier 1 DIRECT_MEASURED');
ok(classifyFieldTier('plantAge') === 'MODEL_ESTIMATED', 'plant age → Tier 2 MODEL_ESTIMATED');
ok(classifyFieldTier('yieldEstimate') === 'MODEL_ESTIMATED', 'yield → Tier 2 MODEL_ESTIMATED');
ok(classifyFieldTier('diseaseRisk') === 'FUSED_ESTIMATE', 'disease risk → Tier 3 FUSED_ESTIMATE');
ok(classifyFieldTier('rainRisk') === 'LIVE_PROVIDER', 'rain risk → Tier 4 LIVE_PROVIDER');
ok(classifyFieldTier('marketPrice') === 'LIVE_PROVIDER', 'market price → Tier 4 LIVE_PROVIDER');
ok(classifyFieldTier('nitrogen') === 'LAB_REQUIRED', 'nitrogen → Tier 5 LAB_REQUIRED');
ok(classifyFieldTier('somethingElse') === 'UNKNOWN', 'unclassified → Tier 6 UNKNOWN');

const ctx = { crop: 'maize', plantingDate: '2026-05-01', nowMs: Date.now(), nowIso: '2026-06-25T00:00:00Z', weather: { tempC: 30 }, soil: { ph: 6.2, moisture: 18 } };

// ── Every field returns the full contract ──
const all: any = evaluateScanFields(ctx);
ok(Object.keys(all).length === ALL_TIER_FIELDS.length, 'every classified field is evaluated');
for (const [name, f] of Object.entries<any>(all)) {
  ok(['field', 'tier', 'status', 'value', 'confidence', 'source', 'reason', 'estimated', 'lastUpdated'].every(k => k in f), name + ' returns the full record');
  ok(typeof f.reason === 'string' && f.reason.length > 0, name + ' carries a reason');
  ok(typeof f.estimated === 'boolean', name + ' carries an estimated flag');
  // INVARIANT: a value exists only for a real measured/estimated/live status.
  if (f.value != null) ok(['estimated', 'live', 'measured'].includes(f.status), name + ' has a value only when real (' + f.status + ')');
  // INVARIANT: no value → null confidence + null lastUpdated.
  if (f.value == null) ok(f.confidence === null && f.lastUpdated === null, name + ' null value → null confidence/lastUpdated');
}

// ── The validated models genuinely produce values (not hardcoded unavailable) ──
const plantAge: any = evaluateField('plantAge', ctx);
ok(plantAge.status === 'estimated' && plantAge.estimated === true && plantAge.value != null, 'plant age is a REAL estimate (not unavailable)');
ok(plantAge.source === 'crop-calendar' && plantAge.confidence != null, 'plant age carries method + confidence');
const rain: any = evaluateField('rainRisk', ctx);
ok(rain.status === 'live' && rain.source === 'live-weather' && rain.value != null, 'rain risk is a REAL live value');
const ph: any = evaluateField('soilPh', ctx);
ok(ph.status === 'live' && ph.value === 6.2, 'soil pH served live from provider context');

// ── No planting date → honest awaiting_input (not a fabricated age) ──
const noDate: any = evaluateField('plantAge', { crop: 'maize' });
ok(noDate.status === 'awaiting_input' && noDate.value === null, 'no planting date → awaiting_input, not fabricated');

// ── CV fields: tier-labeled but never fabricated ──
for (const k of ['fruitCount', 'leafDamagePct', 'canopyCoverage', 'yieldEstimate', 'healthScore', 'recoveryProbability'])
  ok(all[k].status === 'awaiting_model' && all[k].value === null, 'CV field awaiting_model + null: ' + k);

// ── Lab fields: LAB_REQUIRED, never estimated ──
for (const k of ['nitrogen', 'phosphorus', 'potassium', 'cec', 'organicMatter', 'micronutrients'])
  ok(all[k].tier === 'LAB_REQUIRED' && all[k].estimated === false && all[k].value === null, 'lab field never estimated: ' + k);

// ── Market/satellite/drone/iot: awaiting_provider ──
for (const k of ['marketPrice', 'satelliteNdvi', 'droneAnalysis', 'iotSensors'])
  ok(all[k].status === 'awaiting_provider' && all[k].value === null, 'live feed awaiting_provider: ' + k);

// ── Health attestation ──
const h = evidenceTierHealth();
ok(h.valueOnlyWhenReal && h.cvNeverFabricated && h.labNeverEstimated && h.calendarIsEstimated, 'health attests all four invariants');

console.log('[test:evidence-tier] PASS — ' + passed + ' assertions (6 tiers; calendar/weather/soil produce REAL estimated/live values; CV awaiting_model, lab LAB_REQUIRED — never fabricated).');
