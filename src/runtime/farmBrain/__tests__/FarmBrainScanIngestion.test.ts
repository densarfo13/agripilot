/**
 * FarmBrainScanIngestion.test.ts — locks the charter Quality Gate "never update the
 * Digital Twin from a failed scan". `tsx FarmBrainScanIngestion.test.ts`.
 * Every failure mode must HOLD ingestion; only a confident, known, trusted scan ingests.
 */
import { evaluateFarmBrainIngestion, ingestionInputFromScan } from '../FarmBrainScanIngestion';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

const GOOD = Object.freeze({
  plantKnown: true, confidencePct: 90, trustPassed: true, providerAuthOk: true,
  photoQualityFailed: false, reviewOnly: false, providerUnavailable: false,
});

// A clean, confident, trusted scan ingests.
ok(evaluateFarmBrainIngestion(GOOD).shouldIngest === true, 'confident known trusted scan → ingests');

// Each failure mode INDIVIDUALLY holds ingestion (the Digital Twin trust gate).
const cases: Array<[Partial<typeof GOOD>, string]> = [
  [{ plantKnown: false },           'plant_unknown'],
  [{ confidencePct: 55 },           'confidence_below_70'],
  [{ trustPassed: false },          'trust_gate_failed'],
  [{ providerAuthOk: false },       'provider_auth_failed'],
  [{ photoQualityFailed: true },    'photo_quality_failed'],
  [{ reviewOnly: true },            'review_only'],
  [{ providerUnavailable: true },   'provider_unavailable'],
];
for (const [patch, blocker] of cases) {
  const d = evaluateFarmBrainIngestion({ ...GOOD, ...patch });
  ok(d.shouldIngest === false, `${blocker} → HELD (no Digital Twin update)`);
  ok(Array.isArray(d.blockers) && d.blockers.includes(blocker), `${blocker} → reported as the blocker`);
}

// Malformed input is held, never ingested.
ok(evaluateFarmBrainIngestion(null as any).shouldIngest === false, 'null input → held');

// ingestionInputFromScan: the precedence-trap coverage — an UNKNOWN / failed scan must
// map to a NON-ingestible input (plantKnown false), regardless of candidate shape.
ok(ingestionInputFromScan({ plantName: 'unknown plant', topCandidates: [{ name: 'x' }] }).plantKnown === false,
  'unknown name (even with candidates) → plantKnown false');
ok(ingestionInputFromScan({ plantName: 'Maize', topCandidates: [] }).plantKnown === false,
  'known name but EMPTY candidate list → plantKnown false (contradicted)');
ok(ingestionInputFromScan({ plantName: 'Maize', topCandidates: [{ name: 'Maize' }] }).plantKnown === true,
  'known name + non-empty candidates → plantKnown true');
ok(ingestionInputFromScan({ plantName: 'Maize' }).plantKnown === true,
  'known name, no candidate field → plantKnown true');
ok(ingestionInputFromScan({ plantName: 'scan unclear' }).plantKnown === false,
  '"scan unclear" → plantKnown false');
ok(ingestionInputFromScan({ status: 'review', plantName: 'Maize' }).reviewOnly === true,
  'review status → reviewOnly true');
ok(ingestionInputFromScan({ serviceUnavailable: true, plantName: 'Maize' }).providerUnavailable === true,
  'serviceUnavailable → providerUnavailable true');
ok(ingestionInputFromScan(null).plantKnown === false, 'null scan → plantKnown false (never throws)');

// End-to-end: a failed scan mapped from ingestionInputFromScan never ingests.
ok(evaluateFarmBrainIngestion(ingestionInputFromScan({ plantName: 'unknown', status: 'unclear' })).shouldIngest === false,
  'failed scan → mapped → HELD end-to-end');

console.log('[test:farmbrain-ingestion] PASS — ' + passed + ' assertions (every failure mode holds Digital Twin ingestion; only a confident, known, trusted scan ingests).');
