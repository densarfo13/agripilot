/**
 * scanTraceRecorder — production Scan Debug Harness collector.
 *
 * Records the 15 canonical scan pipeline steps into window.__scanTrace so the exact
 * on-device failing step can be exported from /admin/scan-debug. Non-invasive: it taps
 * the existing telemetry sink (safeTrackEvent) — the scan engine is NOT refactored.
 *
 * Globals installed (read from the debug page / DevTools on the failing device):
 *   window.__scanTrace              — ordered step records
 *   window.__lastScanCorrelationId  — current scan correlation id
 *   window.__scanResultCrash        — set by ScanResultErrorBoundary on a render throw
 *   window.recordScanStep(step,ctx) — manual step record
 *   window.exportScanDebug()        — full debug bundle (JSON-serialisable)
 *
 * Pure helpers (unit-tested): STEPS, mapTelemetryToStep, deriveTraceSummary,
 * buildScanDebugBundle. The window side-effects are a thin wrapper.
 */
import { getScanCorrelationId } from './scanCorrelationId.js';

// The 15 canonical steps, in order.
export const STEPS = Object.freeze([
  'camera_opened', 'photo_selected', 'image_type_detected',
  'image_compression_started', 'image_compression_completed',
  'upload_started', 'upload_completed', 'image_url_created',
  'scan_api_called', 'provider_called', 'provider_response_received',
  'provider_response_parsed', 'diagnosis_normalized',
  'result_render_started', 'result_render_completed',
]);

// Map the app's real telemetry event names onto canonical steps.
const _EVENT_TO_STEP = {
  scan_opened: 'camera_opened', camera_started: 'camera_opened', camera_opened: 'camera_opened',
  photo_selected: 'photo_selected', image_captured: 'photo_selected',
  image_type_detected: 'image_type_detected',
  image_compression_started: 'image_compression_started',
  image_compression_completed: 'image_compression_completed',
  image_upload_started: 'upload_started', upload_started: 'upload_started',
  image_upload_completed: 'upload_completed', upload_completed: 'upload_completed',
  image_upload_failed: 'upload_completed', // records as fail
  image_url_created: 'image_url_created',
  scan_provider_started: 'scan_api_called', scan_api_called: 'scan_api_called',
  provider_called: 'provider_called',
  scan_provider_completed: 'provider_response_received', provider_response_received: 'provider_response_received',
  scan_provider_failed: 'provider_response_received', // records as fail
  provider_response_parsed: 'provider_response_parsed',
  diagnosis_normalized: 'diagnosis_normalized', scan_analyzed: 'diagnosis_normalized',
  result_render_started: 'result_render_started',
  result_render_completed: 'result_render_completed', scan_result_success: 'result_render_completed',
  scan_component_error: 'result_render_started', // a render crash
  scan_result_render_error: 'result_render_started',
};

/** Pure: telemetry event name → canonical step (or null). */
export function mapTelemetryToStep(eventName) {
  if (typeof eventName !== 'string') return null;
  return _EVENT_TO_STEP[eventName] || null;
}

const _FAIL_EVENTS = new Set(['image_upload_failed', 'scan_provider_failed', 'scan_component_error',
  'scan_result_render_error', 'scan_result_failed']);

/** Pure: summarise a trace → last reached step + first failing step. */
export function deriveTraceSummary(trace) {
  const list = Array.isArray(trace) ? trace : [];
  let lastReachedStep = null, failingStep = null;
  const reached = [];
  for (const r of list) {
    if (!r || typeof r.step !== 'string') continue;
    reached.push(r.step);
    lastReachedStep = r.step;
    if (r.status === 'fail' && !failingStep) failingStep = r.step;
  }
  // If nothing explicitly failed, the failing step is the one AFTER the last reached
  // (i.e. the pipeline stopped there).
  if (!failingStep && lastReachedStep) {
    const i = STEPS.indexOf(lastReachedStep);
    if (i >= 0 && i < STEPS.length - 1 && lastReachedStep !== 'result_render_completed') failingStep = STEPS[i + 1];
  }
  return Object.freeze({ reached, lastReachedStep, failingStep });
}

