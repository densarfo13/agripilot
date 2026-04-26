/**
 * tSafe.js — explicit-fallback wrapper around the central t() helper.
 *
 * The shipped `t()` in src/i18n/index.js already:
 *   • returns `[MISSING:key]` in dev / strict mode
 *   • falls back to humanizeKey() in production
 *   • wraps the body in try/catch so it NEVER throws
 *
 * What `tSafe` adds on top:
 *   • Caller passes an explicit fallback string. When `t()` returns
 *     anything that looks like the dev `[MISSING:` marker, OR an
 *     empty string, OR a value that equals the key itself (a clear
 *     resolution failure), we substitute the caller's fallback.
 *   • The substitution is silent in production — the inner `t()`
 *     already warned once. Dev mode also returns the marker so QA
 *     screenshots show the gap.
 *
 * Two supported call shapes (overloaded — pick whichever fits the
 * call site, both behave identically except for re-render behaviour
 * — see "React reactivity" below):
 *
 *   1. Bound form (existing — preferred inside React components):
 *
 *        const { t } = useTranslation();
 *        tSafe(t, 'home.greeting', 'Welcome');
 *
 *      The component subscribes to `farroway:langchange` via
 *      `useTranslation()`'s internal `useState`, so a language
 *      switch re-renders the component and `tSafe` returns fresh
 *      text on the next pass.
 *
 *   2. Short form (new — for non-component or top-level utility code):
 *
 *        tSafe('home.greeting', 'Welcome');
 *
 *      Reads the active language via the module-level `t` exported
 *      from src/i18n/index.js. Useful in:
 *        • non-React utility modules (no hooks available)
 *        • one-shot string composition (toast strings, console
 *          messages, error.message values that are then surfaced
 *          by a component that DOES re-render)
 *
 *      ⚠ React reactivity: a component that uses ONLY the short
 *      form does NOT subscribe to language-change events. Mixing
 *      the short form into a render path means: when the user
 *      switches language, the surrounding component must also
 *      re-render via some other path (parent re-render, a
 *      `useTranslation()` call elsewhere in the same component,
 *      a key change, etc.) for the short-form text to update.
 *      For pure render usage, prefer the bound form.
 *
 * tSafe does NOT replace `t()` globally. Use it only at risky
 * visible spots where a missing key previously caused a visible
 * mismatch (e.g. raw key leaking, blank text). For everything else
 * the existing `t()` is already safe.
 */

import { t as moduleT } from './index.js';

const _warnedKeys = new Set();

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR */ }
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.NODE_ENV === 'development') return true;
      if (process.env.NODE_ENV === 'test')        return true;
      if (process.env.VITE_I18N_STRICT === '1')   return true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * tSafe — overloaded.
 *
 *   tSafe(t, key, fallback)   ← bound form (preferred in components)
 *   tSafe(key, fallback)      ← short form (uses module-level t)
 *
 * Detection: if the first arg is a function, treat it as the bound
 * translator; otherwise, treat the first arg as the key and route
 * through the module-level `t` import.
 */
export function tSafe(arg1, arg2, arg3) {
  // ── Overload resolution ──────────────────────────────────
  let translator, key, fallback;
  if (typeof arg1 === 'function') {
    // Bound form: tSafe(t, key, fallback)
    translator = arg1;
    key        = arg2;
    fallback   = arg3 != null ? arg3 : '';
  } else {
    // Short form: tSafe(key, fallback)
    translator = moduleT;
    key        = arg1;
    fallback   = arg2 != null ? arg2 : '';
  }

  if (!key) return fallback || '';
  if (typeof translator !== 'function') return fallback || key;

  let value = '';
  try {
    value = translator(key);
  } catch {
    // Inner t() already wraps in try/catch, but be defensive.
    return fallback || key;
  }

  const looksMissing =
    !value
    || (typeof value === 'string' && value.startsWith('[MISSING:'))
    || value === key;

  if (looksMissing) {
    if (_isDev()) {
      const memoKey = `dev:${key}`;
      if (!_warnedKeys.has(memoKey)) {
        _warnedKeys.add(memoKey);
        try {
          console.warn(`[tSafe] missing key "${key}" — using fallback="${fallback}"`);
        } catch { /* ignore */ }
      }
      // In dev, surface the gap visibly so QA spots untranslated
      // copy. Production stays silent + uses fallback.
      return `[MISSING:${key}]`;
    }
    return fallback || key;
  }
  return value;
}

export default tSafe;
