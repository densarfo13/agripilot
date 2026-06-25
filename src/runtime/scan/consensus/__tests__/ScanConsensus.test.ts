/**
 * ScanConsensus.test.ts — MULTI-PROVIDER SCAN ADAPTERS §6/§12 acceptance.
 * Self-running: `tsx ScanConsensus.test.ts`. Proves the consensus safety rules.
 */
import { buildScanConsensus } from '../ScanProviderConsensus';
import { readMushroom, MUSHROOM_NEVER_EAT } from '../../providers/MushroomProvider';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// No disease shown when crop.health returned no result (§6).
const noHealth = buildScanConsensus({ cropName: 'Onion', farmBrain: { confidenceScore: 88 },
  cropHealth: { status: 'UNSUPPORTED' } });
ok(noHealth.health === null, 'no disease shown when crop.health unavailable');
ok(noHealth.healthCheckAvailable === false, 'healthCheckAvailable false → "unavailable" card');

// crop.health READY with disease ≥70% → disease + action.
const ready = buildScanConsensus({ cropName: 'Onion', farmBrain: { confidenceScore: 88 },
  cropHealth: { status: 'READY', disease: 'Leaf blight', confidencePct: 80, treatment: 'Spray copper' } });
ok(ready.health === 'Leaf blight', 'disease shown when crop.health READY');
ok(ready.recommendedAction != null, 'action created above the 70% floor');
ok(!ready.toReviewQueue, 'confident finding not sent to review');

// Low confidence → review queue, no action (§6).
const low = buildScanConsensus({ cropName: 'Onion', farmBrain: { confidenceScore: 40 },
  cropHealth: { status: 'NO_RESULT' } });
ok(low.toReviewQueue === true, 'low confidence → review queue');
ok(low.recommendedAction === null, 'no action from low-confidence finding');
ok(typeof low.confidence === 'number' && low.reason.length > 0, 'result has confidence + reason');

// Mushroom: NEVER a safe/edible claim, even when provider says edible.
const mush = buildScanConsensus({ mushroom: { status: 'READY', species: 'Amanita',
  edibility: 'edible', confidencePct: 95 } });
ok(mush.mushroomWarning === MUSHROOM_NEVER_EAT, 'mushroom shows the never-eat warning');
ok(mush.recommendedAction === null, 'mushroom never produces an edible/safe action');

// The mushroom normalizer never recommends "safe to eat" — only warnings.
const mr = readMushroom({ mushroom: { status: 'READY', species: 'X', edibility: 'edible', confidencePct: 99 } });
ok(mr.recommendations.every((r) => !/safe to eat|edible/i.test(r)), 'mushroom recs are warnings only');
ok(mr.recommendations.includes(MUSHROOM_NEVER_EAT), 'mushroom carries the never-eat warning');

console.log('[test:scan-consensus] PASS — ' + passed + ' assertions (no disease w/o result, 70% floor, mushroom never safe).');
