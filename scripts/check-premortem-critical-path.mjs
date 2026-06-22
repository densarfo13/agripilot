/**
 * check-premortem-critical-path.mjs — sprint #213 §11.
 *
 * Locks the premortem: the __pilotPremortemHealth composite must
 * exist + be boot-installed, expose the 8 dimensions, and COMPOSE the
 * failure-prevention probes (it must not silently drop one). Also
 * asserts the critical-path protections each still ship (their gates
 * own detection; this gate guards the composite + wiring).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const _exists = (rel) => { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } };
const _read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

// 1. Premortem composite exists + 8 dimensions.
const RT = 'src/runtime/premortem/PilotPremortemRuntime.ts';
if (!_exists(RT)) {
  errors.push('missing: ' + RT);
} else {
  const src = _read(RT);
  _has(src, 'export function installPilotPremortemHealthGlobal',
    'PilotPremortemRuntime must export installPilotPremortemHealthGlobal');
  _has(src, '__pilotPremortemHealth',
    'PilotPremortemRuntime must pin __pilotPremortemHealth');
  for (const d of ['criticalPathReady', 'mobileReady', 'languageLeaks',
    'scanNoDeadEnds', 'tasksNoDuplicates', 'emptyStatesGuided',
    'analyticsReady', 'errorRecoveryReady']) {
    _has(src, d, 'premortem health must expose dimension: ' + d);
  }
  // Must compose (read) the underlying probes — not fake the verdict.
  for (const p of ['__farmerCompletionHealth', '__farrowayLanguageLeaks',
    '__scanMythosHealth', '__taskDedupHealth', '__notificationDedupHealth',
    '__pilotAnalyticsHealth']) {
    _has(src, p, 'premortem composite must read probe: ' + p);
  }
}

// 2. Boot install.
_has(_read('src/App.jsx'), 'installPilotPremortemHealthGlobal',
  'App.jsx must boot-install installPilotPremortemHealthGlobal');

// 3. The critical-path protection gates each still exist.
for (const g of [
  'scripts/check-scan-no-dead-ends.mjs',
  'scripts/check-empty-state-guidance.mjs',
  'scripts/check-language-leaks-final.mjs',
  'scripts/check-task-dedup.mjs',
  'scripts/check-notification-dedup.mjs',
  'scripts/check-farmer-completion.mjs',
]) {
  if (!_exists(g)) errors.push('premortem requires protection gate: ' + g);
}

if (errors.length) {
  console.error('[check:premortem-critical-path] FAIL — ' + errors.length + ' issue(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:premortem-critical-path] PASS — __pilotPremortemHealth composite '
  + 'wired over 6 protection probes; 8 dimensions present; all critical-path gates ship.');
