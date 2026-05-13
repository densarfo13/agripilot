/**
 * sentry — thin wrapper around @sentry/react.
 *
 *   import { initSentry, captureException } from 'src/lib/sentry.js';
 *
 *   // In main.jsx, before React mounts:
 *   initSentry();
 *
 *   // In any catch handler:
 *   captureException(err, { tag: 'feature.x', extra: { ... } });
 *
 * Behaviour
 *   • If `import.meta.env.VITE_SENTRY_DSN` is not set, every
 *     export becomes a no-op. The console echoes a single
 *     "Sentry: disabled (no DSN)" line in dev. The `Missing
 *     SENTRY_DSN — Sentry disabled safely` server banner
 *     pairs with the same condition on the backend.
 *   • If it IS set, Sentry initialises on first import and
 *     `captureException` flushes through the SDK.
 *   • The init runs ONCE per page lifecycle (idempotent).
 *   • All visible errors stay on screen — Sentry only observes;
 *     it never swallows.
 *
 * Environment
 *   Vite only exposes env vars prefixed with `VITE_` to the
 *   client bundle, so the canonical client key is
 *   `VITE_SENTRY_DSN`. The server reads `SENTRY_DSN` directly
 *   from process.env. Both names are listed as aliases in
 *   `server/src/config/productionRuntime.js` so the startup
 *   banner reflects the active state of either.
 *
 * Strict-rule audit
 *   • Pure module init. Never throws.
 *   • Lazy SDK use — when DSN is unset, @sentry/react is still
 *     imported (tree-shaken aggressively by rollup) but never
 *     calls .init().
 *   • No PII. We deliberately do NOT attach the user object;
 *     errors carry their stack + the manual context the
 *     caller passes. If you need user-tagging later, add it
 *     here in one place rather than scattering setUser calls.
 */

import * as Sentry from '@sentry/react';

let _initialized = false;
let _dsnPresent  = false;

function _readDsn() {
  try {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    const v = env.VITE_SENTRY_DSN || env.SENTRY_DSN || '';
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : '';
  } catch { return ''; }
}

function _readEnvironment() {
  try {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    if (env.MODE === 'production') return 'production';
    if (env.DEV) return 'development';
    return env.MODE || 'production';
  } catch { return 'production'; }
}

function _readRelease() {
  try {
    if (typeof window !== 'undefined' && window.__FARROWAY_BUILD_VERSION) {
      return String(window.__FARROWAY_BUILD_VERSION);
    }
  } catch { /* swallow */ }
  return undefined;
}

// Dev-gate read — Sentry stays OFF in `vite dev` unless the
// engineer explicitly opts in via VITE_SENTRY_ENABLE_DEV=1. This
// prevents personal browsers from spamming the prod project
// during local hacking.
function _devOptInActive() {
  try {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    const v = env.VITE_SENTRY_ENABLE_DEV;
    if (v === '1' || v === 'true' || v === true) return true;
  } catch { /* swallow */ }
  return false;
}

function _isDev() {
  try {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    return !!env.DEV;
  } catch { return false; }
}

// Auth / image / token redaction. Defence-in-depth pass over
// breadcrumbs + request URLs before the event leaves the browser.
const REDACT_QUERY_KEYS = new Set([
  'token', 'access_token', 'auth', 'authorization',
  'jwt', 'session', 'apikey', 'api_key', 'key', 'password',
]);
function _redactUrl(url) {
  try {
    if (typeof url !== 'string' || url.length === 0) return url;
    // Strip data: URIs (image dataURLs / scan photos) entirely.
    if (url.startsWith('data:')) return '[redacted:data-url]';
    // Strip blob: URIs (camera ObjectURLs).
    if (url.startsWith('blob:')) return '[redacted:blob-url]';
    // Strip query params that look like secrets.
    const q = url.indexOf('?');
    if (q < 0) return url;
    const head = url.slice(0, q);
    const tail = url.slice(q + 1);
    const parts = tail.split('&').map((p) => {
      const eq = p.indexOf('=');
      if (eq < 0) return p;
      const k = p.slice(0, eq).toLowerCase();
      if (REDACT_QUERY_KEYS.has(k)) return p.slice(0, eq) + '=[redacted]';
      return p;
    });
    return head + '?' + parts.join('&');
  } catch { return url; }
}

