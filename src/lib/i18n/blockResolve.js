/**
 * blockResolve.js — "whole block, one language" resolver for the
 * farmer mobile UX (spec §1 "Fix Language Consistency").
 *
 * Background:
 *   The standard `resolve(t, key, fallback)` pattern falls back to
 *   English *per key*. When a page has a dozen keys and a few are
 *   un-translated, the user sees Hindi and English mixed on the
 *   same screen. That's the bug.
 *
 * Fix:
 *   resolveBlock(t, keyMap, fallbackMap) → { values, translated }
 *
 * Behaviour:
 *   • If EVERY key in `keyMap` resolves to a real translation
 *     (not the raw key itself, not empty) → return the translated
 *     values.
 *   • If ANY required key is missing a translation → return the
 *     English fallbacks for the ENTIRE block, so the page renders
 *     in one consistent language.
 *   • `translated: true|false` tells the caller which mode won
 *     (useful for analytics + debugging).
 *
 *   resolveOne(t, key, fallback)  — pure per-key variant that
 *     still hides raw keys (returns '' when both translation AND
 *     fallback are missing, never the literal key).
 *
 * No React. No side effects. Callers pass their t() from the
 * existing i18n context.
 */

/**
 * resolveOne — safer per-key resolver. Unlike the older helper
 * used across the codebase, this one never returns the raw key
 * (so `auth.foo.bar` can't leak to the screen when both the
 * translation AND the fallback are missing).
 */
export function resolveOne(t, key, fallback = '') {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  if (!v) return fallback;
  if (String(v) === String(key)) return fallback; // i18n-missing signal
  return v;
}

/**
 * resolveBlock — atomic per-block resolution. Pass the keys you
 * need and their English fallbacks. Returns either all translated
 * OR all fallbacks — never a mix.
 *
 *   keyMap:      { title: 'home.title', cta: 'home.cta', … }
 *   fallbackMap: { title: 'Welcome',    cta: 'Open',    … }
 *
 *   required — array of keyMap keys that MUST be translated for
 *              the block to render in the locale. Defaults to all
 *              keys in keyMap. Useful when a block has optional
 *              strings (e.g. a "learn more" that's OK to fall back
 *              alone without dragging the whole card into English).
 *
 * Returns:
 *   { values, translated }
 *     values     — { title, cta, ... } — one consistent language
 *     translated — true when every `required` key had a real
 *                  translation; false when the block fell back
 */
export function resolveBlock(t, keyMap = {}, fallbackMap = {}, { required = null } = {}) {
  const keys = Object.keys(keyMap);
  const requiredList = Array.isArray(required) ? required : keys;
  const translatedValues = {};
  let allTranslated = typeof t === 'function';

  for (const k of keys) {
    if (typeof t !== 'function') {
      translatedValues[k] = fallbackMap[k] || '';
      continue;
    }
    const raw = t(keyMap[k]);
    const isMissing = !raw || String(raw) === String(keyMap[k]);
    if (isMissing) {
      if (requiredList.includes(k)) allTranslated = false;
      translatedValues[k] = fallbackMap[k] || '';
    } else {
      translatedValues[k] = raw;
    }
  }

  if (!allTranslated) {
    // Atomic fallback — whole block in English.
    const values = {};
    for (const k of keys) values[k] = fallbackMap[k] || '';
    return { values, translated: false };
  }
  return { values: translatedValues, translated: true };
}

export const _internal = Object.freeze({ resolveOne });
