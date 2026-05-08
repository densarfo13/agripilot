/**
 * safeUrl.js — defensive URL constructor.
 *
 * Wraps `new URL(...)` so callers never crash on:
 *   • undefined / null / empty input
 *   • malformed strings
 *   • protocol-less paths (resolves against window.location.origin)
 *   • SSR contexts (no window)
 *
 *   import { safeUrl, isValidUrl } from '../utils/safeUrl.js';
 *
 *   safeUrl('/api/weather')                     → URL with origin/api/weather
 *   safeUrl(import.meta.env.VITE_API_URL, '/')  → falls back to '/' if unset
 *   safeUrl(undefined)                          → null
 *   safeUrl('javascript:alert(1)')              → null (rejected protocol)
 *
 * Strict-rule audit
 *   • Pure module — no React, no hooks, no I/O.
 *   • Never throws — every URL construction wrapped.
 *   • Dev-only one-shot warning so noise stays out of prod.
 *   • SSR-safe — window/document access guarded.
 */

// ─── Internal state ───────────────────────────────────────────────

const _seenWarnings = new Set();

function _isDev() {
  try { return !!(import.meta && import.meta.env && import.meta.env.DEV); }
  catch { return false; }
}

function _warnOnce(key, msg, original) {
  try {
    if (!_isDev()) return;
    if (_seenWarnings.has(key)) return;
    _seenWarnings.add(key);
    // eslint-disable-next-line no-console
    console.warn(`[Farroway safeUrl] ${msg}`, original);
  } catch { /* never throw from a diagnostic */ }
}

function _safeOrigin() {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
  } catch { /* swallow */ }
  return 'http://localhost';
}

// Disallow protocols that should never round-trip through the URL
// constructor (xss vectors / non-navigable schemes).
const _BLOCKED_PROTOCOLS = new Set([
  'javascript:', 'data:', 'file:', 'vbscript:', 'about:',
]);

// ─── Public API ───────────────────────────────────────────────────

/**
 * isValidUrl(input) — boolean test without throwing.
 * Returns true when `safeUrl(input)` would succeed.
 */
export function isValidUrl(input) {
  return safeUrl(input) !== null;
}

/**
 * safeUrl(input, fallback) → URL | null
 *
 * Returns a URL instance for `input` (resolving relative paths
 * against window.location.origin) or `fallback` when `input`
 * is missing/invalid. When `fallback` is itself missing/invalid
 * the result is `null` — callers should guard with `?.href`.
 *
 * @param {string|URL|null|undefined} input
 * @param {string|URL|null} [fallback]
 * @returns {URL | null}
 */
export function safeUrl(input, fallback) {
  // Already a URL instance — short-circuit.
  if (input instanceof URL) return input;

  const trimmed = (typeof input === 'string') ? input.trim() : '';
  if (trimmed) {
    // Reject blocked protocols early so we never build them.
    const lower = trimmed.toLowerCase();
    let blocked = false;
    for (const p of _BLOCKED_PROTOCOLS) {
      if (lower.startsWith(p)) { blocked = true; break; }
    }
    if (blocked) {
      _warnOnce('blocked:' + lower.slice(0, 16), 'rejected blocked protocol', trimmed);
    } else {
      // Try absolute first, then relative against the current origin.
      try { return new URL(trimmed); }
      catch { /* fall through */ }
      try { return new URL(trimmed, _safeOrigin()); }
      catch (err) {
        _warnOnce('parse:' + trimmed.slice(0, 32), 'invalid URL input', trimmed);
      }
    }
  }

  // Try fallback.
  if (fallback != null) {
    if (fallback instanceof URL) return fallback;
    if (typeof fallback === 'string' && fallback.trim()) {
      try { return new URL(fallback.trim()); }
      catch { /* fall through */ }
      try { return new URL(fallback.trim(), _safeOrigin()); }
      catch { /* swallow */ }
    }
  }

  return null;
}

/**
 * safeUrlString(input, fallback) → string
 *
 * Same as safeUrl() but returns the .href string (or '') so callers
 * can drop directly into `<a href>` / `<img src>` without optional
 * chaining. Empty string is the universal "no link" sentinel.
 */
export function safeUrlString(input, fallback) {
  const u = safeUrl(input, fallback);
  return u ? u.href : '';
}

/**
 * joinUrl(base, path) → string
 *
 * Builds a URL from `base + path` safely — handles trailing-slash
 * collisions, missing base, absolute path overrides, and SSR.
 * Returns the resolved href or '' when nothing resolves.
 */
export function joinUrl(base, path) {
  const safeBase = (typeof base === 'string' && base.trim())
    ? base.trim() : _safeOrigin();
  const safePath = (typeof path === 'string') ? path.trim() : '';

  // Absolute path on its own — resolve directly.
  if (!safePath) return safeUrlString(safeBase);
  if (/^https?:\/\//i.test(safePath)) return safeUrlString(safePath);

  try {
    const u = new URL(safePath.replace(/^\/+/, '/'), safeBase.endsWith('/') ? safeBase : safeBase + '/');
    return u.href;
  } catch {
    return safeUrlString(safeBase);
  }
}

// ─── Test surface ─────────────────────────────────────────────────
export const _internal = Object.freeze({
  _BLOCKED_PROTOCOLS,
  _safeOrigin,
  _warnOnce,
});
