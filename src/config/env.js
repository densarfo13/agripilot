/**
 * env.js — frontend environment-variable validator.
 *
 * Wraps `import.meta.env` with safe fallbacks so the UI never
 * crashes when a build-time variable is missing or malformed.
 *
 *   import { ENV } from '../config/env.js';
 *
 *   ENV.API_URL      → 'https://farroway.app/api' or '/api' fallback
 *   ENV.WS_URL       → 'wss://...' or '' (offline-safe sentinel)
 *   ENV.ASSET_URL    → CDN base or window.location.origin
 *   ENV.UPLOAD_URL   → upload endpoint or ENV.API_URL fallback
 *   ENV.MODE         → 'development' | 'production' | 'test'
 *   ENV.IS_DEV       → boolean
 *
 * Strict-rule audit
 *   • Pure module — read once at import time, frozen.
 *   • Never undefined in UI — every getter returns a string.
 *   • Never throws — every URL is validated via safeUrl.
 *   • SSR-safe — window guard inside _safeOrigin.
 */

import { safeUrl } from '../utils/safeUrl.js';

// ─── Helpers ──────────────────────────────────────────────────────

function _read(name) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const v = import.meta.env[name];
      return (typeof v === 'string' && v.trim()) ? v.trim() : '';
    }
  } catch { /* swallow */ }
  return '';
}

function _safeOrigin() {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
  } catch { /* swallow */ }
  return '';
}

/**
 * Resolve a candidate URL string against the safeUrl validator.
 * Returns the candidate's href when valid, or `fallback` when
 * the candidate is missing/invalid. The fallback is itself
 * validated to keep the contract symmetric.
 */
function _resolveUrl(candidate, fallback) {
  const a = safeUrl(candidate);
  if (a) return a.href.replace(/\/+$/, ''); // strip trailing slash
  const b = safeUrl(fallback);
  if (b) return b.href.replace(/\/+$/, '');
  // Last resort — return raw fallback string (or '') so callers
  // never receive null or undefined.
  return (typeof fallback === 'string') ? fallback : '';
}

// ─── Resolve ──────────────────────────────────────────────────────

// URL hardening spec §3 (May 2026) — VITE_API_BASE_URL is the
// canonical name used by api/, intelligence/, weather/ helpers
// across the codebase; VITE_API_URL is the older alias still
// referenced by main.jsx + a couple of legacy paths. We honour
// both, preferring the canonical name. VITE_WEATHER_API_URL +
// VITE_IMAGE_BASE_URL are added so callers can stop reading
// `import.meta.env` directly (which historically passed unsafe
// raw values into `new URL(...)`).
const _ENV_RAW = {
  apiUrl:        _read('VITE_API_BASE_URL') || _read('VITE_API_URL'),
  wsUrl:         _read('VITE_WS_URL'),
  assetUrl:      _read('VITE_IMAGE_BASE_URL') || _read('VITE_ASSET_URL'),
  uploadUrl:     _read('VITE_UPLOAD_URL'),
  weatherApiUrl: _read('VITE_WEATHER_API_URL'),
};

const _origin = _safeOrigin();

// API_URL — production default to the canonical Farroway origin;
// dev / preview default to the relative '/api' path so the Vite
// proxy or Express co-deploy works without any env config.
const _apiFallback = (typeof import.meta !== 'undefined'
  && import.meta.env && import.meta.env.PROD)
  ? 'https://farroway.app/api'
  : (_origin ? _origin + '/api' : '/api');

const _resolved = Object.freeze({
  API_URL:    _resolveUrl(_ENV_RAW.apiUrl,    _apiFallback),
  // WS endpoints commonly omit a fallback origin — empty string is
  // the canonical "feature off" sentinel rather than a fake URL.
  WS_URL:     (() => {
    const u = safeUrl(_ENV_RAW.wsUrl);
    if (u && (u.protocol === 'ws:' || u.protocol === 'wss:' || u.protocol === 'http:' || u.protocol === 'https:')) {
      // Allow http(s) via safeUrl validation; rewrite to ws(s) at the
      // call site if the consumer prefers an explicit websocket scheme.
      return u.href.replace(/\/+$/, '');
    }
    return '';
  })(),
  ASSET_URL:  _resolveUrl(_ENV_RAW.assetUrl,  _origin || '/'),
  UPLOAD_URL: _resolveUrl(_ENV_RAW.uploadUrl, _resolveUrl(_ENV_RAW.apiUrl, _apiFallback) + '/upload'),
  // Weather API base — empty string sentinel means "use the
  // same-origin /api/weather proxy"; useLiveWeather already
  // handles the empty case without reading import.meta.env.
  WEATHER_URL: (() => {
    const u = safeUrl(_ENV_RAW.weatherApiUrl);
    return (u && (u.protocol === 'http:' || u.protocol === 'https:'))
      ? u.href.replace(/\/+$/, '')
      : '';
  })(),
  MODE:       (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE)
                ? String(import.meta.env.MODE) : 'development',
  IS_DEV:     !!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV),
  IS_PROD:    !!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD),
});

export const ENV = _resolved;

// ─── Diagnostic ───────────────────────────────────────────────────

/**
 * dumpEnv() — DEV-only one-time log of resolved values.
 *
 * Never logs secrets — these four URLs are public configuration
 * that already ships in the JS bundle. Suppressed in production
 * per the production-cleanup spec §11.
 */
export function dumpEnv() {
  try {
    if (!ENV.IS_DEV) return;
    // eslint-disable-next-line no-console
    console.log('[Farroway env]', {
      API_URL:     ENV.API_URL,
      WS_URL:      ENV.WS_URL     || '(disabled)',
      ASSET_URL:   ENV.ASSET_URL,
      UPLOAD_URL:  ENV.UPLOAD_URL,
      WEATHER_URL: ENV.WEATHER_URL || '(same-origin proxy)',
      MODE:        ENV.MODE,
    });
  } catch { /* never throw from a diagnostic */ }
}

export default ENV;
