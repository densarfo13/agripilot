/**
 * EvidenceResolver.test.ts — resolver + farmer labels + ingestion policy + quality gate.
 * Self-running: `tsx EvidenceResolver.test.ts`.
 */
import { resolveField, resolveAllFields, farmerLabel, canFarmBrainIngest, evidenceResolverHealth } from '../EvidenceFieldResolver';
import { evaluateImageQuality, imageQualityGateHealth } from '../../quality/ImageQualityGate';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

const ctx = { crop: 'maize', plantingDate: '2026-05-01', nowMs: Date.now(), nowIso: '2026-06-25T00:00:00Z', weather: { tempC: 30 }, soil: { ph: 6.2, moisture: 18 } };
const STATUSES = ['DIRECT_MEASURED', 'MODEL_ESTIMATED', 'FUSED_ESTIMATE', 'LIVE_PROVIDER', 'LAB_REQUIRED', 'UNKNOWN', 'NO_LIVE_FEED', 'UNAVAILABLE'];

// ── Contract: every resolved field returns all 8 keys, status from the enum ──
const all: any = resolveAllFields(ctx);
for (const [name, f] of Object.entries<any>(all)) {
  for (const k of ['status', 'value', 'confidence', 'evidenceTier', 'source', 'reason', 'estimated', 'lastUpdated'])
    ok(k in f, name + ' returns ' + k);
  ok(STATUSES.includes(f.status), name + ' status is a valid enum: ' + f.status);
  ok(typeof f.confidence === 'number', name + ' confidence is a number (never missing)');
  ok(typeof f.reason === 'string' && f.reason.length > 0, name + ' has a reason (never missing)');
  // No bare-string output: status is always the enum, never a raw "unavailable" string value.
  ok(f.value === null || typeof f.value === 'number' || typeof f.value === 'string', name + ' value is typed');
}

// ── Status mapping is correct ──
ok(resolveField('plantAge', ctx).status === 'MODEL_ESTIMATED', 'plant age → MODEL_ESTIMATED');
ok(resolveField('rainRisk', ctx).status === 'LIVE_PROVIDER', 'rain risk → LIVE_PROVIDER');
ok(resolveField('nitrogen', ctx).status === 'LAB_REQUIRED', 'nitrogen → LAB_REQUIRED');
ok(resolveField('marketPrice', ctx).status === 'NO_LIVE_FEED', 'market → NO_LIVE_FEED');
ok(resolveField('fruitCount', ctx).status === 'UNAVAILABLE', 'fruit count (no CV model) → UNAVAILABLE');

// ── Farmer label never leaks the enum/provider/API ──
for (const s of STATUSES) {
  const label = farmerLabel(s as any);
  ok(!/_/.test(label) && label !== s, 'farmer label is plain words, not the enum: ' + s + ' → ' + label);
  ok(!/provider|api|model|tier|http/i.test(label), 'farmer label has no jargon: ' + label);
}
ok(farmerLabel('LAB_REQUIRED') === 'Needs lab test', 'lab → "Needs lab test"');
ok(farmerLabel('NO_LIVE_FEED') === 'Live data unavailable', 'no feed → "Live data unavailable"');

// ── FarmBrain ingestion policy (spec §7) ──
ok(canFarmBrainIngest('MODEL_ESTIMATED', 80, 42) === true, 'ingest MODEL_ESTIMATED ≥ threshold');
ok(canFarmBrainIngest('MODEL_ESTIMATED', 60, 42) === false, 'block MODEL_ESTIMATED below threshold');
ok(canFarmBrainIngest('LIVE_PROVIDER', 90, 'x') === true, 'ingest LIVE_PROVIDER ≥ threshold');
for (const blocked of ['LAB_REQUIRED', 'UNKNOWN', 'UNAVAILABLE', 'NO_LIVE_FEED'])
  ok(canFarmBrainIngest(blocked as any, 99, 5) === false, 'NEVER ingest tier: ' + blocked);
ok(canFarmBrainIngest('DIRECT_MEASURED', 90, null) === false, 'never ingest a null value');

const rh = evidenceResolverHealth();
ok(rh.everyFieldHasContract && rh.labNeverValued && rh.ingestionPolicyHonest && rh.farmerLabelNeverLeaksEnum, 'resolver health attests all invariants');

// ── Image Quality Gate ──
const good = evaluateImageQuality({ luminance: 0.5, sharpness: 0.8, width: 1024, height: 1024 });
ok(good.overall === 'good' && good.gates.canDiagnose && good.gates.canIngestFarmBrain && good.gates.canCreateTask, 'good photo passes all gates');
ok(good.factors.sharpness.assessed && good.factors.brightness.assessed && good.factors.resolution.assessed, 'measurable factors are assessed');
// CV-dependent factors are NOT fabricated.
for (const k of ['distance', 'targetVisible', 'motionBlur', 'multipleObjects'])
  ok((good.factors as any)[k].score === null && (good.factors as any)[k].assessed === false, 'CV factor not fabricated: ' + k);

const dark = evaluateImageQuality({ luminance: 0.05, sharpness: 0.8, width: 1024, height: 1024 });
ok(dark.overall === 'retake' && !dark.gates.canDiagnose && !dark.gates.canIngestFarmBrain && !dark.gates.canCreateTask, 'dark photo → retake, blocks pipeline');
ok(typeof dark.guidance === 'string' && dark.guidance.length > 0, 'retake carries farmer guidance');
const blurry = evaluateImageQuality({ luminance: 0.5, sharpness: 0.05, width: 1024, height: 1024 });
ok(blurry.retakeNeeded && /blurry|steady/i.test(blurry.guidance || ''), 'blurry photo → retake with steady-hand guidance');
const tiny = evaluateImageQuality({ luminance: 0.5, sharpness: 0.8, width: 100, height: 100 });
ok(tiny.retakeNeeded === true, 'low-res photo → retake');

const qh = imageQualityGateHealth();
ok(qh.goodPasses && qh.lowBlocksPipeline && qh.cvFactorsNotFabricated, 'quality gate health attests invariants');

console.log('[test:evidence-resolver] PASS — ' + passed + ' assertions (8-field contract; farmer labels no-jargon; ingestion policy by tier; quality gate blocks bad photos, CV factors not fabricated).');
