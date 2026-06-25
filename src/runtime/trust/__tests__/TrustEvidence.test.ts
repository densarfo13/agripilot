/**
 * TrustEvidence.test.ts — Evidence Engine (Phase 1) + Trust Score Engine (Phase 2).
 * Self-running: `tsx TrustEvidence.test.ts`.
 */
import { buildEvidence } from '../../evidence/EvidenceEngine';
import { scoreTrust } from '../TrustScoreEngine';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }
function eq(a: any, b: any, m: string) { if (a !== b) { console.error(`  ✗ ${m} — got ${JSON.stringify(a)}`); process.exit(1); } passed++; }

// ── Evidence Engine ──
const rich = buildEvidence({ plantIdentified: true, cropStageKnown: true, recentScan: true,
  weatherAvailable: true, farmHistory: true, taskCount: 2, hasScan: true,
  farmBrainState: { hasFirstScan: true, confidence: 85 } });
eq(rich.evidenceLines.length, 5, 'full context → 5 ✓ evidence lines');
ok(rich.evidenceLines.every((l) => l.startsWith('✓')), 'evidence lines are ✓-prefixed');
ok(rich.confidence > 0, 'evidence carries confidence');
ok(rich.dataQuality === 'high' || rich.dataQuality === 'medium', 'evidence carries a data-quality band');
ok(rich.sourceTypes.length > 0, 'evidence carries source types');
const empty = buildEvidence({});
ok(empty.hasEvidence === false, 'no context → no fabricated evidence');
ok(empty.evidenceLines.length === 0, 'empty evidence is truly empty (not invented)');
// No provider/API names leak into evidence lines.
ok(rich.evidenceLines.every((l) => !/plant\.id|crop\.health|insect|ambee|api|model/i.test(l)),
  'evidence lines never name a provider/API');

// ── Trust Score Engine ──
const strong = scoreTrust({ scanQuality: 90, providerAgreement: 85, farmHistory: 70,
  weatherQuality: 80, soilFreshness: 75, taskCompletion: 80, outcomeHistory: 70 });
eq(strong.band, 'high', 'strong agreeing signals → HIGH trust');
const sparse = scoreTrust({ scanQuality: 30 });
ok(sparse.band !== 'high', 'a single weak signal is never HIGH trust');
const none = scoreTrust({});
eq(none.band, 'low', 'no signals → LOW trust (not high-by-default)');
ok(/photo|scan/i.test(none.reason), 'low trust suggests another photo/scan');
ok(strong.score > sparse.score, 'more agreeing evidence → higher internal score');
ok(typeof strong.weakestFactor === 'string', 'reports the weakest factor (for transparency)');

console.log('[test:trust-evidence] PASS — ' + passed + ' assertions (evidence explainable, no fabrication; trust banded honestly).');
