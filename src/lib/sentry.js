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

/**
 * Initialise Sentry. Safe to call multiple times — only the first
 * call does work. Returns true when Sentry is active, false when
 * disabled (no DSN).
 */
export function initSentry() {
  if (_initialized) return _dsnPresent;
  _initialized = true;

  const dsn = _readDsn();
  if (!dsn) {
    _dsnPresent = false;
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[Sentry] disabled (no VITE_SENTRY_DSN set).');
      }
    } catch { /* swallow */ }
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: _readEnvironment(),
      release:     _readRelease(),
      // Sample rates — keep noise low while we ramp.
      // Bump only when the volume + signal both warrant it.
      tracesSampleRate:        0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
      // Strip user PII from outbound events. Sentry will still
      // collect stacks + breadcrumbs, just not request bodies
      // or full URLs that may carry tokens.
      sendDefaultPii: false,
      ignoreErrors: [
        // Browser-extension noise that's already filtered by
        // src/lib/consoleFilter.js — keep Sentry quiet on these.
        /chrome-extension:\/\//i,
        /moz-extension:\/\//i,
        // ResizeObserver loop notifications are benign and very
        // noisy in the wild.
        /ResizeObserver loop /i,
      ],
      beforeSend(event) {
        // Final last-mile redaction. Drop request body + cookies
        // if any made it into the event.
        try {
          if (event && event.request) {
            if (event.request.cookies) delete event.request.cookies;
            if (event.request.data)    delete event.request.data;
          }
        } catch { /* swallow */ }
        return event;
      },
    });
    _dsnPresent = true;
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[Sentry] active —', _readEnvironment());
      }
    } catch { /* swallow */ }
    return true;
  } catch {
    // Never let a misbehaving init crash the boot.
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
 * Convenience snapshot for diagnostic surfaces (DevTools, an
 * admin debug panel, etc.). Never reads the DSN itself.
 */
export function isSentryActive() {
  return _initialized && _dsnPresent;
}

export default { initSentry, captureException, isSentryActive };
