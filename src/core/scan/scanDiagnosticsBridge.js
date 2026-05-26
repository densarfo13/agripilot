/**
 * scanDiagnosticsBridge.js — bridges scan telemetry events into
 * Sentry breadcrumbs + Railway-friendly structured logs.
 *
 *   import { installScanDiagnosticsBridge }
 *     from 'src/core/scan/scanDiagnosticsBridge.js';
 *
 *   installScanDiagnosticsBridge();
 *
 * What it does
 * ────────────
 *   • Subscribes to the in-memory scan telemetry log (scanTelemetry.js)
 *     and adds each event as a Sentry breadcrumb so a crash report
 *     includes the last ~30 scan events leading up to the error.
 *   • Bridges the mobile-camera lifecycle heartbeat into the same
 *     breadcrumb stream so a "camera freeze → fatal error" sequence
 *     reads naturally in Sentry.
 *   • Emits a structured one-line console log per event that
 *     Railway's log ingestion can grep:
 *         [SCAN_TELEMETRY] event=AI_REQUEST_FAILED sessionId=… reason=…
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws.
 *   • Idempotent install.
 *   • Sentry bridge is best-effort — if @sentry/browser isn't
 *     loaded (DSN unset), we silently degrade to console + DOM
 *     events only. Field operators using `window.__scanTelemetry()`
 *     still see the full log.
 *   • No PII — payloads are pre-stripped by scanTelemetry's
 *     `_stripPayload`.
 */

import { SCAN_EVENTS } from './scanTelemetry.js';

const BREADCRUMB_CATEGORY = 'scan';
const HEARTBEAT_EVENT     = 'farroway:cameraHeartbeat';

let _installed = false;
let _telemetryUnsub = null;
let _heartbeatHandler = null;
let _lastSize = 0;

function _safe(fn) {
  try { return fn(); } catch { return undefined; }
}

function _getSentry() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    if (window.Sentry && typeof window.Sentry.addBreadcrumb === 'function') {
      return window.Sentry;
    }
    return null;
  }) || null;
}

function _logToConsole(row) {
  // Single greppable line per event. Railway log ingestion + our
  // boot diagnostic surface both grep for the [SCAN_TELEMETRY]
  // prefix.
  try {
    const parts = [
      'event=' + (row.event || 'unknown'),
      'sessionId=' + (row.sessionId || '-'),
      'monoMs=' + (row.monoMs != null ? Math.round(row.monoMs) : '-'),
    ];
    if (row.payload && typeof row.payload === 'object') {
      for (const k of Object.keys(row.payload)) {
        const v = row.payload[k];
        if (v == null) continue;
        const s = typeof v === 'string' ? v.slice(0, 80) : String(v);
        parts.push(k + '=' + s);
      }
    }
    // eslint-disable-next-line no-console
    console.log('[SCAN_TELEMETRY]', parts.join(' '));
  } catch { /* swallow */ }
}

function _eventToBreadcrumbLevel(event) {
  switch (event) {
    case SCAN_EVENTS.UPLOAD_FAILED:
    case SCAN_EVENTS.AI_REQUEST_FAILED:
      return 'error';
    case SCAN_EVENTS.SCAN_CANCELLED:
    case SCAN_EVENTS.SESSION_RECOVERED:
      return 'warning';
    default:
      return 'info';
  }
}

function _emitBreadcrumb(row) {
  const Sentry = _getSentry();
  if (!Sentry) return;
  _safe(() => {
    Sentry.addBreadcrumb({
      category: BREADCRUMB_CATEGORY,
      message:  row.event || 'unknown',
      level:    _eventToBreadcrumbLevel(row.event),
      data: {
        sessionId: row.sessionId || null,
        monoMs:    row.monoMs    || null,
        ...(row.payload && typeof row.payload === 'object' ? row.payload : {}),
      },
    });
  });
}

/**
 * Drain new entries from the telemetry log and emit each to
 * console + Sentry. Called on a short interval so events fired
 * via scanTelemetry's direct API (without an event listener) are
 * still captured.
 */
