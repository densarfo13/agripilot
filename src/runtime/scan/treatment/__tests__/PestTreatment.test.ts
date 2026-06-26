/**
 * PestTreatment.test.ts — wiring the curated pest KB into the scan recommendation.
 * Self-running: `tsx PestTreatment.test.ts`. Proves a confident pest gets the REAL
 * organic control + prevention, that pesticides are never prescribed (only an officer
 * caution), and that a low-confidence / no-match scan gets NO control.
 */
import { controlForPest, pestTreatmentHealth } from '../PestTreatmentEngine';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// Exact match against a known DB entry ("Aphids").
const ap = controlForPest('aphids', 'high');
ok(ap.matched === true && /aphid/i.test(ap.pestName || ''), 'exact name → matched Aphids');
ok(ap.organic.length > 0, 'matched pest returns real organic control steps');
ok(ap.organic.every((s) => typeof s === 'string' && s.length > 0), 'organic steps are non-empty strings (real data)');
ok(ap.confident === true, 'a confident match is flagged confident');

// Bidirectional match: a MORE specific provider name still matches the KB entry.
const specific = controlForPest('Aphids infestation', 'high');
ok(specific.matched === true, 'a more-specific provider name ("Aphids infestation") still matches "Aphids"');

// SAFETY: pesticides are never prescribed — only an officer caution, if anything.
for (const r of [ap, specific]) {
  if (r.chemicalNote) ok(/officer/i.test(r.chemicalNote) && !/\d\s*(ml|g|kg|l)\b/i.test(r.chemicalNote), 'chemical note is an officer caution, never a dose');
}

// HONESTY: no control without confidence or a real match.
const lowConf = controlForPest('aphids', 'low');
ok(lowConf.matched === false && lowConf.organic.length === 0, 'low confidence → no control (not guessed)');
const lowPct = controlForPest('aphids', 35);
ok(lowPct.matched === false, 'low % confidence → no control');
const nonsense = controlForPest('zzz not a real pest name', 'high');
ok(nonsense.matched === false, 'no KB match → no control (never fabricated)');
const empty = controlForPest('', 'high');
ok(empty.matched === false, 'empty issue → no control');

// Every result carries a reason.
for (const r of [ap, lowConf, nonsense]) ok(typeof r.reason === 'string' && r.reason.length > 0, 'result carries a reason');

// Health attestation.
const h = pestTreatmentHealth();
ok(h.matchReturnsOrganic && h.chemicalNeverPrescribed, 'health attests organic-returned + pesticide-never-prescribed');
ok(h.lowConfidenceNoControl && h.nonsenseNoControl, 'health attests no control without confidence + a real match');

console.log('[test:pest-treatment] PASS — ' + passed + ' assertions (real organic control surfaced on a confident pest match; pesticides deferred to an officer; no control without confidence + a real match).');
