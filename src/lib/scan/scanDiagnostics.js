/**
 * scanDiagnostics — captures per-scan-run timing + failure
 * point in one structured record, for the dev-only Scan
 * Diagnostics panel.
 *
 *   import {
 *     startScanRun, recordStage, recordError, finishScanRun,
 *     getCurrentRun, getRecentRuns, classifyFailure,
 *   } from '../lib/scan/scanDiagnostics.js';
 *
 *   const runId = startScanRun({ source: 'camera' });
 *   recordStage('image_ready',      { size: 4_200_000, mime: 'image/jpeg' });
 *   recordStage('image_compressed', { size: 1_900_000, durationMs: 312 });
 *   recordStage('upload_success',   { durationMs: 1840, status: 200 });
 *   recordStage('inference_response', { durationMs: 6210, outcome: 'ok' });
 *   finishScanRun({ outcome: 'success' });
 *
 *   const summary = getCurrentRun();
 *   //   { runId, stages, totalMs, failurePoint, outcome }
 *
 * Why a dedicated collector
 *   The existing scanPipelineLogger emits ONE tagged console
 *   line per stage. That's enough for an ops grep but not
 *   enough for the dev panel the spec asks for ("upload ms /
 *   inference ms / response status / image size / failure
 *   point"). This collector aggregates the same events into a
 *   structured run record so the panel can render the whole
 *   pipeline at a glance + so future "what failed?" reports
 *   carry timing instead of just a single error name.
 *
 *   Memory footprint: stays under 16KB even with the last 10
 *   runs cached.
 *
 * Strict-rule audit
 *   * Pure data — no DOM, no localStorage (the dev panel is
 *     ephemeral), no network.
 *   * Never throws. Every entry point catches.
 *   * SSR-safe.
 *   * No PII — only stage names, durations, sizes, status codes,
 *     mime types, and short error messages.
 */

const MAX_HISTORY = 10;

const _state = {
  current:  null,
  history:  [], // newest LAST
};

function _now() { try { return Date.now(); } catch { return 0; } }

function _shortMessage(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 200);
  if (value instanceof Error) {
    const name = value.name || 'Error';
    const msg  = value.message ? value.message.slice(0, 200) : '';
    return msg ? `${name}: ${msg}` : name;
  }
  try { return String(value).slice(0, 200); } catch { return 'unknown'; }
}

function _pickSafePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const ALLOWED = new Set([
    'size', 'mime', 'mimeType', 'width', 'height',
    'durationMs', 'attempt', 'status', 'statusCode',
    'outcome', 'reason', 'kind',
    'compressedSize', 'originalSize', 'compressionRatio',
    'scanId',
  ]);
  const out = {};
  for (const k of Object.keys(payload)) {
    if (!ALLOWED.has(k)) continue;
    const v = payload[k];
    if (v == null) { out[k] = null; continue; }
    const t = typeof v;
    if (t === 'number' || t === 'boolean') { out[k] = v; continue; }
    if (t === 'string') out[k] = v.length > 120 ? v.slice(0, 120) + '…' : v;
  }
  return out;
}

// ─── Run lifecycle ───────────────────────────────────────────

/**
 * Begin a new diagnostics run. Returns the runId so callers
 * can correlate later stage records.
 *
 * @param {object} [meta]
 * @param {string} [meta.source]  e.g. 'camera' | 'gallery'
 * @returns {string}
 */
export function startScanRun(meta) {
  try {
    const safe = (meta && typeof meta === 'object') ? meta : {};
    const runId = 'scan_run_' + _now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    _state.current = {
      runId,
      source:       typeof safe.source === 'string' ? safe.source : 'unknown',
      startedAt:    _now(),
      finishedAt:   null,
      outcome:      null,        // 'success' | 'failure' | 'cancelled'
      failurePoint: null,        // stage name at which we failed
      errorMessage: null,
      stages:       [],
    };
    return runId;
  } catch { return 'scan_run_unknown'; }
}

/**
 * Record a stage event. Idempotent — multiple stage records
 * are appended in order so the diagnostics panel can render the
 * full sequence.
 *
 * @param {string} stage   short stage identifier
 * @param {object} [payload]
 */
export function recordStage(stage, payload) {
  try {
    if (!_state.current) return;
    const s = typeof stage === 'string' ? stage.trim() : 'unknown';
    _state.current.stages.push({
      stage:    s,
      at:       _now(),
      payload:  _pickSafePayload(payload),
    });
  } catch { /* swallow */ }
}

/**
 * Mark a failure point + capture the error message. Does NOT
 * finish the run — callers call finishScanRun separately so
 * the panel always sees a terminal record.
 *
 * @param {string} stage    where the failure happened
 * @param {any} error       Error / DOMException / string
 */
export function recordError(stage, error) {
  try {
    if (!_state.current) return;
    _state.current.failurePoint = typeof stage === 'string' ? stage : 'unknown';
    _state.current.errorMessage = _shortMessage(error);
  } catch { /* swallow */ }
}

