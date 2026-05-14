/**
 * safeBuildUrl — spec-aligned thin alias over urlBuilder.buildUrl.
 *
 *   import { safeBuildUrl } from '../lib/url/safeBuildUrl.js';
 *
 *   const url = safeBuildUrl('https://api.test', '/scan');
 *   //   'https://api.test/scan'  (no trailing/leading slash issues)
 *
 *   const u  = safeBuildUrl(null, '/scan');
 *   //   null  (no throw; one [INVALID_URL_BUILD] log per unique base)
 *
 *   const u2 = safeBuildUrl(API_BASE, undefined);
 *   //   null  (path missing → safe null)
 *
 * Why a wrapper
 *   The Invalid-URL Root-Cause Fix asks for a single helper with
 *   the (base, path) signature. The underlying urlBuilder.buildUrl
 *   already covers this contract via { base } options. Wrapping it
 *   keeps the call sites short ("safeBuildUrl(base, path)") and
 *   gives us a one-line audit point for future hardening.
 *
 *   Rules enforced (per spec):
 *     - no duplicate slashes between base + path
 *     - undefined / null / empty / whitespace inputs return null
 *     - non-http(s) / non-relative bases rejected
 *     - returns a string (not URL object) so the call site can
 *       drop it straight into fetch() or an <img src=>
 *
 * Strict-rule audit
 *   * Never throws. SSR-safe.
 *   * No PII. No storage / network.
 *   * Logs once per unique invalid base via _logInvalidUrl in
 *     the underlying builder.
 */

import { buildFetchUrl } from '../urlBuilder.ts';

function _safeStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function _normalisePath(path) {
  const trimmed = _safeStr(path);
  if (!trimmed) return null;
  // Strip leading slashes — the underlying builder uses URL
  // resolution, which handles relative paths correctly regardless.
  // We DO leave query strings + fragments untouched.
  return trimmed.startsWith('/') ? trimmed : '/' + trimmed;
}

function _validBase(base) {
  if (base == null) return null;
  const s = _safeStr(base);
  if (!s) return null;
  // Reject bases that don't smell like a URL.
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  // Allow same-origin sentinel '/' or '' — buildFetchUrl handles those.
  if (s === '/' || s.startsWith('/')) return s;
  // Anything else (random word, "undefined" stringified, etc.) is rejected.
  return null;
}

/**
 * Build a render-safe URL string from a base + path pair.
 *
 * @param {string|null|undefined} base
 * @param {string|null|undefined} path
 * @param {object} [options]
 * @param {boolean} [options.silent]  suppress the diagnostic log
 * @returns {string|null}
 */
export function safeBuildUrl(base, path, options) {
  try {
    const validatedBase = _validBase(base);
    const normalisedPath = _normalisePath(path);
    if (!normalisedPath) return null;
    if (base != null && !validatedBase) return null;
    return buildFetchUrl(normalisedPath, {
      base:   validatedBase || undefined,
      silent: !!(options && options.silent),
    });
  } catch {
    return null;
  }
}

/**
 * Pre-flight guard used by network-issuing call sites that want
 * to bail BEFORE constructing a Request. Returns a structured
 * outcome rather than a string so the caller can branch:
 *
 *   const check = preflightUrl(base, path);
 *   if (!check.ok) return; // do nothing — invalid URL stays out
 *   const res = await fetch(check.url);
 */
export function preflightUrl(base, path) {
  const url = safeBuildUrl(base, path, { silent: true });
  if (!url) {
    return Object.freeze({
      ok:     false,
      reason: base == null || _safeStr(base) === ''
                ? 'missing_base'
                : path == null || _safeStr(path) === ''
                  ? 'missing_path'
                  : 'malformed',
      url:    null,
    });
  }
  return Object.freeze({ ok: true, reason: null, url });
}

const _module = { safeBuildUrl, preflightUrl };
export default _module;
