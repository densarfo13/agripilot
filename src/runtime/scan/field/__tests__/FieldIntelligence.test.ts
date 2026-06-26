/**
 * FieldIntelligence.test.ts — Scan Intelligence v11.
 * Self-running: `tsx FieldIntelligence.test.ts`. Proves the honest split:
 * calendar fields estimate from a planting date; CV-dependent fields are ALWAYS
 * 'unavailable' with a null value — never a fabricated count/yield.
 */
import { estimateFieldIntelligence, fieldIntelligenceHealth } from '../FieldIntelligenceEngine';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

const CV = ['fruitCount', 'flowerCount', 'canopyCoverage', 'plantDensity', 'rowSpacing',
  'estimatedYield', 'estimatedBiomass', 'fieldCoverage'] as const;

// With a planting date — calendar fields estimate; CV fields STILL unavailable.
const withDate: any = estimateFieldIntelligence({ crop: 'maize', plantingDate: '2026-05-01', nowMs: Date.now() });
ok(withDate.plantAge.value != null && withDate.plantAge.status === 'ok', 'plant age estimated from planting date');
ok(['estimated', 'unknown'].includes(withDate.harvestWindow.status), 'harvest window is an honest estimate/unknown');
for (const f of CV) {
  ok(withDate[f].value === null, 'CV field never has a value: ' + f);
  ok(withDate[f].status === 'unavailable', 'CV field is unavailable (not fabricated): ' + f);
  ok(withDate[f].confidence === 0, 'CV field carries 0 confidence: ' + f);
}

// Without a planting date — calendar fields are honestly unknown, not invented.
const noDate: any = estimateFieldIntelligence({ crop: 'maize' });
ok(noDate.plantAge.status === 'unknown' && noDate.plantAge.value === null, 'no planting date → plant age unknown (not faked)');
ok(/planting date/i.test(noDate.plantAge.reason), 'unknown plant age points to adding a planting date');

// Every field carries a reason (evidence/next-action).
for (const f of ['plantAge', 'maturityDate', ...CV]) ok(!!withDate[f].reason, 'field carries a reason: ' + f);

// Health attestation.
const h = fieldIntelligenceHealth();
ok(h.cvNeverFabricated === true, 'health attests CV fields never fabricated');
ok(h.plantAgeEstimatedWithDate === true, 'health attests calendar estimation works');

console.log('[test:field-intelligence] PASS — ' + passed + ' assertions (calendar estimated; CV unavailable, never fabricated).');
