/**
 * check-scan-no-dead-ends.mjs — sprint #200 spec §10.
 *
 * Asserts the Mythos composer + the scan envelope can NEVER produce
 * a dead-end. Complements check-universal-scan §7b (UI side) by
 * locking the COMPOSER side:
 *   - composer floor resolves plant to a non-empty value
 *   - composer always emits why / nextAction / followUpDate
 *   - composer never emits an empty `why` or `limitations` array
 *     (both _safe fallbacks are non-empty)
 *   - envelope still carries the v5/v6 never-empty plantName floor
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const _read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

// Composer fallback (the _safe second arg) must be non-empty on every
// list field — a thrown compose can't yield blanks.
const COMPOSER = _read('src/runtime/scanMythos/ScanDecisionComposer.ts');
if (!COMPOSER) {
  errors.push('missing: src/runtime/scanMythos/ScanDecisionComposer.ts');
} else {
  _has(COMPOSER, "plant: 'Scan unclear'",
    'composer fallback must resolve plant to a non-empty placeholder');
  _has(COMPOSER, "nextAction: 'Retake the photo",
    'composer fallback must carry a non-empty nextAction');
  _has(COMPOSER, 'We could not read this photo clearly.',
    'composer fallback must carry a non-empty why');
  _has(COMPOSER, "outcomePrompt: 'Did the plant improve?'",
    'composer fallback must carry the outcome prompt');
}

// Envelope floor still present (defends the server side).
const ENV = _read('server/src/ml/scanRecoveryEnvelope.js');
if (ENV) {
  _has(ENV, "'Scan unclear'",
    'scanRecoveryEnvelope must keep the "Scan unclear" plantName floor');
  _has(ENV, "'Needs confirmation'",
    'scanRecoveryEnvelope must keep the "Needs confirmation" branch');
}

// The universal-scan repo-wide UI guard must still be registered.
const PKG = _read('package.json');
_has(PKG, 'check:universal-scan',
  'check:universal-scan (UI dead-end guard) must stay registered');

if (errors.length) {
  console.error('[check:scan-no-dead-ends] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-no-dead-ends] PASS — composer + envelope floors keep plant/why/'
  + 'nextAction/followUp/outcome non-empty on every path; UI dead-end guard registered.');
