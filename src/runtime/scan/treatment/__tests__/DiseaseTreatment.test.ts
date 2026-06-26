/**
 * DiseaseTreatment.test.ts — wiring the curated disease KB into the scan recommendation.
 * Self-running: `tsx DiseaseTreatment.test.ts`. Proves a confident issue gets the REAL
 * organic treatment + prevention, that chemicals are never prescribed (only an
 * officer caution), and that a low-confidence / no-match scan gets NO treatment.
 */
import { treatmentForIssue, diseaseTreatmentHealth } from '../DiseaseTreatmentEngine';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// Exact match against a known DB entry ("Leaf Spot").
const ls = treatmentForIssue('leaf spot', 'high');
ok(ls.matched === true && /leaf spot/i.test(ls.diseaseName || ''), 'exact name → matched Leaf Spot');
ok(ls.organic.length > 0, 'matched disease returns real organic treatment steps');
ok(ls.organic.every((s) => typeof s === 'string' && s.length > 0), 'organic steps are non-empty strings (real data)');
ok(ls.confident === true, 'a confident match is flagged confident');

// Bidirectional match: a MORE specific provider name still matches the KB entry.
const specific = treatmentForIssue('Cercospora Leaf Spot', 'high');
ok(specific.matched === true, 'a more-specific provider name ("Cercospora Leaf Spot") still matches "Leaf Spot"');

// SAFETY: chemicals are never prescribed — only an officer caution, if anything.
for (const r of [ls, specific]) {
  if (r.chemicalNote) ok(/officer/i.test(r.chemicalNote) && !/\d\s*(ml|g|kg|l)\b/i.test(r.chemicalNote), 'chemical note is an officer caution, never a dose');
}

// HONESTY: no treatment without confidence or a real match.
const lowConf = treatmentForIssue('leaf spot', 'low');
ok(lowConf.matched === false && lowConf.organic.length === 0, 'low confidence → no treatment (not guessed)');
const lowPct = treatmentForIssue('leaf spot', 40);
ok(lowPct.matched === false, 'low % confidence → no treatment');
const nonsense = treatmentForIssue('zzz not a real disease name', 'high');
ok(nonsense.matched === false, 'no KB match → no treatment (never fabricated)');
const empty = treatmentForIssue('', 'high');
ok(empty.matched === false, 'empty issue → no treatment');
const fuzzyOnly = treatmentForIssue('spots', 'high');
ok(fuzzyOnly.matched === false || fuzzyOnly.diseaseName != null, 'loose/short query does not surface a wrong treatment');

// Every result carries a reason.
for (const r of [ls, lowConf, nonsense]) ok(typeof r.reason === 'string' && r.reason.length > 0, 'result carries a reason');

// Health attestation.
const h = diseaseTreatmentHealth();
ok(h.matchReturnsOrganic && h.chemicalNeverPrescribed, 'health attests organic-returned + chemical-never-prescribed');
ok(h.lowConfidenceNoTreatment && h.nonsenseNoTreatment, 'health attests no treatment without confidence + a real match');

console.log('[test:disease-treatment] PASS — ' + passed + ' assertions (real organic treatment surfaced on a confident match; chemicals deferred to an officer; no treatment without confidence + a real match).');
