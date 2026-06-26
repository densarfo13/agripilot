/**
 * check-pest-treatment.mjs — pest control surfacing.
 * Locks: the engine composes the curated pest KB through the knowledge layer (no
 * duplicate data), returns a control ONLY on a confident match, NEVER prescribes a
 * specific pesticide, and is wired into the farmer result card (self-hiding on no
 * match). Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ENG = 'src/runtime/scan/treatment/PestTreatmentEngine.ts';
const TEST = 'src/runtime/scan/treatment/__tests__/PestTreatment.test.ts';
for (const f of [ENG, TEST]) if (!x(f)) E.push('missing: ' + f);
const eng = rd(ENG);

h(eng, 'export function controlForPest', 'must export controlForPest');
h(eng, 'knowledge/pests/PestKnowledgeService', 'must access the pest DB through the knowledge layer (not src/data directly)');
h(eng, '__pestTreatmentHealth', 'must pin the health global');
h(eng, '_confident', 'must gate the control on scan confidence');
// SAFETY: must NOT prescribe a specific pesticide — only defer to an officer.
h(eng, 'chemicalNote', 'must carry a chemical CAUTION (officer), not a prescription');
if (/treatmentChemical\s*\)\s*\.map\b/.test(eng)) E.push('must NOT render the specific pesticide list to the farmer');
h(eng, 'extension officer', 'chemical guidance must defer to an extension officer');

// Wired into the farmer result card, self-hiding on no match.
const card = rd('src/components/scan/ScanResultCard.jsx');
h(card, 'controlForPest', 'ScanResultCard must consume controlForPest');
h(card, 'data-testid="scan-pest-control"', 'ScanResultCard must render the pest-control block');
if (!/!_pc\.matched\) return null/.test(card)) E.push('pest-control block must self-hide when there is no confident match');

// Run the engine test.
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('pest-treatment test did not PASS: ' + out.trim());
  } catch (err) { E.push('pest-treatment test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:pest-treatment] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:pest-treatment] PASS — curated organic control + prevention surfaced on a confident match; '
  + 'pesticides deferred to an officer (never prescribed); no control without a real match; composes the pest knowledge layer; test green.');
