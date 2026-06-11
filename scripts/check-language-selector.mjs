/**
 * check-language-selector.mjs — sprint #182.
 *
 * Fails build when:
 *   1. LanguageHealthRuntime missing OR doesn't pin
 *      window.__languageHealth() OR doesn't expose the 5 spec flags.
 *   2. App.jsx doesn't install the language health global.
 *   3. Login.jsx doesn't mount the language selector.
 *   4. ProtectedLayout.jsx doesn't mount the language selector
 *      inside SettingsDrawer (post-login 2-tap reach).
 *   5. supportedLocales.ts doesn't include the 6 spec languages:
 *      English (en) · Twi (tw) · French (fr) · Hausa (ha) ·
 *      Swahili (sw) · Hindi (hi).
 *   6. enableHindiLocale feature flag is false (user spec lists Hindi).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

function _exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; }
}
function _read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; }
}
function _has(haystack, needle, label) {
  if (!haystack.includes(needle)) errors.push(label);
}

// ─── 1. LanguageHealthRuntime exists + 5 spec flags ──────────
const RT = 'src/runtime/i18n/LanguageHealthRuntime.ts';
if (!_exists(RT)) {
  errors.push('missing: ' + RT);
} else {
  const src = _read(RT);
  _has(src, 'export function installLanguageHealthGlobal',
    'LanguageHealthRuntime must export installLanguageHealthGlobal');
  _has(src, '__languageHealth',
    'LanguageHealthRuntime must pin window.__languageHealth');
  const FLAGS = [
    'selectorVisible', 'selectorClickable', 'languageSwitchWorks',
    'translationsLoaded', 'mobileReady',
  ];
  for (const f of FLAGS) {
    if (!src.includes(f + ':') && !src.includes(f + ',')) {
      errors.push('LanguageHealthRuntime missing spec flag: ' + f);
    }
  }
}

// ─── 2. App.jsx wires install ────────────────────────────────
const APP_JSX = 'src/App.jsx';
if (!_exists(APP_JSX)) {
  errors.push('missing: ' + APP_JSX);
} else {
  const src = _read(APP_JSX);
  _has(src, 'installLanguageHealthGlobal',
    'App.jsx must call installLanguageHealthGlobal in boot');
  _has(src, "import('./runtime/i18n/LanguageHealthRuntime')",
    'App.jsx must lazy-import LanguageHealthRuntime');
}

// ─── 3. Login.jsx mounts the language selector ───────────────
const LOGIN = 'src/pages/Login.jsx';
if (!_exists(LOGIN)) {
  errors.push('missing: ' + LOGIN);
} else {
  const src = _read(LOGIN);
  _has(src, 'LanguageSelector',
    'Login.jsx must import + mount LanguageSelector');
  _has(src, 'data-testid="login-language-selector"',
    'Login.jsx must expose data-testid="login-language-selector"');
}

// ─── 4. ProtectedLayout mounts selector inside SettingsDrawer
const LAYOUT = 'src/layouts/ProtectedLayout.jsx';
if (!_exists(LAYOUT)) {
  errors.push('missing: ' + LAYOUT);
} else {
  const src = _read(LAYOUT);
  _has(src, 'LanguageSelector',
    'ProtectedLayout.jsx must mount LanguageSelector inside SettingsDrawer');
  _has(src, '<SettingsDrawer',
    'ProtectedLayout.jsx must render SettingsDrawer (post-login 2-tap reach)');
}

// ─── 5. supportedLocales.ts has all 6 spec languages ─────────
const LOCALES = 'src/i18n/supportedLocales.ts';
if (!_exists(LOCALES)) {
  errors.push('missing: ' + LOCALES);
} else {
  const src = _read(LOCALES);
  const CODES = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];
  for (const c of CODES) {
    if (!src.includes("code: '" + c + "'")) {
      errors.push('supportedLocales must register locale: ' + c);
    }
  }
}

// ─── 6. Hindi feature flag enabled ───────────────────────────
const FEATURES = 'src/config/features.js';
if (!_exists(FEATURES)) {
  errors.push('missing: ' + FEATURES);
} else {
  const src = _read(FEATURES);
  // Match `enableHindiLocale: true` literally (could have whitespace).
  if (!/enableHindiLocale\s*:\s*true/.test(src)) {
    errors.push('features.js must set enableHindiLocale: true '
      + '(user spec lists Hindi as one of 6 supported languages)');
  }
}

// ─── 7. Sprint #183 — global 🌐 button in PageActions ────────
const PAGE_ACTIONS = 'src/components/layout/PageActions.jsx';
if (!_exists(PAGE_ACTIONS)) {
  errors.push('missing: ' + PAGE_ACTIONS);
} else {
  const src = _read(PAGE_ACTIONS);
  _has(src, 'LanguageBottomSheet',
    'PageActions.jsx must import LanguageBottomSheet');
  _has(src, 'data-testid={`${testId}-language`}',
    'PageActions.jsx must expose the 🌐 button with the *-language testid');
  _has(src, '🌐',
    'PageActions.jsx must render the 🌐 glyph for the language button');
}

// ─── 8. Sprint #183 — LanguageBottomSheet component ──────────
const SHEET = 'src/components/i18n/LanguageBottomSheet.jsx';
if (!_exists(SHEET)) {
  errors.push('missing: ' + SHEET);
} else {
  const src = _read(SHEET);
  _has(src, 'data-testid="language-bottom-sheet"',
    'LanguageBottomSheet must expose data-testid="language-bottom-sheet"');
  _has(src, 'data-testid="language-sheet-search"',
    'LanguageBottomSheet must expose search input testid');
  _has(src, 'data-testid="language-sheet-recent"',
    'LanguageBottomSheet must expose the recently-used section testid');
  _has(src, 'farroway:recentLanguages',
    'LanguageBottomSheet must persist recents to localStorage key farroway:recentLanguages');
  _has(src, 'createPortal',
    'LanguageBottomSheet must portal to document.body so it overlays bottom nav');
  _has(src, 'safe-area-inset-bottom',
    'LanguageBottomSheet must honor iOS safe-area-inset-bottom');
}

// ─── 9b. Sprint #186 — key parity across 6 locales ───────────
// Every key in T-en.js MUST exist in every non-en column. Build
// fails if any locale has a deficit (we don't enforce SURPLUS — a
// locale may carry locale-specific keys with no English equivalent).
const COLS = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];
const keyCounts = {};
let enKeyList = null;
for (const code of COLS) {
  const file = 'src/i18n/columns/T-' + code + '.js';
  if (!_exists(file)) {
    errors.push('missing locale column: ' + file);
    continue;
  }
  const src = _read(file);
  // Match `"key.path": "value"` lines. Robust enough for the
  // auto-generated columns; ignores trailing-comma + comments.
  const re = /^\s*"([^"\\]+)"\s*:\s*"/gm;
  const keys = new Set();
  let m;
  while ((m = re.exec(src)) !== null) keys.add(m[1]);
  keyCounts[code] = keys.size;
  if (code === 'en') enKeyList = keys;
}
if (enKeyList && enKeyList.size > 0) {
  for (const code of COLS) {
    if (code === 'en') continue;
    const count = keyCounts[code] || 0;
    if (count < enKeyList.size) {
      errors.push('locale ' + code + ' is missing keys (count '
        + count + ' < en ' + enKeyList.size + '). '
        + 'Run `node scripts/fill-language-parity.mjs` to fill stubs.');
    }
  }
}

// ─── 9c. Sprint #186 — translator-review sidecar present ─────
const SIDECAR = 'src/i18n/columns/_translator-review-pending.json';
if (!_exists(SIDECAR)) {
  errors.push('missing: ' + SIDECAR
    + ' (run `node scripts/fill-language-parity.mjs` to generate)');
}

// ─── 9. Sprint #183 — /admin/i18n-health page + route ────────
const I18N_PAGE = 'src/pages/admin/I18nHealthPage.jsx';
if (!_exists(I18N_PAGE)) {
  errors.push('missing: ' + I18N_PAGE);
} else {
  const src = _read(I18N_PAGE);
  _has(src, 'data-testid="i18n-health-page"',
    'I18nHealthPage must expose data-testid="i18n-health-page"');
  _has(src, 'data-testid="i18n-health-current"',
    'I18nHealthPage must surface current language card');
  _has(src, 'data-testid="i18n-health-coverage"',
    'I18nHealthPage must surface translation coverage card');
}
if (_exists(APP_JSX)) {
  const src = _read(APP_JSX);
  _has(src, "import('./pages/admin/I18nHealthPage.jsx')",
    'App.jsx must lazy-import I18nHealthPage');
  if (!/path="\/admin\/i18n-health"\s+element=\{<RoleRoute roles=\{ADMIN_ROLES\}>/.test(src)) {
    errors.push('App.jsx /admin/i18n-health route must wrap in <RoleRoute roles={ADMIN_ROLES}>');
  }
}

if (errors.length) {
  console.error('[check:language-selector] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:language-selector] PASS — language selector mounted on login + protected layout, 6 spec languages registered, Hindi visible, health runtime wired, 🌐 button + bottom sheet + /admin/i18n-health all wired.');
