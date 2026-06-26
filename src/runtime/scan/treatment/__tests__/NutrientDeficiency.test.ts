/**
 * NutrientDeficiency.test.ts — wiring the curated nutrient KB into the scan, SAFELY.
 * Self-running: `tsx NutrientDeficiency.test.ts`. The headline guarantee: across the
 * WHOLE nutrient DB, no surfaced correction line ever contains a synthetic fertiliser
 * or dose — those are deferred to an extension officer. Plus the usual honesty gates.
 */
import { nutrientGuidanceForIssue, nutrientGuidanceHealth } from '../NutrientDeficiencyEngine';
import { listNutrients } from '../../../../knowledge/nutrients/NutrientKnowledgeService';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

const DOSE_OR_FERT = /\burea\b|\bnpk\b|\bdap\b|\bssp\b|\bmop\b|\bsop\b|superphosphate|muriate|potassium nitrate|calcium chloride|foliar|\d+\s*-\s*\d+\s*-\s*\d+|\d+(\.\d+)?\s*%/i;

// Exact match against a known DB entry ("Nitrogen Deficiency").
const n = nutrientGuidanceForIssue('nitrogen deficiency', 'high');
ok(n.matched === true && /nitrogen/i.test(n.nutrientName || ''), 'exact name → matched Nitrogen Deficiency');
ok(n.organic.length > 0 || n.prevention.length > 0, 'matched deficiency returns real safe guidance');
ok(n.confident === true, 'a confident match is flagged confident');

// SAFETY HEADLINE: every surfaced correction line, for EVERY deficiency, is synthetic-free.
for (const entry of listNutrients() as any[]) {
  const g = nutrientGuidanceForIssue(entry.name, 'high');
  for (const line of g.organic) ok(!DOSE_OR_FERT.test(line), 'no surfaced correction line carries a fertiliser/dose: "' + line + '"');
  for (const line of g.prevention) ok(!DOSE_OR_FERT.test(line), 'no surfaced prevention line carries a fertiliser/dose: "' + line + '"');
}

// Nitrogen's KB has urea → fertiliser must be DEFERRED (officer caveat shown by the card).
ok(n.fertiliserDeferred === true, 'nitrogen (KB has urea) defers fertiliser to the officer');

// Bidirectional / alias match still works.
const specific = nutrientGuidanceForIssue('possible nitrogen deficiency in maize', 'high');
ok(specific.matched === true, 'a more-specific provider phrase still matches the deficiency');

// HONESTY: nothing without confidence or a real match.
const lowConf = nutrientGuidanceForIssue('nitrogen deficiency', 'low');
ok(lowConf.matched === false, 'low confidence → no guidance (not guessed)');
const lowPct = nutrientGuidanceForIssue('nitrogen deficiency', 30);
ok(lowPct.matched === false, 'low % confidence → no guidance');
const nonsense = nutrientGuidanceForIssue('zzz not a real deficiency', 'high');
ok(nonsense.matched === false, 'no KB match → no guidance (never fabricated)');
const empty = nutrientGuidanceForIssue('', 'high');
ok(empty.matched === false, 'empty issue → no guidance');

// Health attestation.
const h = nutrientGuidanceHealth();
ok(h.organicNeverSynthetic === true, 'health attests: no organic line across the DB is synthetic');
ok(h.defersFertiliser === true, 'health attests: fertiliser deferred');
ok(h.lowConfidenceNoGuidance && h.nonsenseNoGuidance, 'health attests no guidance without confidence + a real match');

console.log('[test:nutrient-deficiency] PASS — ' + passed + ' assertions (safe organic correction surfaced; NO fertiliser/dose ever leaks across the whole DB; fertiliser deferred to an officer; no guidance without confidence + a real match).');