function _drainTelemetry() {
  _safe(() => {
    // Late import so this module doesn't pull scanTelemetry's
    // localStorage write path into surfaces that don't need it.
    return import('./scanTelemetry.js').then((m) => {
      if (!m || typeof m.getScanEventLog !== 'function') return;
      const log = m.getScanEventLog();
      if (!Array.isArray(log)) return;
      if (log.length <= _lastSize) {
        _lastSize = log.length;
        return;
      }
      const fresh = log.slice(_lastSize);
      _lastSize = log.length;
      for (const row of fresh) {
        _logToConsole(row);
        _emitBreadcrumb(row);
      }
    });
  });
}

function _onHeartbeat(ev) {
  _safe(() => {
    const detail = ev && ev.detail ? ev.detail : null;
    if (!detail) return;
    _logToConsole({
      event:     'CAMERA_LIFECYCLE_' + (detail.event || 'unknown').toUpperCase(),
      sessionId: null,
      monoMs:    null,
      payload:   { state: detail.state || null, ...(detail || {}) },
    });
    const Sentry = _getSentry();
    if (Sentry) {
      _safe(() => Sentry.addBreadcrumb({
        category: BREADCRUMB_CATEGORY,
        message:  'camera_lifecycle:' + (detail.event || 'unknown'),
        level:    detail.event === 'freeze_detected' || detail.event === 'tracks_ended_detected'
                  ? 'error' : 'info',
        data:     detail,
      }));
    }
  });
}

let _drainTimer = null;

/**
 * Install the bridge. Safe to call on every boot. Returns true on
 * a fresh install, false on idempotent re-install.
 */
export function installScanDiagnosticsBridge() {
  return _safe(() => {
    if (_installed) return false;
    // Telemetry drain — short interval, low overhead. The event
    // log is capped to 200 entries by scanTelemetry so the drain
    // never balloons.
    try { _drainTimer = setInterval(_drainTelemetry, 1000); } catch { _drainTimer = null; }
    // Camera lifecycle heartbeat — DOM event subscription.
    if (typeof window !== 'undefined') {
      _heartbeatHandler = _onHeartbeat;
      _safe(() => window.addEventListener(HEARTBEAT_EVENT, _heartbeatHandler));
    }
    // Atomic locale switch — same pattern.
    if (typeof window !== 'undefined') {
      _safe(() => window.addEventListener('farroway:atomicLocaleSwitch', _onAtomicSwitch));
    }
    _installed = true;
    return true;
  }) || false;
}

/** Pure utility — emit a breadcrumb for the atomic-locale-switch
 *  events so a "switch to Twi → English keys leak → user reports
 *  bug" can be reconstructed from Sentry alone. */
function _onAtomicSwitch(ev) {
  _safe(() => {
    const detail = ev && ev.detail ? ev.detail : null;
    if (!detail) return;
    _logToConsole({
      event:     'LOCALE_SWITCH_' + (detail.event || 'unknown').toUpperCase(),
      sessionId: null,
      monoMs:    null,
      payload:   { code: detail.code || null, source: detail.source || null,
                   timedOut: !!detail.timedOut },
    });
    const Sentry = _getSentry();
    if (Sentry) {
      _safe(() => Sentry.addBreadcrumb({
        category: 'i18n',
        message:  'locale_switch:' + (detail.event || 'unknown'),
        level:    detail.event === 'error' ? 'error' : 'info',
        data:     detail,
      }));
    }
  });
}

/** Tear down listeners + timer. Idempotent. */
export function uninstallScanDiagnosticsBridge() {
  return _safe(() => {
    if (!_installed) return;
    if (_drainTimer) {
      _safe(() => clearInterval(_drainTimer));
      _drainTimer = null;
    }
    if (typeof window !== 'undefined') {
      if (_heartbeatHandler) {
        _safe(() => window.removeEventListener(HEARTBEAT_EVENT, _heartbeatHandler));
        _heartbeatHandler = null;
      }
      _safe(() => window.removeEventListener('farroway:atomicLocaleSwitch', _onAtomicSwitch));
    }
    _lastSize = 0;
    _installed = false;
  });
}

/** Snapshot for tests / debug overlay. */
export function getScanDiagnosticsBridgeSnapshot() {
  return Object.freeze({
    installed:        _installed,
    lastSize:         _lastSize,
    drainerActive:    !!_drainTimer,
    sentryAvailable:  !!_getSentry(),
  });
}

const _module = {
  installScanDiagnosticsBridge,
  uninstallScanDiagnosticsBridge,
  getScanDiagnosticsBridgeSnapshot,
};
export default _module;
