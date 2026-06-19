/**
 * check-farmer-completion.mjs — sprint #212 §11.
 * Fails build if the farmer-completion engine is missing nextBestStep,
 * the 8 steps, or the boot install.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const errors = [];
const _read = (r) => { try { return fs.readFileSync(path.join(ROOT, r), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

const ENG = _read('src/runtime/farmerCompletion/FarmerCompletionEngine.ts');
if (!ENG) errors.push('missing FarmerCompletionEngine.ts');
else {
  _has(ENG, 'export function buildFarmerCompletion', 'must export buildFarmerCompletion');
  _has(ENG, 'nextBestStep', 'completion output must include nextBestStep');
  _has(ENG, 'percentComplete', 'completion output must include percentComplete');
  _has(ENG, 'installFarmerCompletionHealthGlobal', 'must export health installer');
}
const CON = _read('src/runtime/farmerCompletion/FarmerCompletionContracts.ts');
for (const s of ['farmCreated', 'locationAdded', 'cropSelected', 'plantingDateAdded',
  'firstScanCompleted', 'firstTaskCompleted', 'firstOutcomeRecorded',
  'firstHarvestOrSellDraftCreated']) {
  _has(CON, s, 'completion must track step: ' + s);
}
_has(_read('src/runtime/farmerCompletion/FarmerNextStepEngine.ts'),
  'export function computeNextStep', 'must export computeNextStep');
_has(_read('src/App.jsx'), 'installFarmerCompletionHealthGlobal',
  'App.jsx must boot-install farmer completion health');

if (errors.length) { console.error('[check:farmer-completion] FAIL'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
console.log('[check:farmer-completion] PASS — 8-step engine + nextBestStep + boot install.');
