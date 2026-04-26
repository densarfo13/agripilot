/**
 * useStrictTranslation — drop-in alternative to `useTranslation()`
 * for farmer-facing pages where an English string leaking into a
 * non-English UI is a worse experience than an empty cell.
 *
 * Why this hook exists
 * ────────────────────
 * The shipped `useTranslation()` returns a `t()` that falls back to
 * English when a key is missing in the active language. That keeps
 * the UI populated, but the fallback shows English next to Hindi /
 * Twi / Hausa labels — a worse outcome on low-literacy farmer
 * surfaces than hiding the cell.
 *
 * `useStrictTranslation()` returns the SAME shape as the existing
 * hook (`{ t, lang, setLang, fmtDate, fmtNumber, ... }`), but the
 * `t` function is replaced with `tStrict(key, fallback, vars)` —
 * see `src/i18n/strictT.js` for the precise semantics. Every other
 * field on the return value is forwarded unchanged.
 *
 * Migration is one line per page:
 *
 *   - import { useTranslation } from '../i18n/index.js';
 *   + import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
 *
 * No other call site changes are needed. `t('some.key')` still works
 * the same way. The only behavioural difference: a missing key in
 * non-English UI returns `''` instead of the English fallback. In
 * English UI behaviour is unchanged.
 *
 * Reversibility
 * ─────────────
 * Switching back to lenient fallback is the reverse one-line change.
 * No data is mutated; the hook is a pure render-time transform.
 */

import { useCallback } from 'react';
import { useTranslation } from './index.js';
import { tStrict } from './strictT.js';

/**
 * @returns Same shape as `useTranslation()`, but `t(key, vars?)`
 *          uses strict no-English-leak semantics.
 */
export function useStrictTranslation() {
  const base = useTranslation();
  const { lang } = base;

  // Wrap so the call signature stays `t(key)` / `t(key, vars)` —
  // matches existing call sites that don't know about `fallback`.
  // Strict semantics: missing → '' (never English in non-en UI).
  const strictT = useCallback(
    (key, vars) => tStrict(key, '', vars),
    // tStrict reads the active language from `getLanguage()` on each
    // call, but we still depend on `lang` to re-render when language
    // flips (the parent useTranslation already subscribes to the
    // langchange event; this dep just keeps the bound callback fresh).
    [lang],
  );

  return {
    ...base,
    t: strictT,
  };
}

export default useStrictTranslation;
