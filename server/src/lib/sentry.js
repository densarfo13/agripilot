/**
 * sentry — server-side wrapper around @sentry/node.
 *
 *   import { initSentry, captureException } from './lib/sentry.js';
 *
 *   // In server.js main(), before any other setup:
 *   initSentry();
 *
 *   // In an Express error handler:
 *   captureException(err, { req, statusCode });
 *
 * Behaviour
 *   • If `process.env.SENTRY_DSN` (or `VITE_SENTRY_DSN`) is not
 *     set, every export becomes a no-op and the productionRuntime
 *     banner reports "Sentry disabled safely".
 *   • If it IS set, Sentry initialises on first import and
 *     captureException flushes through the SDK with request
 *     context attached when a `req` is provided.
 *   • The init runs ONCE per process lifetime (idempotent).
 *   • Server crashes are still logged via the existing
 *     opsEvent + JSON-line console.error path; Sentry runs in
 *     PARALLEL — it observes, never replaces.
 *
 * Strict-rule audit
 *   • Pure module init. Never throws.
 *   • PII redaction enabled (sendDefaultPii=false). Request
 *     bodies + cookies are stripped in beforeSend before the
 *     event leaves the process.
 *   • Imports are eagerly bundled but the SDK only does work
 *     when init() runs successfully.
 */

import * as Sentry from '@sentry/node';

let _initialized = false;
let _dsnPresent  = false;

function _readDsn() {
  try {
    const v = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || '';
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : '';
  } catch { return ''; }
}

function _readEnvironment() {
  try {
    return process.env.NODE_ENV || 'production';
  } catch { return 'production'; }
}

function _readRelease() {
  try {
    return process.env.RAILWAY_GIT_COMMIT_SHA
        || process.env.RENDER_GIT_COMMIT
        || process.env.SOURCE_COMMIT
        || process.env.FARROWAY_COMMIT_SHA
        || undefined;
  } catch { return undefined; }
}

/**
 * Initialise Sentry. Safe to call multiple times — only the
 * first call does work. Returns true when Sentry is active,
 * false when disabled (no DSN).
 */
export function initSentry() {
  if (_initialized) return _dsnPresent;
  _initialized = true;

  const dsn = _readDsn();
  if (!dsn) {
    _dsnPresent = false;
    // The production runtime banner already reports the
    // "disabled safely" state; no separate log here.
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment:      _readEnvironment(),
      release:          _readRelease(),
      tracesSampleRate: 0.1,
      sendDefaultPii:   false,
      // Suppress benign noise that doesn't help diagnose real
      // problems. Add to this list as the volume teaches us
      // which categories are pure churn.
      ignoreErrors: [
        // Aborted client requests — common on mobile, not a bug.
        /Request aborted/i,
        /ECONNRESET/i,
        /ECONNABORTED/i,
        // CORS blocks (Production CORS Noise Hardening) — strict
        // origin validation is preserved at the middleware layer;
        // rejections are EXPECTED, not bugs. The errorHandler
        // already short-circuits these before captureException
        // fires, but this pattern is the defense-in-depth net
        // for any future path that captures the error directly.
        /^CORS: origin .* not allowed$/i,
      ],
      beforeSend(event) {
        try {
          if (event && event.request) {
            // Strip request bodies + cookies before the event
            // leaves the process. Headers (minus Authorization)
            // remain useful for debugging.
            if (event.request.cookies) delete event.request.cookies;
            if (event.request.data)    delete event.request.data;
            if (event.request.headers && event.request.headers.authorization) {
              event.request.headers.authorization = '[redacted]';
            }
          }
        } catch { /* swallow — never block event flush */ }
        return event;
      },
    });
    _dsnPresent = true;
    return true;
  } catch {
    _dsnPresent = false;
    return false;
  }
}

/**
 * Capture an exception. No-op when Sentry hasn't been
 * initialised. Optional context attaches request metadata + a
 * statusCode tag without exposing PII.
 *
 * @param {unknown} err
 * @param {{
 *   req?: import('express').Request,
 *   statusCode?: number,
 *   tag?: string,
 *   extra?: object,
 * }} [ctx]
 */
export function captureException(err, ctx = {}) {
  if (!_initialized || !_dsnPresent) return;
  try {
    Sentry.withScope((scope) => {
      try {
        if (ctx && ctx.req) {
          const r = ctx.req;
          scope.setTag('http.method', String(r.method || '').toUpperCase());
          scope.setContext('request', {
            method:    r.method,
            path:      r.originalUrl || r.path,
            // Use sub claim (user id) only — never email/phone.
            userId:    (r.user && r.user.sub) || null,
            requestId: r.requestId || null,
          });
        }
        if (ctx && Number.isFinite(ctx.statusCode)) {
          scope.setTag('http.status', String(ctx.statusCode));
        }
        if (ctx && typeof ctx.tag === 'string' && ctx.tag) {
          scope.setTag('feature', ctx.tag);
        }
        if (ctx && ctx.extra && typeof ctx.extra === 'object') {
          scope.setExtras(ctx.extra);
        }
      } catch { /* swallow scope errors */ }
      try { Sentry.captureException(err); }
      catch { /* swallow capture errors */ }
    });
  } catch { /* swallow */ }
}

export function isSentryActive() {
  return _initialized && _dsnPresent;
}

export default { initSentry, captureException, isSentryActive };
