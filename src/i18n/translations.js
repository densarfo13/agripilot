// __GENERATED_SHIM__ — see scripts/split-translations.mjs
/**
 * translations.js — column-sparse facade for the canonical T table.
 *
 * Historical note: this file used to be a 13.6k-line / 1.9 MB flat
 * object literal containing every key × every locale inline. That
 * monolith was the single biggest startup cost — every user
 * downloaded all six locale columns even though they read only one.
 *
 * The canonical translation data now lives one file per locale
 * under src/i18n/columns/T-{en,fr,sw,ha,tw,hi}.js. This file:
 *
 *   1. Eagerly imports the English column (T-en.js) so first paint
 *      always has translation coverage — no flash of untranslated
 *      content, no async dance for the default locale.
 *   2. Builds the same `{ key: { locale: value } }` shape that every
 *      consumer (t() in index.js, T[key][lang] reads in tSafe.js,
 *      mergeOverlays.js, the 35 *Translations.js overlays) expects.
 *      At boot, every row has exactly the `en` column populated.
 *   3. Default-exports the mutable T object. src/i18n/columnLoader.js
 *      lazy-loads additional columns and merges them into THIS object
 *      (same module instance), so other consumers see new translations
 *      appear in place once a `setLanguage()` triggers a fetch.
 *
 * Contract preserved:
 *   • T[key] is always either undefined or `{ en, fr?, sw?, ha?, tw?, hi? }`.
 *   • Translator-authored values in the canonical column files always
 *     win over overlay-supplied values (the loader OVERWRITES when it
 *     merges; mergeOverlays only fills empty slots).
 *   • The default export is a stable object reference — DO NOT
 *     reassign it. Mutate it in place.
 */

import enColumn from './columns/T-en.js';

const T = {};

// Seed the column-sparse T from the English column. The English
// column is the source of truth for "what keys exist" — every
// active translation key has an English value by construction.
for (const key of Object.keys(enColumn)) {
  const v = enColumn[key];
  if (typeof v !== 'string') continue;
  T[key] = { en: v };
}

export default T;