function _scrubBreadcrumb(bc) {
  try {
    if (!bc) return bc;
    // Redact URLs in fetch / xhr / navigation breadcrumbs.
    if (bc.data && typeof bc.data === 'object') {
      if (typeof bc.data.url === 'string') bc.data.url = _redactUrl(bc.data.url);
      if (typeof bc.data.from === 'string') bc.data.from = _redactUrl(bc.data.from);
      if (typeof bc.data.to === 'string')   bc.data.to   = _redactUrl(bc.data.to);
      // Drop request bodies entirely — never useful, often sensitive.
      if (bc.data.body)         delete bc.data.body;
      if (bc.data.request_body) delete bc.data.request_body;
      if (bc.data.response_body) delete bc.data.response_body;
    }
    // Drop console-log breadcrumbs that contain auth tokens.
    if (bc.category === 'console' && typeof bc.message === 'string') {
      if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(bc.message)) {
        bc.message = '[redacted:jwt-in-console]';
      }
    }
  } catch { /* swallow */ }
  return bc;
}

/**
 * Initialise Sentry. Safe to call multiple times — only the first
 * call does work. Returns true when Sentry is active, false when
 * disabled (no DSN, dev mode without opt-in, or init failure).
 */
export function initSentry() {
  if (_initialized) return _dsnPresent;
  _initialized = true;

  // Dev-gate: skip init in `vite dev` unless explicitly opted in.
  // The DSN is still read so the gate-state log is accurate.
  const inDev = _isDev();
  const devOptIn = _devOptInActive();
  if (inDev && !devOptIn) {
    _dsnPresent = false;
    try {
       
      console.log('[Sentry] disabled in dev (set VITE_SENTRY_ENABLE_DEV=1 to opt in).');
    } catch { /* swallow */ }
    return false;
  }

  const dsn = _readDsn();
  if (!dsn) {
    _dsnPresent = false;
    try {
      if (inDev) {
         
        console.log('[Sentry] disabled (no VITE_SENTRY_DSN set).');
      }
    } catch { /* swallow */ }
    return false;
  }

  try {
    // Build the integration list:
    //   1. browserTracingIntegration — route + fetch tracing.
    //      Sentry v9+ ships this as the canonical entry; for
    //      React Router v6/v7 (BrowserRouter style) the default
    //      integration auto-instruments history changes via the
    //      global popstate listener, no router instrumentation
    //      injection required.
    //   2. replayIntegration — DISABLED BY DEFAULT (replay = 0
    //      both sample rates). Only enabled when the engineer
    //      explicitly opts in via VITE_SENTRY_REPLAY=1, with
    //      privacy-first masking. Spec: "Disable noisy session
    //      replay by default."
    const integrations = [];
    try {
      if (typeof Sentry.browserTracingIntegration === 'function') {
        integrations.push(Sentry.browserTracingIntegration());
      }
    } catch { /* tolerate older SDK */ }

    let _replayEnabled = false;
    try {
      const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
      const wantReplay = env.VITE_SENTRY_REPLAY === '1' || env.VITE_SENTRY_REPLAY === 'true';
      if (wantReplay && typeof Sentry.replayIntegration === 'function') {
        integrations.push(Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
          maskAllInputs: true,
          networkDetailAllowUrls: [],
        }));
        _replayEnabled = true;
      }
    } catch { _replayEnabled = false; }

    Sentry.init({
      dsn,
      environment: _readEnvironment(),
      release:     _readRelease(),
      // Sample rates — keep noise low while we ramp.
      tracesSampleRate:         0.1,
      // Replay defaults to OFF (spec). Opt-in raises to 100%
      // for error sessions only — non-error sessions stay at 0.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: _replayEnabled ? 1.0 : 0,
      integrations,
      // Strip user PII from outbound events.
      sendDefaultPii: false,
      ignoreErrors: [
        // Browser-extension noise.
        /chrome-extension:\/\//i,
        /moz-extension:\/\//i,
        // ResizeObserver loop notifications are benign + noisy.
        /ResizeObserver loop /i,
        // Network aborts on slow mobile — not bugs.
        /AbortError/i,
        /Network request failed/i,
      ],
      // Privacy-safe outbound event filter (spec).
      beforeSend(event) {
        try {
          // 1. Drop request body + cookies + sensitive headers.
          if (event.request) {
            if (event.request.cookies) delete event.request.cookies;
            if (event.request.data)    delete event.request.data;
            if (event.request.headers) {
              const headers = event.request.headers;
              if (headers.authorization) headers.authorization = '[redacted]';
              if (headers.Authorization) headers.Authorization = '[redacted]';
              if (headers.cookie)        headers.cookie        = '[redacted]';
              if (headers.Cookie)        headers.Cookie        = '[redacted]';
            }
            if (typeof event.request.url === 'string') {
              event.request.url = _redactUrl(event.request.url);
            }
            // Strip query string entirely — too risky for tokens.
            if (event.request.query_string) delete event.request.query_string;
          }
          // 2. Strip server_name (host) — noisy + identifying.
          if (event.server_name) delete event.server_name;
          // 3. Drop file:// / blob: / data: from exception frames
          //    (image dataURLs occasionally show up via toDataURL).
          if (event.exception && event.exception.values) {
            for (const v of event.exception.values) {
              if (v && v.value && typeof v.value === 'string') {
                v.value = v.value
                  .replace(/data:[^"']{20,}/g, '[redacted:data-url]')
                  .replace(/blob:[^"' ]+/g, '[redacted:blob-url]');
              }
            }
          }
        } catch { /* never block event flush */ }
        return event;
      },
      // Per-breadcrumb scrub — auth tokens, image URLs, request
      // bodies. Runs before the breadcrumb is added to the event.
      beforeBreadcrumb(bc) {
        return _scrubBreadcrumb(bc);
      },
    });
    _dsnPresent = true;
    try {
       
      console.log(`[Sentry] active — ${_readEnvironment()}${_replayEnabled ? ' + replay' : ''}`);
    } catch { /* swallow */ }
    return true;
  } catch {
    _dsnPresent = false;
    return false;
  }
}

/**
 * Capture an exception. No-op when Sentry hasn't been initialised
 * (DSN not set). Optional `context` adds a tag + arbitrary extra
 * fields without forcing every caller to import the SDK directly.
 *
 * @param {unknown} err
 * @param {{ tag?: string, extra?: object, fingerprint?: string[] }} [ctx]
 */
export function captureException(err, ctx = {}) {
  if (!_initialized || !_dsnPresent) return;
  try {
    Sentry.withScope((scope) => {
      try {
        if (ctx && typeof ctx.tag === 'string' && ctx.tag) {
          scope.setTag('feature', ctx.tag);
        }
        if (ctx && ctx.extra && typeof ctx.extra === 'object') {
          scope.setExtras(ctx.extra);
        }
        if (ctx && Array.isArray(ctx.fingerprint) && ctx.fingerprint.length) {
          scope.setFingerprint(ctx.fingerprint.map(String));
        }
      } catch { /* swallow scope errors */ }
      try { Sentry.captureException(err); }
      catch { /* swallow capture errors */ }
    });
  } catch { /* swallow */ }
}

/**
 * Tag the current Sentry session with non-PII identifiers.
 * Safe to call after auth resolves; safe to call again when the
 * profile changes. No-op when Sentry isn't initialised.
 *
 *   setSentryUser({ id: profile.id, role: profile.userType,
 *                   country: profile.country });
 *
 * Privacy contract — we ONLY accept these fields:
 *   • id      — opaque user identifier (UUID / numeric id). No
 *               email, no phone, no national-id.
 *   • role    — 'farmer' | 'gardener' | 'admin' | 'ngo' | 'buyer'
 *   • country — ISO country code (low-cardinality regional tag)
 *
 * Anything else passed in is silently dropped. If a future
 * caller wants more, add it here in one place rather than
 * scattering setUser calls.
 */
export function setSentryUser(input = {}) {
  if (!_initialized || !_dsnPresent) return;
  try {
    const safe = {};
    if (input && input.id != null) safe.id = String(input.id);
    if (input && typeof input.role === 'string' && input.role) {
      safe.role = String(input.role).toLowerCase();
    }
    if (input && typeof input.country === 'string' && input.country) {
      // Country code only (2-3 chars). Anything longer is treated
      // as untrusted free-text and dropped.
      const c = String(input.country).trim();
      if (c.length <= 4) safe.country = c.toUpperCase();
    }
    if (Object.keys(safe).length === 0) {
      try { Sentry.setUser(null); } catch { /* swallow */ }
      return;
    }
    try { Sentry.setUser(safe); } catch { /* swallow */ }
  } catch { /* swallow */ }
}

/**
 * Clear the user tag (e.g. on sign-out). No-op when Sentry
 * isn't initialised.
 */
export function clearSentryUser() {
  if (!_initialized || !_dsnPresent) return;
  try { Sentry.setUser(null); } catch { /* swallow */ }
}

/**
 * Convenience snapshot for diagnostic surfaces (DevTools, an
 * admin debug panel, etc.). Never reads the DSN itself.
 */
export function isSentryActive() {
  return _initialized && _dsnPresent;
}

export default {
  initSentry,
  captureException,
  setSentryUser,
  clearSentryUser,
  isSentryActive,
};
