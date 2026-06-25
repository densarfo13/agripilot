/**
 * AgriClassifier.test.ts — UNIVERSAL SCANNER, Phase 8 acceptance.
 *
 * Self-running (no framework): `tsx AgriClassifier.test.ts`. Asserts each of the
 * spec's 9 photos routes to the correct object type, and that the <70% safety
 * line fires. Exits 1 on the first failure.
 */
import {
  classifyAgriculturalObject, AGRI_ROUTING,
} from '../../AgriculturalObjectClassifier';
import { specializedEngineFor } from '../ScanSpecializedEngines';

let passed = 0;
function eq(actual: any, expected: any, msg: string) {
  if (actual !== expected) { console.error(`  ✗ ${msg} — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); process.exit(1); }
  passed++;
}
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error('  ✗ ' + msg); process.exit(1); }
  passed++;
}

// ── The 9 acceptance photos route correctly. ──
const CASES: Array<[string, any, string]> = [
  ['Tomato fruit',  { objectType: 'fruit', plantName: 'Tomato', confidencePct: 88 }, 'fruit'],
  ['Pepper fruit',  { objectType: 'fruit', plantName: 'Pepper', confidencePct: 85 }, 'fruit'],
  ['Onion leaf',    { objectType: 'leaf', plantName: 'Onion', confidencePct: 82 }, 'leaf'],
  ['Rose flower',   { objectType: 'flower', plantName: 'Rose', confidencePct: 80 }, 'flower'],
  ['Maize plant',   { objectType: 'whole_plant', plantName: 'Maize', confidencePct: 78 }, 'wholePlant'],
  ['Mango tree',    { objectType: 'tree', plantName: 'Mango tree', confidencePct: 76 }, 'tree'],
  ['Aphid',         { objectType: 'insect', plantName: 'Aphid', confidencePct: 84 }, 'insect'],
  ['Dry soil',      { objectType: 'soil', possibleIssue: 'dry soil', confidencePct: 75 }, 'soil'],
  ['Blurry image',  { status: 'unclear', confidencePct: 20 }, 'unknown'],
];

for (const [name, input, expected] of CASES) {
  const c = classifyAgriculturalObject(input);
  eq(c.objectType, expected, `route: ${name}`);
  ok(Array.isArray(c.routingDecision.providers) && c.routingDecision.providers.length > 0,
    `${name} has a non-empty routing decision`);
  eq(c.routingDecision.providers, AGRI_ROUTING[expected as keyof typeof AGRI_ROUTING],
    `${name} routes to the ${expected} provider list`);
}

// ── Phase 7 safety: a <70% photo flags low confidence + the exact line. ──
const blurry = classifyAgriculturalObject({ status: 'unclear', confidencePct: 20 });
ok(blurry.routingDecision.lowConfidence === true, 'blurry photo is low confidence');
eq(blurry.routingDecision.safetyMessage, "We're not confident enough.", 'blurry shows the safety line');
const confident = classifyAgriculturalObject({ objectType: 'leaf', plantName: 'Onion', confidencePct: 90 });
ok(confident.routingDecision.lowConfidence === false, 'a 90% scan is not low confidence');
ok(confident.routingDecision.safetyMessage === null, 'a confident scan shows no safety line');

// ── Specialized engines never fabricate a measured score. ──
const fruit = specializedEngineFor('fruit', { cropName: 'Tomato' });
ok(!!fruit && fruit.engine === 'fruit', 'fruit engine selected');
ok(!!fruit && fruit.findings.every((f) => !f.assessed || f.value !== null),
  'no engine finding is "assessed" with a null/fabricated value');
const ripeness = fruit!.findings.find((f) => f.label === 'Ripeness');
ok(!!ripeness && ripeness.assessed === false && ripeness.value === null,
  'ripeness is honestly not measured (no fabricated %)');

console.log('[test:agri-classifier] PASS — ' + passed + ' assertions (routing + safety + no-fabrication).');
