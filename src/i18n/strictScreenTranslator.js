/**
 * strictScreenTranslator.js — spec-named alias for the existing
 * `strictTranslator.js` screen-completeness gate.
 *
 * The codebase ships with `useScreenTranslator(screenId, keys)`
 * already (see `src/i18n/strictTranslator.js`). The onboarding
 * + language-mismatch spec asks for a `getScreenText(screenName,
 * language)` API at this exact path \u2014 this module exposes that
 * API and re-exports the existing hook so callers can pick the
 * one that fits their context (hook in React, plain function in
 * tests / non-React modules).
 *
 * Spec rule (one screen = one language):
 *   \u2022 If EVERY required key resolves in the active language,
 *     return that language for the whole screen.
 *   \u2022 If ANY required key is missing (empty / null / equal to
 *     the key itself / [MISSING:\u2026]) the ENTIRE screen falls
 *     back to English so the user never sees a half-translated UI.
 *   \u2022 Missing keys are logged once per (screen, language) in
 *     development; production stays silent.
 *
 *   import { getScreenText, useScreenTranslator }
 *     from '../i18n/strictScreenTranslator.js';
 *
 *   const text = getScreenText('onb-entry', 'fr', {
 *     'onboarding.whatAreYouGrowing': null,
 *     'onboarding.backyardGarden':    null,
 *     'onboarding.farm':              null,
 *   });
 *   // text -> { lang: 'fr'|'en', ok: true|false, missing: [...],
 *   //          values: { ... resolved strings ... } }
 *
 * Strict-rule audit
 *   \u2022 Pure module. No I/O. Never throws.
 *   \u2022 Re-exports the canonical hook so existing callers are
 *     unaffected.
 *   \u2022 Single source of truth: `validateScreen` from
 *     `strictTranslator.js`. This file adds the spec's
 *     `getScreenText` shape on top.
 */

import { t as baseT } from './index.js';
import {
  validateScreen,
  useScreenTranslator,
} from './strictTranslator.js';

/**
 * getScreenText(screenName, language, keys) \u2192 {
 *   lang:    string,           // language actually used (fallback may flip to 'en')
 *   ok:      boolean,          // true when every key resolved in the requested language
 *   missing: string[],         // keys that were missing in `language`
 *   values:  Record<string,string>,  // key \u2192 resolved string in lang
 * }
 *
 * @param {string} screenName \u2014 short identifier ('onb-entry',
 *                              'setup-garden', \u2026). Used for the
 *                              dev-only warn channel.
 * @param {string} language   \u2014 active language code ('en', 'fr',
 *                              'sw', 'ha', 'hi', 'tw').
 * @param {string[]|object} keys \u2014 required keys for the screen.
 *                              Pass an array of strings OR an
 *                              object whose keys are the i18n keys
 *                              (the values are ignored \u2014 caller
 *                              syntax sugar).
 *
 * Behaviour:
 *   \u2022 If `language === 'en'`, returns English directly (English
 *     is the source language; nothing to validate).
 *   \u2022 Otherwise validates every key in `language`. If any key
 *     is missing, the whole `values` map is rendered in English
 *     and `lang` is flipped to 'en' so the caller can render
 *     a one-language screen.
 *   \u2022 Always returns the same shape; never throws.
 */
export function getScreenText(screenName, language, keys) {
  const safeLang = String(language || 'en').toLowerCase();
  const keyList = (() => {
    if (Array.isArray(keys)) return keys.filter((k) => typeof k === 'string' && k);
    if (keys && typeof keys === 'object') return Object.keys(keys);
    return [];
  })();

  const validation = validateScreen(screenName, keyList, safeLang);
  const renderLang = validation.ok ? safeLang : 'en';

  const values = {};
  for (const key of keyList) {
    let v = '';
    try { v = baseT(key, renderLang); } catch { v = ''; }
    values[key] = (typeof v === 'string') ? v : '';
  }

  return {
    lang:    renderLang,
    ok:      validation.ok,
    missing: validation.missing.slice(),
    values,
  };
}

// Re-export the hook so callers that prefer the React API can
// import from a single module. The hook is the SAME function
// instance as `strictTranslator.useScreenTranslator` so any
// existing dev-warn dedupe state is shared.
export { useScreenTranslator };

export default getScreenText;
