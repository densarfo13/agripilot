/**
 * PlantSafety.test.ts — farmer safety classification.
 * Self-running: `tsx PlantSafety.test.ts`. Proves the real reference safety facts
 * are categorized correctly AND that no safety claim is made without a confident,
 * known identification.
 */
import { classifyPlantSafety, plantSafetyHealth } from '../PlantSafetyEngine';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// Real reference facts → correct categories.
const cassava = classifyPlantSafety('cassava', 'high');
ok(cassava.category === 'PROCESS_BEFORE_EATING', 'cassava → PROCESS_BEFORE_EATING (cyanogenic)');
ok(cassava.icon === '⚠️' && cassava.severity === 'caution', 'cassava carries a caution icon');
ok(/process|cyanogenic/i.test(cassava.reason), 'cassava reason cites the real processing/cyanide fact');

const tomato = classifyPlantSafety('tomato', 92);
ok(tomato.category === 'PARTS_NOT_EDIBLE', 'tomato → PARTS_NOT_EDIBLE (leaves/solanine)');
const cocoa = classifyPlantSafety('cocoa', 'high');
ok(cocoa.category === 'TOXIC_TO_ANIMALS', 'cocoa → TOXIC_TO_ANIMALS (theobromine)');
const onion = classifyPlantSafety('onion', 'high');
ok(onion.category === 'TOXIC_TO_ANIMALS', 'onion → TOXIC_TO_ANIMALS');
const groundnut = classifyPlantSafety('groundnut', 'high');
ok(groundnut.category === 'ALLERGEN', 'groundnut → ALLERGEN (aflatoxin/allergen)');
const maize = classifyPlantSafety('maize', 'high');
ok(maize.category === 'EDIBLE' && maize.icon === '✅', 'maize → EDIBLE with a safe icon');

// Every confident result carries the real reference strings + a reason.
for (const r of [cassava, tomato, cocoa, maize]) {
  ok(typeof r.toxicity === 'string' && r.toxicity!.length > 0, 'confident result carries the real toxicity fact');
  ok(typeof r.reason === 'string' && r.reason.length > 0, 'confident result carries a reason');
  ok(r.confident === true, 'confident result is flagged confident');
}

// HONESTY: never a safety claim without a confident, known match.
const lowConf = classifyPlantSafety('cassava', 'low');
ok(lowConf.category === 'UNKNOWN' && lowConf.icon === '' && lowConf.confident === false, 'low confidence → UNKNOWN, no icon, no claim');
const lowPct = classifyPlantSafety('cassava', 40);
ok(lowPct.category === 'UNKNOWN', 'low % confidence → UNKNOWN (cassava NOT flagged as a guess)');
const unlisted = classifyPlantSafety('rare-orchid-xyz', 'high');
ok(unlisted.category === 'UNKNOWN', 'unlisted plant → UNKNOWN (never a fabricated safety claim)');
const empty = classifyPlantSafety('', 'high');
ok(empty.category === 'UNKNOWN', 'empty name → UNKNOWN');

// Health attestation.
const h = plantSafetyHealth();
ok(h.cassavaProcessed && h.tomatoPartsToxic && h.maizeEdible, 'health attests correct categories for known crops');
ok(h.lowConfidenceUnknown && h.unlistedUnknown, 'health attests no claim without confident+known match');

console.log('[test:plant-safety] PASS — ' + passed + ' assertions (real safety facts categorized; no claim without a confident, known identification).');