/** Pure: build the exportable debug bundle from injected pieces (testable, no globals). */
export function buildScanDebugBundle({ trace, crash, correlationId, nav, screen, timestamp }) {
  const summary = deriveTraceSummary(trace);
  const n = nav || {};
  const s = screen || {};
  return {
    correlationId: correlationId || null,
    generatedAt: timestamp || null,
    failingStep: summary.failingStep,
    lastReachedStep: summary.lastReachedStep,
    stepsReached: summary.reached,
    crash: crash || null,
    browser: { userAgent: n.userAgent || null, platform: n.platform || null,
      language: n.language || null, vendor: n.vendor || null, online: n.onLine !== false },
    device: { width: s.width || null, height: s.height || null,
      dpr: s.devicePixelRatio || null, touch: !!s.touch },
    trace: Array.isArray(trace) ? trace : [],
  };
}

const _RING = 200;

function _win() { return typeof window !== 'undefined' ? window : null; }

/** Side-effect: record a step to window.__scanTrace (+ crash/browser context on fail). */
export function recordScanStep(step, ctx) {
  const w = _win();
  if (!w) return;
  try {
    if (!Array.isArray(w.__scanTrace)) w.__scanTrace = [];
    let correlationId = 'scan-unknown';
    try { correlationId = getScanCorrelationId(); } catch { /* keep */ }
    w.__lastScanCorrelationId = correlationId;
    const c = ctx && typeof ctx === 'object' ? ctx : {};
    const rec = {
      step: String(step || 'unknown'),
      status: c.status === 'fail' || c.status === 'start' ? c.status : 'ok',
      ts: (function () { try { return new Date().toISOString(); } catch { return null; } })(),
      correlationId,
    };
    if (c.error) rec.error = String(c.error).slice(0, 300);
    if (c.httpStatus != null) rec.httpStatus = c.httpStatus;
    if (c.imageType) rec.imageType = String(c.imageType).slice(0, 40);
    if (c.imageSize != null) rec.imageSize = c.imageSize;
    if (c.meta) { try { rec.meta = JSON.parse(JSON.stringify(c.meta)); } catch { /* skip */ } }
    w.__scanTrace.push(rec);
    if (w.__scanTrace.length > _RING) w.__scanTrace.splice(0, w.__scanTrace.length - _RING);
  } catch { /* never throw from a diagnostic */ }
}

/** Tap point for safeTrackEvent: mirror scan_* telemetry into the trace. */
export function recordTelemetryStep(eventName, metadata) {
  const step = mapTelemetryToStep(eventName);
  if (!step) return;
  const c = metadata && typeof metadata === 'object' ? metadata : {};
  recordScanStep(step, {
    status: _FAIL_EVENTS.has(eventName) ? 'fail' : 'ok',
    error: c.message || c.error || c.failureReason,
    httpStatus: c.httpStatus,
    imageType: c.imageType, imageSize: c.imageSize || c.size,
    meta: c.componentStack ? { componentStack: String(c.componentStack).slice(0, 400) } : undefined,
  });
}

/** Install the window globals (idempotent). Call once at boot. */
export function installScanTrace() {
  const w = _win();
  if (!w) return;
  try {
    if (!Array.isArray(w.__scanTrace)) w.__scanTrace = [];
    w.recordScanStep = recordScanStep;
    w.exportScanDebug = function exportScanDebug() {
      const nav = (typeof navigator !== 'undefined') ? navigator : {};
      const scr = (typeof window !== 'undefined')
        ? { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio,
            touch: 'ontouchstart' in window }
        : {};
      let cid = w.__lastScanCorrelationId || null;
      try { if (!cid) cid = getScanCorrelationId(); } catch { /* keep */ }
      let ts = null; try { ts = new Date().toISOString(); } catch { /* keep */ }
      return buildScanDebugBundle({ trace: w.__scanTrace, crash: w.__scanResultCrash || null,
        correlationId: cid, nav, screen: scr, timestamp: ts });
    };
  } catch { /* tolerate */ }
}

const _module = { STEPS, mapTelemetryToStep, deriveTraceSummary, buildScanDebugBundle,
  recordScanStep, recordTelemetryStep, installScanTrace };
export default _module;
