/**
 * check-disease-treatment.mjs — disease treatment surfacing.
 * Locks: the engine composes the curated disease DB (no duplicate data), returns a
 * treatment ONLY on a confident match, NEVER prescribes a specific chemical, and is
 * wired into the farmer result card (self-hiding on no match). Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ENG = 'src/runtime/scan/treatment/DiseaseTreatmentEngine.ts';
const TEST = 'src/runtime/scan/treatment/__tests__/DiseaseTreatment.test.ts';
for (const f of [ENG, TEST]) if (!x(f)) E.push('missing: ' + f);
const eng = rd(ENG);

h(eng, 'export function treatmentForIssue', 'must export treatmentForIssue');
h(eng, 'knowledge/diseases/DiseaseKnowledgeService', 'must access the disease DB through the knowledge layer (not src/data directly)');
h(eng, '__diseaseTreatmentHealth', 'must pin the health global');
h(eng, '_confident', 'must gate the treatment on scan confidence');
// SAFETY: must NOT prescribe a specific chemical — only defer to an officer.
h(eng, 'chemicalNote', 'must carry a chemical CAUTION (officer), not a prescription');
// Anti-pattern = rendering the chemical list: `...treatmentChemical).map(...)`.
// (Match the access+map directly, NOT the word anywhere in the file/comments.)
if (/treatmentChemical\s*\)\s*\.map\b/.test(eng)) E.push('must NOT render the specific chemical treatment list to the farmer');
h(eng, 'extension officer', 'chemical guidance must defer to an extension officer');

// Wired into the farmer result card, self-hiding on no match.
const card = rd('src/components/scan/ScanResultCard.jsx');
h(card, 'treatmentForIssue', 'ScanResultCard must consume treatmentForIssue');
h(card, 'data-testid="scan-treatment"', 'ScanResultCard must render the treatment block');
if (!/!_tx\.matched\) return null/.test(card)) E.push('treatment block must self-hide when there is no confident match');

// Run the engine test.
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('disease-treatment test did not PASS: ' + out.trim());
  } catch (err) { E.push('disease-treatment test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:disease-treatment] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:disease-treatment] PASS — curated organic treatment + prevention surfaced on a confident match; '
  + 'chemicals deferred to an officer (never prescribed); no treatment without a real match; composes the disease DB; test green.');
