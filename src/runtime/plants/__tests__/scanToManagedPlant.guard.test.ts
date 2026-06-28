/**
 * scanToManagedPlant.guard.test.ts — P0 safety: an UNKNOWN / low-confidence scan must
 * never become a My Plants entity (and so never feeds FarmBrain or spawns tasks).
 * Self-running: `tsx scanToManagedPlant.guard.test.ts`.
 */
import { isUnconfirmedScan, scanToManagedPlant } from '../scanToManagedPlant';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── isUnconfirmedScan ─────────────────────────────────────────────
ok(isUnconfirmedScan({ plantName: 'Unknown plant' }) === true, 'unknown name → unconfirmed');
ok(isUnconfirmedScan({ plantName: 'Plant' }) === true, 'placeholder "Plant" → unconfirmed');
ok(isUnconfirmedScan({ plantName: '' }) === true, 'empty name → unconfirmed');
ok(isUnconfirmedScan({ plantName: 'Tomato', confidence: 40 }) === true, 'known name but low % confidence → unconfirmed');
ok(isUnconfirmedScan({ plantName: 'Tomato', confidenceLabel: 'low' }) === true, 'low confidence label → unconfirmed');
ok(isUnconfirmedScan({ plantName: 'Tomato', confidence: 0.92 }) === false, 'known + high confidence (0..1) → confirmed');
ok(isUnconfirmedScan({ plantName: 'Tomato', confidence: 88 }) === false, 'known + high confidence (0..100) → confirmed');
ok(isUnconfirmedScan({ plantName: 'Tomato' }) === false, 'known name, no confidence field → NOT blocked (avoid false-negatives)');
ok(isUnconfirmedScan(null) === true, 'null scan → unconfirmed');

// ── scanToManagedPlant eligibility ────────────────────────────────
const unknown = scanToManagedPlant({ scanResult: { plantId: 'x', plantName: 'Unknown plant', scanId: 's1' }, existingPlants: [] });
ok(unknown.eligible === false && unknown.reason === 'unknown_plant', 'unknown plant → ineligible (unknown_plant)');

const lowConf = scanToManagedPlant({ scanResult: { plantId: 'x', plantName: 'Tomato', confidence: 35, scanId: 's2' }, existingPlants: [] });
ok(lowConf.eligible === false && lowConf.reason === 'low_confidence', 'low confidence → ineligible (low_confidence)');

const noId = scanToManagedPlant({ scanResult: { plantName: 'Tomato', confidence: 95, scanId: 's3' }, existingPlants: [] });
ok(noId.eligible === false && noId.reason === 'scan_has_no_plant_id', 'no plantId → ineligible (no candidates)');

const good = scanToManagedPlant({ scanResult: { plantId: 'tomato', plantName: 'Tomato', commonName: 'Tomato', confidence: 92, scanId: 's4' }, existingPlants: [] });
ok(good.eligible === true, 'confident known plant with id → eligible (successful detection)');

// Defense-in-depth: the store refuses the unsafe creation even if a UI button were shown.
ok(scanToManagedPlant({ scanResult: { plantId: 'x', plantName: '', scanId: 's5' }, existingPlants: [] }).eligible === false,
  'empty-name scan can never create a managed plant (→ FarmBrain never ingests it, no tasks)');

console.log('[test:scan-unknown-guard] PASS — ' + passed + ' assertions (unknown / low-confidence scans can never become a My Plants entity; confident known plants still can).');
