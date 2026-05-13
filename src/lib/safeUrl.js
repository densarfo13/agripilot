/**
 * safeUrl.js — exception-free URL construction.
 *
 *   safeUrl('https://example.com/path?x=1')
 *     → URL object
 *   safeUrl(undefined)
 *     → null
 *   safeUrl('not a url', '/fallback')
 *     → URL object built from '/fallback' base (still invalid → null)
 *
 * Why this exists
 *   `new URL(value)` throws TypeError on undefined / null / empty
 *   string / malformed input. The browser then logs:
 *     "Failed to construct 'URL': Invalid URL"
 *   In production that line is indistinguishable from real app
 *   errors at a glance — even though the actual cause is a stray
 *   undefined slipping into something that builds a URL string.
 *
 *   This helper wraps every dangerous URL construction in a single
 *   try/catch, validates the input is a non-empty string, and
 *   returns either a parsed URL or a typed null/fallback. Callers
 *   never see exceptions, the console stays clean, and the dev
 *   build logs the bad input ONCE per unique value so the cause
 *   is traceable.
 *
 * Pure / SSR-safe / never throws.
 */

// Dev-only memo so a bad input doesn't flood the console on
// re-renders of the same broken component.
const _badInputsSeen = new Set();

function _logBadOnce(value) {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env || !import.meta.env.DEV) return;
    const key = String(value);
    if (_badInputsSeen.has(key)) return;
    _badInputsSeen.add(key);
     
    console.warn('[safeUrl] rejected invalid input:', value);
  } catch { /* never throw from a diagnostic */ }
}

/**
 * Build a URL object from a string, returning null on any failure.
 *
 *   safeUrl(value, base?) → URL | null
 *
 * The optional `base` argument is forwarded to the URL constructor
 * for relative-path inputs (e.g. `'/path'`). Pass an absolute URL
 * or `window.location.origin` to resolve relative inputs against.
 *
 * @param {unknown} value
 * @param {string|URL} [base]
 * @returns {URL|null}
 */
export function safeUrl(value, base) {
  try {
    if (typeof value !== 'string') {
      _logBadOnce(value);
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      _logBadOnce(value);
      return null;
    }
    // Spec quirk — `new URL('')` throws, `new URL('   ')` throws,
    // `new URL('not a url')` throws. We rely on the catch below
    // for those rather than re-implementing the WHATWG URL parser.
    return base ? new URL(trimmed, base) : new URL(trimmed);
  } catch {
    _logBadOnce(value);
    return null;
  }
}

/**
 * Build a URL object OR return the supplied fallback (which must
 * itself be a valid URL string or URL instance — also passed
 * through safeUrl so a bad fallback never throws).
 *
 *   safeUrlOr(value, '/login')   → URL of the input OR URL of '/login'
 *   safeUrlOr(undefined, null)   → null
 *
 * @param {unknown} value
 * @param {string|URL|null} fallback
 * @param {string|URL} [base]
 * @returns {URL|null}
 */
export function safeUrlOr(value, fallback, base) {
  const u = safeUrl(value, base);
  if (u) return u;
  if (!fallback) return null;
  if (fallback instanceof URL) return fallback;
  return safeUrl(fallback, base);
}

/**
 * Quick boolean — useful for guards. Never throws.
 *
 * @param {unknown} value
 * @param {string|URL} [base]
 * @returns {boolean}
 */
export function isValidUrl(value, base) {
  return safeUrl(value, base) !== null;
}

const _module = { safeUrl, safeUrlOr, isValidUrl };
export default _module;
