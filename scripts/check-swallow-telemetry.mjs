/**
 * check-swallow-telemetry.mjs — structured swallowed-error telemetry.
 * Verifies the sink categorizes (INFO/WARNING/ERROR/CRITICAL), never throws,
 * snapshots, and is wired into the App boot. Test + regression guard in one.
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const E = [];
const LIB = 'src/lib/swallowTelemetry.js';
const src = fs.readFileSync(path.join(R, LIB), 'utf8');

for (const tok of ['export const SEVERITY', 'export function reportSwallowed', 'export function installSwallowTelemetry', 'swallowedErrorsSnapshot', '__swallowedErrors'])
  if (!src.includes(tok)) E.push('missing export/token: ' + tok);
for (const sev of ['INFO', 'WARNING', 'ERROR', 'CRITICAL']) if (!src.includes(sev)) E.push('missing severity: ' + sev);
// Must be wired into boot.
const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
if (!/installSwallowTelemetry\(\)/.test(app)) E.push('App.jsx boot must install swallow telemetry');
if (!/reportSwallowed/.test(app)) E.push('App.jsx boot must route at least one swallow through reportSwallowed');

// Behavioural test of the actual module.
if (E.length === 0) {
  const mod = await import('file://' + path.join(R, LIB).replace(/\\/g, '/'));
  const { reportSwallowed, SEVERITY, swallowedErrorsSnapshot, resetSwallowTelemetry } = mod;
  resetSwallowTelemetry();
  // never throws on any input shape
  let threw = false;
  try {
    reportSwallowed(SEVERITY.INFO, 'a', 'string err');
    reportSwallowed(SEVERITY.WARNING, 'b', new Error('boom'));
    reportSwallowed(SEVERITY.ERROR, 'c', { message: 'objlike' });
    reportSwallowed(SEVERITY.CRITICAL, 'd', null);
    reportSwallowed('NONSENSE', 'e', undefined);   // unknown severity → WARNING bucket
  } catch { threw = true; }
  if (threw) E.push('reportSwallowed threw — the sink must never throw');
  const snap = swallowedErrorsSnapshot();
  if (snap.counts.INFO !== 1) E.push('INFO count wrong: ' + snap.counts.INFO);
  if (snap.counts.CRITICAL !== 1) E.push('CRITICAL count wrong: ' + snap.counts.CRITICAL);
  if (snap.counts.WARNING !== 2) E.push('WARNING count should include the unknown-severity fallback: ' + snap.counts.WARNING);
  if (snap.total !== 5) E.push('total wrong: ' + snap.total);
  if (!Array.isArray(snap.recent) || snap.recent.length === 0) E.push('snapshot.recent must be a non-empty array');
  resetSwallowTelemetry();
}

if (E.length) {
  console.error('[check:swallow-telemetry] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:swallow-telemetry] PASS — structured sink (INFO/WARNING/ERROR/CRITICAL), never throws, snapshots, wired into boot.');
