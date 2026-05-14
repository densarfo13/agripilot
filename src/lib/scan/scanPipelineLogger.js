/**
 * scanPipelineLogger — single greppable log emitter for every
 * stage of the scan pipeline.
 *
 *   import { logScanStage, SCAN_STAGES } from '../lib/scan/scanPipelineLogger.js';
 *
 *   const t0 = logScanStage(SCAN_STAGES.CAPTURED, { size: 4200000 });
 *   // ... do compression ...
 *   logScanStage(SCAN_STAGES.COMPRESSED, { size: 1900000, durationMs: Date.now() - t0 });
 *
 * Tags emitted (single greppable line per stage):
 *   [SCAN_CAPTURED]
 *   [SCAN_COMPRESSED]
 *   [SCAN_UPLOAD_STARTED]
 *   [SCAN_UPLOAD_SUCCESS]
 *   [SCAN_INFERENCE_STARTED]
 *   [SCAN_INFERENCE_RESPONSE]
 *   [SCAN_RENDER_SUCCESS]
 *   [SCAN_PIPELINE_ERROR]
 *
 * Why this module exists
 *   The Scan Pipeline Timeout Audit needs ops to be able to
 *   identify exactly which stage stalled in a future report.
 *   The dev console gets a single tagged line per stage with
 *   the relevant context (size, duration, stage outcome) so
 *   "scan is taking longer than expected" complaints can be
 *   diagnosed without re-instrumenting.
 *
 * Strict-rule audit
 *   * Pure JS. Never throws. SSR-safe.
 *   * No PII / image bytes / auth tokens leak into the log.
 *   * Returns Date.now() so callers can compute durations
 *     without a second clock call.
 */

export const SCAN_STAGES = Object.freeze({
  CAPTURED:            'SCAN_CAPTURED',
  COMPRESSED:          'SCAN_COMPRESSED',
  UPLOAD_STARTED:      'SCAN_UPLOAD_STARTED',
  UPLOAD_SUCCESS:      'SCAN_UPLOAD_SUCCESS',
  INFERENCE_STARTED:   'SCAN_INFERENCE_STARTED',
  INFERENCE_RESPONSE:  'SCAN_INFERENCE_RESPONSE',
  RENDER_SUCCESS:      'SCAN_RENDER_SUCCESS',
  PIPELINE_ERROR:      'SCAN_PIPELINE_ERROR',
});

const _SAFE_KEYS = new Set([
  'size', 'mimeType', 'durationMs', 'attempt', 'stage',
  'outcome', 'reason', 'error', 'kind', 'status',
  'imageWidth', 'imageHeight', 'scanId',
]);

function _summarisePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const out = {};
  for (const k of Object.keys(payload)) {
    if (!_SAFE_KEYS.has(k)) continue;
    const v = payload[k];
    if (v == null) { out[k] = null; continue; }
    const t = typeof v;
    if (t === 'number' || t === 'boolean') { out[k] = v; continue; }
    if (t === 'string') { out[k] = v.length > 120 ? v.slice(0, 120) + '…' : v; }
  }
  return out;
}

function _isDevEnv() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
      return true;
    }
  } catch { /* swallow */ }
  return false;
}

/**
 * Emit a tagged pipeline log line + return the current timestamp.
 * Caller can subtract from a later Date.now() to compute stage
 * duration without an extra clock read.
 *
 * @param {string} stage  one of SCAN_STAGES.*
 * @param {object} [payload]
 * @returns {number} Date.now() at the time of the call
 */
export function logScanStage(stage, payload) {
  const now = (() => { try { return Date.now(); } catch { return 0; } })();
  if (!_isDevEnv()) return now;
  try {
    const tag = `[${String(stage || 'SCAN_UNKNOWN')}]`;
    const safe = _summarisePayload(payload);
    if (safe && Object.keys(safe).length > 0) {

      console.log(tag, safe);
    } else {

      console.log(tag);
    }
  } catch { /* swallow */ }
  return now;
}

/**
 * Emit the terminal SCAN_PIPELINE_ERROR with a tagged outcome so
 * a future log triage can group "scan failed at stage X" reports
 * without manual parsing.
 */
export function logScanPipelineError(stage, error) {
  const reason = (error && (error.name || error.message)) || 'unknown';
  return logScanStage(SCAN_STAGES.PIPELINE_ERROR, {
    stage:  stage || 'unknown',
    reason: String(reason),
  });
}

const _module = {
  SCAN_STAGES,
  logScanStage,
  logScanPipelineError,
};
export default _module;
