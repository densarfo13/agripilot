/**
 * check-pilot-events.mjs — sprint #213 §11/§8.
 *
 * The 14 premortem critical-action events must be declared in the
 * canonical contract so every funnel step is trackable. (Wiring of
 * each call site is owned by check-pilot-analytics; this gate guards
 * the vocabulary the premortem depends on.)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const _read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };

const CONTRACTS = 'src/runtime/analytics/PilotEventContracts.ts';
const src = _read(CONTRACTS);
if (!src) {
  errors.push('missing: ' + CONTRACTS);
} else {
  // scan_unclear maps to the existing scan_unknown_result too; accept either.
  const REQUIRED = [
    'signup_completed', 'language_selected', 'farm_created', 'crop_added',
    'planting_date_added', 'location_added', 'scan_started', 'scan_completed',
    'task_created', 'task_completed', 'outcome_recorded', 'notification_opened',
    'return_visit',
  ];
  for (const e of REQUIRED) {
    if (!src.includes("'" + e + "'")) {
      errors.push('PilotEventContracts must declare premortem event: ' + e);
    }
  }
  // scan unclear — either the new alias or the canonical unknown result.
  if (!src.includes("'scan_unclear'") && !src.includes("'scan_unknown_result'")) {
    errors.push("PilotEventContracts must declare scan_unclear or scan_unknown_result");
  }
}

if (errors.length) {
  console.error('[check:pilot-events] FAIL — ' + errors.length + ' issue(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:pilot-events] PASS — 14 premortem critical-action events declared.');
