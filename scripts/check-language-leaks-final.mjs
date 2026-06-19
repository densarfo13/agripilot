/**
 * check-language-leaks-final.mjs — sprint #212 §11 / §6.
 *
 * The screenshots showed English on Twi screens because farmer keys
 * were referenced by tSafe but NEVER registered in the canonical
 * column (so tSafe fell back to English in every locale, forever).
 * This gate fails the build if any of those keys regress out of
 * T-en.js, and verifies the runtime leak guard is still wired.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const errors = [];
const _read = (r) => { try { return fs.readFileSync(path.join(ROOT, r), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

const TEN = _read('src/i18n/columns/T-en.js');
// The previously-escaped farmer-facing keys MUST stay registered.
const REQUIRED = [
  'activity.empty.title', 'activity.empty.body', 'activity.empty.scan', 'activity.empty.add',
  'simple.tasks.title', 'simple.tasks.sub', 'simple.tasks.fallback.reason',
  'myFarm.status.title', 'myFarm.status.harvestWindow', 'myFarm.status.crop',
  'myFarm.status.stage', 'myFarm.status.health', 'myFarm.status.risk',
  'common.scanPlant', 'common.addPlant', 'common.remindMe',
];
for (const k of REQUIRED) {
  if (!TEN.includes('"' + k + '"')) {
    errors.push('escaped farmer key must stay registered in T-en.js: ' + k);
  }
}
// Runtime leak guard still wired.
_has(_read('src/App.jsx'), 'installLanguageLeakDetector',
  'App.jsx must boot-install __farrowayLanguageLeaks guard');
_has(_read('src/runtime/i18n/LanguageLeakDetector.ts'), '__farrowayLanguageLeaks',
  'LanguageLeakDetector must pin __farrowayLanguageLeaks');

if (errors.length) { console.error('[check:language-leaks-final] FAIL'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
console.log('[check:language-leaks-final] PASS — ' + REQUIRED.length
  + ' escaped farmer keys registered (translatable); runtime leak guard wired.');
