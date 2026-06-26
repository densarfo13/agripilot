/**
 * ScanV12.test.ts — Scan Intelligence v12.
 * Self-running: `tsx ScanV12.test.ts`. Iterates the FULL v12 envelope and proves
 * the no-fabrication invariants mechanically: CV fields unavailable, market fields
 * no_live_feed, soil N/P/K/CEC unknown — never a fabricated value; and identity
 * real only for a confident, known plant.
 */
import { analyzeScanV12, scanV12Health, V12Status } from '../ScanIntelligenceV12';
import { lookupPlantReference, plantReferenceCount } from '../PlantReference';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

const STATUSES: V12Status[] = ['ok', 'estimated', 'advisory', 'unknown', 'unavailable', 'no_live_feed'];
const r: any = analyzeScanV12({ plantName: 'maize', identified: true, confidencePct: 92, plantingDate: '2026-05-01', nowMs: 1 });

// Every field across every section is a well-formed V12Field.
const sections = ['identity', 'health', 'pest', 'disease', 'yield', 'fieldIntelligence', 'soil', 'weather', 'market', 'multiModal', 'voice'];
let fieldCount = 0;
for (const sec of sections) {
  ok(r[sec] && typeof r[sec] === 'object', 'section present: ' + sec);
  for (const [k, v] of Object.entries<any>(r[sec])) {
    fieldCount++;
    ok(STATUSES.includes(v.status), sec + '.' + k + ' has a valid status');
    ok(typeof v.confidence === 'number' && v.confidence >= 0 && v.confidence <= 100, sec + '.' + k + ' confidence 0..100');
    ok(typeof v.evidence === 'string' && v.evidence.length > 0, sec + '.' + k + ' carries evidence');
    ok('value' in v && 'source' in v, sec + '.' + k + ' has value + source');
    // Invariant: any field not 'ok'/'estimated'/'advisory' must have a null value.
    if (!['ok', 'estimated', 'advisory'].includes(v.status)) ok(v.value === null, sec + '.' + k + ' non-derived field is null (' + v.status + ')');
  }
}
ok(fieldCount >= 70, 'envelope covers the full taxonomy (' + fieldCount + ' fields)');

// CV-dependent fields are ALWAYS unavailable + null.
for (const k of ['healthScore', 'waterStress', 'heatStress', 'leafDamagePct', 'fruitDamagePct', 'recoveryProbability'])
  ok(r.health[k].status === 'unavailable' && r.health[k].value === null, 'health CV unavailable: ' + k);
for (const k of Object.keys(r.fieldIntelligence))
  ok(r.fieldIntelligence[k].status === 'unavailable' && r.fieldIntelligence[k].value === null, 'field-intel CV unavailable: ' + k);
for (const k of ['fruitCount', 'flowerCount', 'yield', 'weight', 'biomass'])
  ok(r.yield[k].status === 'unavailable' && r.yield[k].value === null, 'yield CV unavailable: ' + k);
for (const k of ['spreadRisk', 'fatalityRisk', 'fieldInfectionPct'])
  ok(r.disease[k].status === 'unavailable' && r.disease[k].value === null, 'disease risk CV unavailable: ' + k);

// Market is NEVER fabricated.
for (const k of ['bestSellTime', 'expectedPrice', 'demandTrend', 'nearbyBuyers'])
  ok(r.market[k].status === 'no_live_feed' && r.market[k].value === null, 'market no_live_feed: ' + k);

// Soil N/P/K/CEC are honest unknown, not invented.
for (const k of ['nitrogen', 'phosphorus', 'potassium', 'cec'])
  ok(r.soil[k].status === 'unknown' && r.soil[k].value === null, 'soil NPK/CEC unknown: ' + k);

// Drone/satellite/video/sensor are honest no_live_feed.
for (const k of ['video', 'droneImages', 'satelliteImages', 'sensorData'])
  ok(r.multiModal[k].status === 'no_live_feed', 'multimodal not-wired honest: ' + k);

// Identity: real for a confident KNOWN plant.
ok(r.identity.scientificName.status === 'ok' && r.identity.scientificName.value === 'Zea mays', 'identity real for known confident crop');
ok(r.identity.toxicity.value && /None known/i.test(r.identity.toxicity.value), 'identity toxicity is a real reference fact');

// Identity: UNKNOWN when not confidently identified (never a guessed name).
const low: any = analyzeScanV12({ plantName: 'maize', identified: true, confidencePct: 40 });
ok(low.identity.scientificName.status === 'unknown' && low.identity.scientificName.value === null, 'low confidence → identity unknown (not guessed)');
// Identity: UNKNOWN for a confident but unlisted plant (no fabricated binomial).
const unlisted: any = analyzeScanV12({ plantName: 'some-rare-orchid-xyz', identified: true, confidencePct: 95 });
ok(unlisted.identity.scientificName.status === 'unknown', 'unlisted plant → identity unknown (not fabricated)');

// PlantReference: known → ref; unknown → null.
ok(lookupPlantReference('cassava') !== null, 'reference resolves a known crop');
ok(/Manihot/.test(lookupPlantReference('cassava')!.scientificName), 'reference returns the real binomial');
ok(lookupPlantReference('xyz-not-a-plant') === null, 'reference returns null for unknown (→ honest unknown)');
ok(plantReferenceCount() >= 10, 'reference has a real, bounded crop set');

// Health attestation.
const h = scanV12Health();
ok(h.cvNeverFabricated === true, 'health attests CV never fabricated');
ok(h.marketNeverFabricated === true, 'health attests market never fabricated');
ok(h.npkNeverFabricated === true, 'health attests NPK never fabricated');
ok(h.identityRealForKnown === true, 'health attests identity real for known crop');

console.log('[test:scan-v12] PASS — ' + passed + ' assertions across ' + fieldCount + ' fields (CV unavailable, market no_live_feed, NPK unknown; identity real only when known+confident).');
