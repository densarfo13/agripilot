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

import { t as moduleT, getLanguage } from './index.js';
// Direct dictionary import so we can detect "no native value in
// this language" without relying on the production-mode marker
// from t() (which silently falls back to English by design).
// The mutations applied by mergePacks() in index.js happen at
// index.js module-load and persist on the same object reference,
// so reading T at call-time reflects the merged dictionary.
import T from './translations.js';

const _warnedKeys = new Set();

// Mirror of the production-mode humanizer in src/i18n/index.js.
// When `t(key)` can't find a translation in production it falls
// through to humanizeKey() and returns e.g. "Title" for
// "account.loadFailed.title" — a non-empty string that the
// previous `looksMissing` check accepted as a real translation,
// letting the leak slip past tSafe's fallback. We compute the
// same string here and treat a match as "this is the humanized
// fallback, not a real value" so the caller's explicit fallback
// kicks in instead.
function _humanizeKey(key) {
  if (!key) return '';
  const tail = String(key).split('.').pop() || key;
  const spaced = String(tail)
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

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
export function tSafe(arg1, arg2, arg3, arg4) {
  // ── Overload resolution ──────────────────────────────────
  // Bound form:  tSafe(t, key, fallback, vars?)
  // Short form:  tSafe(key, fallback, vars?)
  // The optional vars object is forwarded to the underlying t()
  // for {placeholder} interpolation.
  let translator, key, fallback, vars;
  if (typeof arg1 === 'function') {
    translator = arg1;
    key        = arg2;
    fallback   = arg3 != null ? arg3 : '';
    vars       = arg4;
  } else {
    translator = moduleT;
    key        = arg1;
    fallback   = arg2 != null ? arg2 : '';
    vars       = arg3;
  }

  if (!key) return fallback || '';
  if (typeof translator !== 'function') return fallback || key;

  // Active language, used by both branches for the strict-no-leak
  // dictionary check below.
  let lang = 'en';
  try { lang = getLanguage() || 'en'; } catch { /* keep en */ }

  // STRICT NO-LEAK CHECK
  // ────────────────────
  // For non-English UI we look up the entry directly in T and
  // verify a native value exists for the active language. The
  // existing t() helper silently falls back to entry.en in
  // production (no marker), which is exactly the leak we're
  // closing. Reading T directly is the only reliable detector.
  // Skipped for English UI (entry.en or humanized key is fine).
  if (lang !== 'en') {
    try {
      const entry = T && T[key];
      const nativeValue = entry && entry[lang];
      if (!nativeValue) {
        // STABILITY HOTFIX: previously returned `[MISSING:key|lang]`
        // in dev to surface gaps visually. The visible markers were
        // suspected of crashing components that pass tSafe output
        // into APIs expecting clean strings (intl, dom-attr lengths,
        // hash maps). Switch to a pure-fallback return + a single
        // console.warn per (key,lang). Always returns a string —
        // never undefined, null, or an object.
        if (_isDev()) {
          if (!_warnedKeys.has('strict:' + key + ':' + lang)) {
            _warnedKeys.add('strict:' + key + ':' + lang);
            try { console.warn(`[i18n missing]`, key, '(lang=' + lang + ')'); }
            catch { /* ignore */ }
          }
        }
        const safeFallback = typeof fallback === 'string' ? fallback : '';
        return safeFallback;
      }
    } catch { /* fall through to translator path */ }
  }

  let value = '';
  try {
    if (typeof arg1 === 'function') {
      value = vars != null ? translator(key, vars) : translator(key);
    } else {
      // Short form — moduleT signature is `t(key, lang, vars)`.
      value = translator(key, lang, vars);
    }
  } catch {
    return fallback || key;
  }

  // Humanized-key fallback detection: production t() returns
  // humanizeKey(key) (e.g. "Title" for "account.loadFailed.title")
  // when the dictionary is empty for that key. Without this check
  // tSafe would accept the humanized string as a real translation
  // and never substitute the caller's explicit fallback.
  //
  // BUG FIX (F2 from interactive smoke test): the previous version
  // unconditionally rejected any value matching humanizeKey(key),
  // which falsely flagged REAL translations whose value happened to
  // equal the humanized last segment — `auth.email` → "Email",
  // `auth.password` → "Password", `auth.phone` → "Phone", etc. all
  // got wiped to the caller's empty fallback string, producing the
  // visible "blank label" Login bug.
  //
  // The collision is a real fallback ONLY when the dict entry is
  // genuinely absent for the active language (and lacks the `en`
  // safety net). Reading T directly here is the only reliable way
  // to tell "humanizeKey fallback" apart from "translation just
  // happens to look humanizable."
  let isHumanizeFallback = false;
  if (typeof value === 'string' && value === _humanizeKey(key)) {
    try {
      const entry = T && T[key];
      const nativeValue = entry && (entry[lang] || entry.en);
      isHumanizeFallback = !nativeValue;
    } catch { /* if read fails, assume the value is real */ }
  }
  const looksMissing =
    !value
    || (typeof value === 'string' && value.startsWith('[MISSING:'))
    || value === key
    || isHumanizeFallback;

  if (looksMissing) {
    if (_isDev()) {
      const memoKey = `dev:${key}`;
      if (!_warnedKeys.has(memoKey)) {
        _warnedKeys.add(memoKey);
        try {
          console.warn(`[i18n missing]`, key);
        } catch { /* ignore */ }
      }
      // STABILITY HOTFIX: previously returned `[MISSING:key]` in
      // dev to surface gaps visually. Switched to pure-fallback so
      // tSafe is non-destructive — always a clean string.
      const safeFallback = typeof fallback === 'string' ? fallback : '';
      return safeFallback;
    }
    return typeof fallback === 'string' ? fallback : '';
  }
  // STABILITY HOTFIX: coerce to string in case some upstream code
  // path returns a non-string. tSafe contract: always return string.
  return typeof value === 'string' ? value : String(value || '');
}

export default tSafe;

/**
 * UI({ k, fallback }) — tiny render helper requested by the strict
 * language cleanup spec. Renders a localized string in JSX without
 * the caller having to import + call `tSafe` separately:
 *
 *   <UI k="nav.home" fallback="Home" />
 *
 * Returns the resolved string (or fallback) as plain text. Identical
 * behaviour to the short-form `tSafe(k, fallback)` — pick whichever
 * fits the call site. Note: like the short form, this DOES NOT
 * subscribe to language change on its own — the surrounding
 * component should call `useTranslation()` so React re-renders
 * <UI/> on `farroway:langchange`.
 */
export function UI({ k, fallback = '' }) {
  return tSafe(k, fallback);
}
