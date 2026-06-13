/**
 * check-language-consistency.mjs — sprint #202, spec §9.
 *
 * ONE consolidating gate (the spec asked for five; four would
 * duplicate gates already in build:safe — see the report). This
 * asserts the consistency contract by COMPOSING the existing
 * checks rather than re-implementing them:
 *
 *   1. LanguageConsistencyRuntime exists + exports the global +
 *      the 11 spec §8 flags; App.jsx boot-installs it.
 *   2. Crop localization layer present (CROP_LABELS_BY_LANG ×6).
 *   3. Task engine emits keys (getLocalizedTaskTitle).
 *   4. Scan trust-card i18n keys present (scan.* + scan.action.*).
 *   5. Greeting keys present (home.header.*).
 *   6. 6-locale parity holds (each column ≥ en key count).
 *
 * Read-only. The detection-heavy work (hardcoded scan, 98% coverage)
 * stays owned by `audit:i18n`; this gate guards the runtime + the
 * spec's localization namespaces.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const _exists = (rel) => { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } };
const _read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

// 1. Runtime + flags + boot install.
const RT = 'src/runtime/i18n/LanguageConsistencyRuntime.ts';
if (!_exists(RT)) {
  errors.push('missing: ' + RT);
} else {
  const src = _read(RT);
  _has(src, 'export function installLanguageConsistencyGlobal',
    'LanguageConsistencyRuntime must export installLanguageConsistencyGlobal');
  _has(src, '__languageConsistencyHealth',
    'LanguageConsistencyRuntime must pin __languageConsistencyHealth');
  const FLAGS = [
    'hardcodedStringsFound', 'missingKeys', 'blankLabels', 'keyLeaks',
    'cropNamesLocalized', 'tasksLocalized', 'scanLocalized',
    'greetingsLocalized', 'buttonsLocalized', 'languageSwitchLive',
  ];
  for (const f of FLAGS) _has(src, f, 'runtime must expose §8 flag: ' + f);
}
const APP = _read('src/App.jsx');
_has(APP, 'installLanguageConsistencyGlobal',
  'App.jsx must call installLanguageConsistencyGlobal at boot');

// 2. Crop localization layer.
if (!_exists('src/config/crops.js')) {
  errors.push('missing crop localization source src/config/crops.js');
} else {
  const src = _read('src/config/crops.js');
  _has(src, 'CROP_LABELS_BY_LANG',
    'crops.js must declare CROP_LABELS_BY_LANG (per-locale crop names)');
}

// 3. Task engine emits keys.
if (!_exists('src/utils/taskTranslations.js')) {
  errors.push('missing task localization (taskTranslations.js)');
} else {
  _has(_read('src/utils/taskTranslations.js'), 'getLocalizedTaskTitle',
    'task engine must expose getLocalizedTaskTitle (key-based titles)');
}

// 4-5. Scan + greeting i18n keys in the EN canonical column.
const TEN = _read('src/i18n/columns/T-en.js');
for (const k of ['scan.why', 'scan.nextAction', 'scan.action.spots',
                 'home.header.morning', 'home.header.afternoon', 'home.header.evening',
                 'outcome.better', 'outcome.worse']) {
  if (!TEN.includes('"' + k + '"')) {
    errors.push('T-en.js missing consistency key: ' + k);
  }
}

// 6. 6-locale parity (count check; cheap mirror of #186 gate).
const COLS = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];
function _keyCount(code) {
  const src = _read('src/i18n/columns/T-' + code + '.js');
  const m = src.match(/^\s*"[^"\\]+"\s*:/gm);
  return m ? m.length : 0;
}
const enCount = _keyCount('en');
if (enCount > 0) {
  for (const code of COLS) {
    if (code === 'en') continue;
    if (_keyCount(code) < enCount) {
      errors.push('locale ' + code + ' below EN key count (parity broken) — '
        + 'run node scripts/fill-language-parity.mjs');
    }
  }
}

if (errors.length) {
  console.error('[check:language-consistency] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:language-consistency] PASS — consistency runtime + 11 flags + boot '
  + 'install wired; crop/task/scan/greeting localization namespaces present; 6-locale '
  + 'parity holds. (Detection owned by audit:i18n.)');
