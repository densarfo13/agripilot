/**
 * urlBuilder.ts — single canonical URL construction entry point.
 *
 *   import { buildUrl, buildApiUrl, API_BASE_URL } from './urlBuilder';
 *
 *   buildUrl('/login')                          → URL | null
 *   buildUrl('/login', { base: 'https://x.com' })→ URL | null
 *   buildApiUrl('/api/v2/auth/me')              → URL | null
 *   buildApiUrl(undefined)                       → null (+ [INVALID_URL] log)
 *
 * Why this exists
 *   `new URL(undefined)` throws TypeError. `new URL('')` throws.
 *   `new URL('not a url')` throws. Components that build URLs from
 *   data (a profile field, a feature flag, an env var that wasn't
 *   set) can hand any of those three to the constructor and crash
 *   the page.
 *
 *   This module wraps every URL construction in the project's
 *   canonical safeUrl + safeApiBase machinery and returns either a
 *   parsed URL or null. Callers do `if (!url) return` instead of
 *   wrapping each call site in try/catch.
 *
 *   Per the Permanent URL Construction spec §1+§5, this is the
 *   single canonical entry point. New code MUST route through here;
 *   existing callers can migrate incrementally.
 *
 * Strict-rule audit
 *   • Pure / SSR-safe / never throws.
 *   • Logs `[INVALID_URL]` to console.error EXACTLY ONCE per unique
 *     bad input — re-renders never flood the console.
 *   • API_BASE_URL is the resolved base from safeApiBase, frozen at
 *     module load. Empty string === same-origin (documented pattern).
 */

import { safeUrl, safeUrlOr } from './safeUrl.js';
import { safeApiBase } from './safeApiBase.js';

// Memo for the [INVALID_URL] one-shot log. Same key behaviour as
// safeUrl's _badInputsSeen — bad inputs log once per unique value
// across the entire app lifetime.
const _invalidUrlSeen = new Set<string>();

function _logInvalidUrl(path: unknown): void {
  try {
    const key = String(path);
    if (_invalidUrlSeen.has(key)) return;
    _invalidUrlSeen.add(key);
    // Spec §3 — `console.error('[INVALID_URL]', path)`. We use
    // error (not warn) because attempting to construct a URL from
    // undefined / empty / malformed input is a programming bug,
    // not an expected runtime condition.
    // eslint-disable-next-line no-console
    console.error('[INVALID_URL]', path);
  } catch { /* never throw from a diagnostic */ }
}

/**
 * Canonical API base URL — resolved from VITE_API_BASE_URL /
 * VITE_API_URL with same-origin fallback. Frozen at module load.
 * Empty string === same-origin (documented Railway monolith pattern).
 */
export const API_BASE_URL: string = safeApiBase();

export interface BuildUrlOptions {
  /** Override the base. Default: API_BASE_URL. */
  base?: string | URL;
  /**
   * If true, skip the `[INVALID_URL]` console.error on rejection.
   * Use for paths that are EXPECTED to sometimes be missing (e.g.
   * optional profile fields) so the caller can fall back silently
   * without polluting the console.
   */
  silent?: boolean;
}

/**
 * Build a URL from a path. Returns null on any failure.
 *
 *   buildUrl('/login')                         → URL of API_BASE_URL/login
 *   buildUrl('/login', { base: 'https://x.com' }) → URL of https://x.com/login
 *   buildUrl(undefined)                         → null (+ [INVALID_URL] log)
 *   buildUrl('', { silent: true })              → null (no log)
 *
 * @param path     The path or full URL string.
 * @param options  Optional overrides — see BuildUrlOptions.
 * @returns        Parsed URL or null.
 */
export function buildUrl(path: unknown, options: BuildUrlOptions = {}): URL | null {
  // Spec §3 — runtime guard for undefined / null / empty.
  if (path === undefined || path === null) {
    if (!options.silent) _logInvalidUrl(path);
    return null;
  }
  if (typeof path !== 'string') {
    if (!options.silent) _logInvalidUrl(path);
    return null;
  }
  const trimmed = path.trim();
  if (!trimmed) {
    if (!options.silent) _logInvalidUrl(path);
    return null;
  }

  // Pick the base. Default = API_BASE_URL (same-origin string when
  // empty). The override path lets callers point at a different
  // origin (e.g. a third-party weather provider). When the base is
  // an empty string AND the path is relative, fall back to
  // window.location.origin if available — otherwise safeUrl
  // returns null with the standard log.
  const base = options.base !== undefined
    ? options.base
    : (API_BASE_URL || (typeof window !== 'undefined' && window.location && window.location.origin) || undefined);

  const url = safeUrl(trimmed, base as string | URL | undefined);
  if (!url && !options.silent) _logInvalidUrl(path);
  return url;
}

/**
 * Build a URL specifically against the API base. Equivalent to
 * `buildUrl(path)` since API_BASE_URL is the default base, but
 * the named alias makes the intent obvious at the call site.
 *
 *   buildApiUrl('/api/v2/auth/me')   → URL of API_BASE_URL + path
 *   buildApiUrl(undefined)            → null (+ [INVALID_URL] log)
 */
export function buildApiUrl(path: unknown, options: BuildUrlOptions = {}): URL | null {
  return buildUrl(path, options);
}

/**
 * Build a URL string (not URL object) suitable for direct fetch().
 * Returns null on failure so callers can `if (!url) return`.
 *
 *   const url = buildFetchUrl('/api/v2/auth/me');
 *   if (!url) return;
 *   const res = await fetch(url);
 */
export function buildFetchUrl(path: unknown, options: BuildUrlOptions = {}): string | null {
  const u = buildUrl(path, options);
  return u ? u.toString() : null;
}

/**
 * Boolean guard — returns true when the path resolves to a valid
 * URL. Use to gate effects that should not fire on missing inputs.
 *
 *   if (!isBuildable(maybePath)) return null;
 *   const url = buildUrl(maybePath);
 */
export function isBuildable(path: unknown, options: BuildUrlOptions = {}): boolean {
  // Always silent — this is a boolean guard, not a diagnostic.
  return buildUrl(path, { ...options, silent: true }) !== null;
}

/**
 * Build OR return a fallback. Both inputs flow through buildUrl so
 * a bad fallback is also caught.
 *
 *   buildUrlOr(maybeBroken, '/safe-default')
 */
export function buildUrlOr(
  path: unknown,
  fallback: string | URL | null,
  options: BuildUrlOptions = {},
): URL | null {
  const u = buildUrl(path, { ...options, silent: true });
  if (u) return u;
  if (!fallback) return null;
  return safeUrlOr(null, fallback, options.base as string | URL | undefined);
}

// Test helper — clears the [INVALID_URL] dedupe memo so unit tests
// can assert the log fires on each fresh input.
export function _resetInvalidUrlMemo(): void {
  _invalidUrlSeen.clear();
}

const _module = {
  API_BASE_URL,
  buildUrl,
  buildApiUrl,
  buildFetchUrl,
  isBuildable,
  buildUrlOr,
  _resetInvalidUrlMemo,
};
export default _module;
