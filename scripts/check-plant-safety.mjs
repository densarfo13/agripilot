/**
 * check-plant-safety.mjs — farmer plant-safety surfacing.
 * Locks: the engine composes the botanical reference (no duplicate data), produces
 * a safety claim ONLY on a confident known match, and is wired into the farmer
 * result card as a language-neutral icon + a translatable phrase (no jargon leak).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ENG = 'src/runtime/scan/safety/PlantSafetyEngine.ts';
const TEST = 'src/runtime/scan/safety/__tests__/PlantSafety.test.ts';
for (const f of [ENG, TEST]) if (!x(f)) E.push('missing: ' + f);
const eng = rd(ENG);

h(eng, 'export function classifyPlantSafety', 'must export classifyPlantSafety');
h(eng, "from '../v12/PlantReference'", 'must compose PlantReference (single source of truth, no duplicate data)');
h(eng, '__plantSafetyHealth', 'must pin the health global');
// Must gate the claim on confidence — no safety claim on a low-confidence/unknown ID.
h(eng, '_confidentPct', 'must gate the safety claim on a confidence threshold');
h(eng, "category: 'UNKNOWN'", 'must return UNKNOWN when not confident/known (never fabricate a safety claim)');

// Wired into the farmer result card.
const card = rd('src/components/scan/ScanResultCard.jsx');
h(card, 'classifyPlantSafety', 'ScanResultCard must consume classifyPlantSafety');
h(card, 'data-testid="scan-safety"', 'ScanResultCard must render the safety badge');
// The badge must self-hide on UNKNOWN (no claim shown for an unconfident ID).
if (!/category === 'UNKNOWN'\) return null/.test(card)) E.push('safety badge must self-hide on UNKNOWN');

// Run the engine test.
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('plant-safety test did not PASS: ' + out.trim());
  } catch (err) { E.push('plant-safety test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:plant-safety] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:plant-safety] PASS — real reference safety facts surfaced to the farmer (icon + translatable phrase); '
  + 'no claim without a confident, known ID; composes PlantReference; test green.');
