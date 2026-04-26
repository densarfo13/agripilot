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
 *   tSafe(t, 'home.greeting', 'Welcome')
 *     → 'Welcome'  (when home.greeting is missing in current lang)
 *
 * tSafe does NOT replace `t()` globally. Use it only at risky
 * visible spots where a missing key previously caused a visible
 * mismatch (e.g. raw key leaking, blank text). For everything else
 * the existing `t()` is already safe.
 */

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
 * tSafe(t, key, fallback)
 *
 * @param {Function} t — the bound translator from useTranslation()
 *                       or the raw t from src/i18n/index.js
 * @param {string}   key — dot-notation translation key
 * @param {string}   fallback — value to substitute when the key is
 *                              missing or the result is the marker
 * @returns string — never empty, never throws
 */
export function tSafe(t, key, fallback = '') {
  if (!key) return fallback || '';
  if (typeof t !== 'function') return fallback || key;

  let value = '';
  try {
    value = t(key);
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
