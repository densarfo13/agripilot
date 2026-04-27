/**
 * safeParse — never-throws JSON.parse wrapper.
 *
 *   safeParse(localStorage.getItem('farroway_settings'), {})
 *
 * Use this in place of bare `JSON.parse(...)` everywhere a corrupt
 * localStorage value would otherwise crash a render path. The
 * fallback is returned on any parse failure (SyntaxError, null
 * input, non-string input).
 *
 * Why a dedicated helper
 *   * The codebase has 80+ JSON.parse call sites. Centralising the
 *     try/catch keeps every reader honest without wrapping each
 *     call individually.
 *   * Farmer devices ship corrupt storage in the wild — interrupted
 *     writes, third-party storage cleaners, and old PWA shells from
 *     prior Farroway versions all leave half-written values that
 *     blow up bare JSON.parse on the next read.
 *
 * Strict-rule audit
 *   * never throws
 *   * accepts null / undefined / non-strings — returns fallback
 *   * does NOT remove the corrupt key (caller decides whether to
 *     repair or leave it for analytics; deleting on read can mask
 *     real bugs and clobber data the user could otherwise recover)
 */

export function safeParse(raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    // JSON.parse('null') returns null; treat that as "absent" so
    // callers that asked for an object/array fallback don't have
    // to null-check separately. Numbers, strings, booleans pass
    // through.
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

/**
 * safeReadJSON — convenience wrapper that reads a localStorage key
 * + parses in one call. Wraps the read itself in try/catch so a
 * locked-down browser (private mode quotas, deleted storage
 * partition) does not propagate the SecurityError to render.
 */
export function safeReadJSON(key, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  let raw = null;
  try { raw = localStorage.getItem(key); }
  catch { return fallback; }
  return safeParse(raw, fallback);
}

export default safeParse;