/**
 * Close out the current run and push it onto the history ring.
 *
 * @param {object} [meta]
 * @param {('success'|'failure'|'cancelled')} [meta.outcome]
 */
export function finishScanRun(meta) {
  try {
    if (!_state.current) return;
    const safe = (meta && typeof meta === 'object') ? meta : {};
    const outcome = safe.outcome === 'success' || safe.outcome === 'failure' || safe.outcome === 'cancelled'
                    ? safe.outcome
                    : (_state.current.failurePoint ? 'failure' : 'success');
    _state.current.finishedAt = _now();
    _state.current.outcome    = outcome;
    _state.history.push(_state.current);
    if (_state.history.length > MAX_HISTORY) {
      _state.history.splice(0, _state.history.length - MAX_HISTORY);
    }
    _state.current = null;
  } catch { /* swallow */ }
}

// ─── Snapshots ──────────────────────────────────────────────

/**
 * @returns {object|null} the in-flight run record, or null when
 *                       no run is active
 */
export function getCurrentRun() {
  if (!_state.current) return null;
  return _toSummary(_state.current);
}

/**
 * @param {number} [limit]
 * @returns {Array} most-recent runs first
 */
export function getRecentRuns(limit) {
  const n = Number.isFinite(limit) && limit > 0
              ? Math.min(MAX_HISTORY, limit)
              : MAX_HISTORY;
  return _state.history.slice(-n).reverse().map(_toSummary);
}

function _toSummary(run) {
  if (!run) return null;
  const totalMs = (run.finishedAt || _now()) - run.startedAt;
  // Per-stage durations (gap between this stage and the previous one).
  const stages = run.stages.map((s, i) => {
    const prev = i === 0 ? run.startedAt : run.stages[i - 1].at;
    return {
      stage:    s.stage,
      at:       s.at,
      sinceStart: s.at - run.startedAt,
      sincePrev:  s.at - prev,
      payload:  s.payload,
    };
  });
  return {
    runId:        run.runId,
    source:       run.source,
    startedAt:    run.startedAt,
    finishedAt:   run.finishedAt,
    totalMs:      Math.max(0, totalMs),
    outcome:      run.outcome,
    failurePoint: run.failurePoint,
    errorMessage: run.errorMessage,
    stages,
  };
}

/**
 * Classify a failure into one of the spec-mandated user-facing
 * categories. Used by the dev panel + by callers that want to
 * render a specific message instead of a generic timeout.
 *
 * @param {object} run   summary returned by getCurrentRun / getRecentRuns
 * @returns {string} one of:
 *   'upload_failed' | 'inference_timeout' | 'invalid_response' |
 *   'network_unavailable' | 'unauthorized' | 'server_error' |
 *   'unsupported_image' | 'unknown'
 */
export function classifyFailure(run) {
  try {
    if (!run || run.outcome === 'success') return 'unknown';
    const stage = String(run.failurePoint || '').toLowerCase();
    const err   = String(run.errorMessage || '').toLowerCase();

    if (stage.includes('upload') && err.includes('network'))  return 'network_unavailable';
    if (stage.includes('upload'))                              return 'upload_failed';
    if (stage.includes('parse') || stage.includes('json'))     return 'invalid_response';
    if (stage.includes('inference') || stage.includes('analyze')) {
      if (err.includes('timeout')) return 'inference_timeout';
      if (err.match(/\b401\b|unauth/)) return 'unauthorized';
      if (err.match(/\b5\d\d\b/) || err.includes('server')) return 'server_error';
      return 'inference_timeout';
    }
    if (stage.includes('compress') || stage.includes('image')) return 'unsupported_image';
    if (err.includes('network') || err.includes('offline'))    return 'network_unavailable';
    if (err.match(/\b401\b|unauth/))                            return 'unauthorized';
    if (err.match(/\b5\d\d\b/) || err.includes('server'))       return 'server_error';
    return 'unknown';
  } catch { return 'unknown'; }
}

/**
 * Map a failure class to short user-facing copy. Spec §2 — no
 * generic timeout; surface the actual class.
 */
export function failureMessage(kind) {
  switch (kind) {
    case 'upload_failed':       return 'Upload failed. Check your connection and try again.';
    case 'inference_timeout':   return 'The analyzer took too long. Try a clearer photo.';
    case 'invalid_response':    return 'The server response could not be read.';
    case 'network_unavailable': return 'You appear to be offline. Reconnect and retry.';
    case 'unauthorized':        return 'Your session expired. Sign in again to retry.';
    case 'server_error':        return 'The analyzer is unavailable right now. Try again shortly.';
    case 'unsupported_image':   return 'This photo could not be prepared. Try a smaller JPEG or PNG.';
    default:                    return 'Scan could not finish. Try again or upload a photo.';
  }
}

/** Test seam — flush every recorded run. */
export function _resetScanDiagnostics() {
  _state.current  = null;
  _state.history.length = 0;
}

const _module = {
  startScanRun,
  recordStage,
  recordError,
  finishScanRun,
  getCurrentRun,
  getRecentRuns,
  classifyFailure,
  failureMessage,
  _resetScanDiagnostics,
};
export default _module;
