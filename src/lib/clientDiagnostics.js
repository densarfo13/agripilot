/**
 * clientDiagnostics.js — production-grade, farmer-exportable client diagnostics.
 *
 * WHY THIS EXISTS (2026-07-05): the scan server path is healthy (/api/scan/analyze
 * returns 200) but a fraction of devices still reach the "Scan temporarily unavailable"
 * fallback AFTER the 200. The exception lived only in the browser (window.__scanResultCrash),
 * was lost on reload, and the client's analytics posts return 200 but persist NOTHING
 * server-side — so the exact exception was never capturable. This module fixes that:
 *
 *   • Every uncaught client exception (window.onerror, unhandledrejection, React error
 *     boundaries) is persisted to localStorage until exported — it survives a reload.
 *   • A rolling buffer of the last 200 lifecycle events is persisted alongside it.
 *   • buildDiagnosticReport() assembles message/stack/componentStack/correlationId/scanId/
 *     route/phase/timestamp + render/upload/analyze/result-render lifecycles + device info.
 *
 * Contract: SSR-safe (guards typeof window), NEVER throws, never blocks, does not touch
 * business logic. It only reads existing globals + mirrors existing telemetry.
 */

const EVENTS_KEY = 'farroway_diag_events_v1';
const EXC_KEY = 'farroway_diag_exceptions_v1';
const MAX_EVENTS = 200;
const MAX_EXCEPTIONS = 25;

let _events = [];
let _installed = false;
let _flushTimer = null;

function _hasWindow() { return typeof window !== 'undefined' && !!window; }
function _now() { try { return new Date().toISOString(); } catch { return ''; } }
function _str(v) { return (v == null) ? '' : String(v); }
function _safe(fn) { try { return fn(); } catch { return undefined; } }
function _ls() { try { return _hasWindow() ? window.localStorage : null; } catch { return null; } }
function _safeData(d) {
  try { if (d == null) return null; JSON.stringify(d); return d; }
  catch { return { note: 'unserializable' }; }
}
function _currentRoute() {
  return _safe(() => (window.location && (window.location.pathname + window.location.search)) || '') || '';
}
function _currentCorrelationId() {
  return _safe(() => _str(window.__lastScanCorrelationId)) || '';
}
function _currentScanId() {
  return _safe(() => {
    const t = window.__scanTrace;
    if (Array.isArray(t)) {
      for (let i = t.length - 1; i >= 0; i--) {
        const s = t[i] && (t[i].scanId || (t[i].data && t[i].data.scanId));
        if (s) return _str(s);
      }
    }
    return _str(window.__lastScanId);
  }) || '';
}

function _loadEvents() {
  try {
    const raw = _ls() && _ls().getItem(EVENTS_KEY);
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) _events = a.slice(-MAX_EVENTS); }
  } catch { /* start fresh */ }
}
function _flushNow() {
  try { const ls = _ls(); if (ls) ls.setItem(EVENTS_KEY, JSON.stringify(_events.slice(-MAX_EVENTS))); }
  catch { /* quota / private mode — keep in memory */ }
}
function _scheduleFlush() {
  if (_flushTimer) return;
  try { _flushTimer = setTimeout(() => { _flushTimer = null; _flushNow(); }, 400); }
  catch { _flushNow(); }
}

/** Record one lifecycle event into the rolling 200-entry buffer (persisted, best-effort). */
export function recordDiagEvent(category, name, data) {
  try {
    if (typeof name !== 'string' || !name) return;
    _events.push({
      ts: _now(), category: _str(category) || 'event', name,
      route: _currentRoute(), data: _safeData(data),
    });
    if (_events.length > MAX_EVENTS) _events = _events.slice(-MAX_EVENTS);
    _scheduleFlush();
  } catch { /* diagnostics must never break the app */ }
}

/** Persist one uncaught exception (survives reload) with full render context. */
export function recordDiagException(partial) {
  try {
    const p = partial || {};
    const rec = {
      ts: _now(),
      message: _str(p.message).slice(0, 1000),
      stack: _str(p.stack).slice(0, 6000),
      componentStack: _str(p.componentStack).slice(0, 6000),
      correlationId: _str(p.correlationId) || _currentCorrelationId(),
      scanId: _str(p.scanId) || _currentScanId(),
      route: _str(p.route) || _currentRoute(),
      phase: _str(p.phase) || 'unknown',
      source: _str(p.source) || 'app',
      recentEvents: _events.slice(-25),
    };
    const ls = _ls();
    let arr = [];
    try { const raw = ls && ls.getItem(EXC_KEY); if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) arr = a; } } catch { arr = []; }
    arr.push(rec);
    if (arr.length > MAX_EXCEPTIONS) arr = arr.slice(-MAX_EXCEPTIONS);
    try { if (ls) ls.setItem(EXC_KEY, JSON.stringify(arr)); } catch { /* private mode */ }
    if (_hasWindow()) { try { window.__farrowayLastException = rec; } catch { /* frozen */ } }
    recordDiagEvent('exception', rec.phase + ':' + rec.source, { message: rec.message.slice(0, 200) });
    _flushNow(); // a crash is exactly when we cannot afford to lose the buffer
  } catch { /* never throw from the recorder */ }
}

function _deviceInfo() {
  const n = _safe(() => window.navigator) || {};
  const s = _safe(() => window.screen) || {};
  return {
    userAgent: _str(n.userAgent),
    platform: _str(n.platform),
    vendor: _str(n.vendor),
    language: _str(n.language),
    languages: _safe(() => (n.languages || []).join(',')) || '',
    online: _safe(() => n.onLine),
    cookieEnabled: _safe(() => n.cookieEnabled),
    deviceMemory: _safe(() => n.deviceMemory) || null,
    hardwareConcurrency: _safe(() => n.hardwareConcurrency) || null,
    standalonePWA: _safe(() => !!n.standalone)
      || _safe(() => !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)) || false,
    connection: _safe(() => {
      const c = n.connection; if (!c) return null;
      return { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData };
    }) || null,
    viewport: { w: _safe(() => window.innerWidth), h: _safe(() => window.innerHeight), dpr: _safe(() => window.devicePixelRatio) },
    screen: { w: _safe(() => s.width), h: _safe(() => s.height) },
    timezone: _safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone) || '',
    isIOS: _safe(() => /iP(hone|ad|od)/.test(_str(n.platform) + ' ' + _str(n.userAgent))) || false,
    isSafari: _safe(() => /^((?!chrome|android|crios|fxios).)*safari/i.test(_str(n.userAgent))) || false,
  };
}

/** Assemble the full exportable diagnostic report (pure read; never throws). */
export function buildDiagnosticReport() {
  const w = _hasWindow() ? window : {};
  let exceptions = [];
  try { const raw = _ls() && _ls().getItem(EXC_KEY); if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) exceptions = a; } } catch { exceptions = []; }
  const events = _events.slice(-MAX_EVENTS);
  const has = (n, ...subs) => subs.some((s) => n.indexOf(s) !== -1);
  const bucket = (pred) => events.filter((e) => pred(_str(e.name).toLowerCase()));

  return {
    schema: 'farroway-diagnostic-report/v1',
    generatedAt: _now(),
    app: {
      uiVersion: _safe(() => w.FARROWAY_UI_VERSION) || _safe(() => w.__farrowayBuild && w.__farrowayBuild.version) || null,
      commit: _safe(() => w.__farrowayBuild && w.__farrowayBuild.commit) || null,
      href: _safe(() => w.location && w.location.href) || '',
      route: _currentRoute(),
    },
    correlationId: _currentCorrelationId(),
    scanId: _currentScanId(),
    exceptions,                         // req 1 + 2: persisted uncaught exceptions, full fields
    lifecycle: {                        // req 4b–e: render / upload / analyze / result-render
      render:       bucket((n) => has(n, 'render', 'route', 'mount', 'scan_opened', 'scan_load', 'startup', 'suspense')),
      upload:       bucket((n) => has(n, 'upload', 'photo', 'capture', 'image', 'camera')),
      analyze:      bucket((n) => has(n, 'analyz', 'provider', 'scan_api', 'inference')),
      resultRender: bucket((n) => has(n, 'result', 'completed', 'complete', 'unclear', 'fallback', 'render_error')),
    },
    lastEvents: events,                 // req 4a: last 200 lifecycle events
    scanTrace: _safe(() => w.__scanTrace) || null,          // 15-step pipeline trace
    scanResultCrash: _safe(() => w.__scanResultCrash) || null,
    lazyLoadError: {
      message: _safe(() => w.__lastLazyLoadErrorMessage) || null,
      route: _safe(() => w.__lastLazyLoadErrorRoute) || null,
      at: _safe(() => w.__lastLazyLoadErrorAt) || null,
    },
    device: _deviceInfo(),              // req 4f: browser / device information
  };
}

/** Report as pretty JSON string, ready to copy / share / download. */
export function getReportJSON() {
  try { return JSON.stringify(buildDiagnosticReport(), null, 2); }
  catch { return '{"schema":"farroway-diagnostic-report/v1","error":"serialization_failed"}'; }
}

/** Clear persisted diagnostics after a successful export (optional). */
export function clearDiagnostics() {
  try { const ls = _ls(); if (ls) { ls.removeItem(EVENTS_KEY); ls.removeItem(EXC_KEY); } _events = []; } catch { /* ignore */ }
}

/** Install global handlers ONCE at boot. Idempotent, SSR-safe, never throws. */
export function installClientDiagnostics() {
  if (_installed || !_hasWindow()) return;
  _installed = true;
  try {
    _loadEvents();
    window.addEventListener('error', (e) => {
      try {
        // Skip pure resource-load errors (img/script 404) — no Error object AND a DOM target.
        if (e && !e.error && e.target && e.target !== window && e.target.nodeType) return;
        const err = e && e.error;
        recordDiagException({
          source: 'window.onerror', phase: 'runtime',
          message: (err && err.message) || (e && e.message) || 'window error',
          stack: (err && err.stack) || '',
        });
      } catch { /* never throw in a handler */ }
    });
    window.addEventListener('unhandledrejection', (e) => {
      try {
        const r = e && e.reason;
        recordDiagException({
          source: 'unhandledrejection', phase: 'promise',
          message: (r && r.message) || _str(r) || 'unhandled rejection',
          stack: (r && r.stack) || '',
        });
      } catch { /* never throw in a handler */ }
    });
    window.addEventListener('pagehide', () => { try { _flushNow(); } catch { /* ignore */ } });
    // Expose for console / manual export and for the on-screen export button.
    window.__farrowayDiagnostics = Object.freeze({
      record: recordDiagEvent, exception: recordDiagException,
      report: buildDiagnosticReport, json: getReportJSON, clear: clearDiagnostics,
    });
    window.exportFarrowayDiagnostics = getReportJSON;
    recordDiagEvent('diag', 'diagnostics_installed', null);
  } catch { /* diagnostics install must never break boot */ }
}

export default { installClientDiagnostics, recordDiagEvent, recordDiagException, buildDiagnosticReport, getReportJSON, clearDiagnostics };
