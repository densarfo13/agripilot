/**
 * safeScanImagePipeline.js — pure gating + validation helpers for
 * the scan capture → preview → analyze flow.
 *
 *   import { validateImageCapture, validateImageDimensions,
 *            canAnalyze, isImageQualityPoor, shouldRevokeBlobUrl,
 *            recordScanObservation, SCAN_STAGE, SCAN_OBS }
 *     from 'src/core/scan/safeScanImagePipeline.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small collection of pure helpers + one tiny observability
 *   adapter. It does NOT render anything, NOT call the analyzer,
 *   and NOT replace `hybridScanEngine` / `analyzeImageSafe`. It
 *   gives the existing scan flow a single, testable set of rules
 *   for:
 *
 *     • when an image is "valid enough" to be analyzed,
 *     • when the preview is stable enough to analyze,
 *     • when an Object URL is safe to revoke (after analysis only),
 *     • when low confidence is justified by genuinely poor quality
 *       (so we don't auto-fail into a "not enough detail" verdict
 *       prematurely),
 *     • how scan-pipeline failures are tallied for monitoring.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O. SSR-safe — the observability
 *     emitter is the only side-effect path and is fully guarded.
 */

import { recordObservation, OBSERVABILITY } from '../observability/observabilityTracker.js';

// Lifecycle stages for the capture → analyze pipeline.
export const SCAN_STAGE = Object.freeze({
  IDLE:               'idle',
  CAPTURED:           'captured',
  VALIDATING:         'validating',
  PREVIEW_RENDERING:  'preview_rendering',
  PREVIEW_STABLE:     'preview_stable',
  ANALYZING:          'analyzing',
  RESULT:             'result',
  ERROR:              'error',
});

// Observability event names — paired with the right observabilityTracker
// category at the emit site.
export const SCAN_OBS = Object.freeze({
  INVALID_BLOB:          'invalid_blob',
  PREVIEW_RENDER_FAILED: 'preview_render_failed',
  PREVIEW_SUCCESS:       'preview_success',
  ANALYSIS_STARTED:      'analysis_started',
  ANALYSIS_FAILED:       'analysis_failed',
  CAMERA_TIMEOUT:        'camera_timeout',
  GALLERY_SUCCESS:       'gallery_success',
  LOW_CONFIDENCE_REASON: 'low_confidence_reason',
});

// Acceptable image MIME types.
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']);
const MIN_BYTES = 1024;            // < 1 KB is almost certainly a stub
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB hard upper bound
const MIN_DIM   = 64;              // shorter than 64 px → can't be a useful crop photo
const MAX_DIM   = 12000;           // sanity ceiling

function _detectMime(input) {
  if (!input) return '';
  if (typeof input === 'string') {
    const m = input.match(/^data:([^;,]+)[;,]/i);
    return m ? m[1].toLowerCase() : '';
  }
  return String(input.type || '').toLowerCase();
}

function _detectSize(input) {
  if (!input) return 0;
  if (typeof input === 'string') {
    // Rough — assume 3/4 of the base64 payload after the comma.
    const idx = input.indexOf(',');
    return idx >= 0 ? Math.floor((input.length - idx - 1) * 3 / 4) : input.length;
  }
  const s = Number(input.size);
  return Number.isFinite(s) ? s : 0;
}

/**
 * Validate a captured image source (File, Blob, or data URL).
 *
 * Returns a structured result — never throws. `ok:true` means
 * "this is safe to hand off to preview rendering"; `ok:false`
 * comes with a `reason` so the caller can show calm guidance and
 * the observability adapter can tally the failure.
 */
export function validateImageCapture(input) {
  try {
    if (input == null) return _bad('missing');
    const mime = _detectMime(input);
    const size = _detectSize(input);
    if (!mime) return _bad('unknown_mime');
    if (!ALLOWED_MIME.has(mime)) return _bad('unsupported_mime', { mime });
    if (size < MIN_BYTES) return _bad('too_small', { size });
    if (size > MAX_BYTES) return _bad('too_large', { size });
    return { ok: true, mime, sizeBytes: size, reason: '' };
  } catch {
    return _bad('exception');
  }
}

function _bad(reason, extras) {
  return { ok: false, reason, ...(extras || {}) };
}

/**
 * Validate image dimensions read from a loaded `<img>` /
 * `createImageBitmap` result. `null`/zero dimensions are treated
 * as not-yet-loaded → not a failure, but `ok:false`.
 */
export function validateImageDimensions(dim) {
  try {
    if (!dim || typeof dim !== 'object') return { ok: false, reason: 'missing' };
    const w = Number(dim.width), h = Number(dim.height);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return { ok: false, reason: 'not_loaded' };
    if (w <= 0 || h <= 0) return { ok: false, reason: 'not_loaded' };
    if (w < MIN_DIM || h < MIN_DIM) return { ok: false, reason: 'too_small_dim' };
    if (w > MAX_DIM || h > MAX_DIM) return { ok: false, reason: 'too_large_dim' };
    // Aspect-ratio sanity — extreme strips are almost never useful.
    const ratio = Math.max(w, h) / Math.min(w, h);
    if (ratio > 10) return { ok: false, reason: 'extreme_aspect' };
    return { ok: true, width: w, height: h, reason: '' };
  } catch {
    return { ok: false, reason: 'exception' };
  }
}

/**
 * `canAnalyze(state)` — the single GATE that decides whether we
 * may start analysis. False until we genuinely have a stable
 * preview + a validated image. Prevents the classic "analyze
 * fired on a half-loaded blob" bug.
 *
 * @param {object} state
 * @param {boolean} [state.isPreviewStable]
 * @param {object}  [state.captureValidation]   from validateImageCapture
 * @param {object}  [state.dimensionValidation] from validateImageDimensions
 * @param {boolean} [state.analysisInFlight]
 * @returns {boolean}
 */
export function canAnalyze(state) {
  try {
    const s = (state && typeof state === 'object') ? state : {};
    if (s.analysisInFlight === true) return false;        // no double-fire
    if (s.isPreviewStable !== true) return false;
    if (!s.captureValidation || s.captureValidation.ok !== true) return false;
    if (!s.dimensionValidation || s.dimensionValidation.ok !== true) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * `isPreviewStable(state)` — derived flag the UI can show
 * "stable preview" against. True only when an image element
 * actually reported `onload` AND the dimensions check passed.
 */
export function isPreviewStable(state) {
  try {
    const s = (state && typeof state === 'object') ? state : {};
    if (!s.previewLoaded) return false;
    const d = s.dimensionValidation;
    return !!(d && d.ok === true);
  } catch {
    return false;
  }
}

/**
 * Decide whether an image is GENUINELY too low-quality to analyze.
 * The spec rule: do not return "not enough detail" until we have
 * evidence — only when MULTIPLE quality signals fail, not just one.
 *
 * @param {object} metrics
 * @param {number} [metrics.brightness]   0..1
 * @param {number} [metrics.contrast]     0..1
 * @param {number} [metrics.blurScore]    0..1 (0=sharp, 1=blurry)
 * @param {number} [metrics.cropVisibility] 0..1
 * @returns {{ poor: boolean, reasons: string[] }}
 */
export function isImageQualityPoor(metrics) {
  try {
    const m = (metrics && typeof metrics === 'object') ? metrics : {};
    const reasons = [];
    const brightness   = Number(m.brightness);
    const contrast     = Number(m.contrast);
    const blurScore    = Number(m.blurScore);
    const cropVisible  = Number(m.cropVisibility);

    if (Number.isFinite(blurScore)    && blurScore >= 0.7)    reasons.push('blurry');
    if (Number.isFinite(brightness)   && brightness <= 0.15)  reasons.push('too_dark');
    if (Number.isFinite(brightness)   && brightness >= 0.95)  reasons.push('overexposed');
    if (Number.isFinite(contrast)     && contrast <= 0.1)     reasons.push('low_contrast');
    if (Number.isFinite(cropVisible)  && cropVisible <= 0.2)  reasons.push('crop_not_visible');

    // Spec §7 — fail to "not enough detail" only when at least
    // TWO independent signals agree. A single dim photo of a real
    // plant still gets normal analysis.
    return { poor: reasons.length >= 2, reasons };
  } catch {
    return { poor: false, reasons: [] };
  }
}

/**
 * Whether it is safe to revoke the Object URL backing the preview.
 * Spec §3: revoke ONLY after analysis has completed (or errored
 * out). Revoking mid-render is the Safari/iPhone "broken image"
 * bug — guard against it here.
 */
export function shouldRevokeBlobUrl(stage) {
  return stage === SCAN_STAGE.RESULT || stage === SCAN_STAGE.ERROR;
}

// ── Observability adapter ─────────────────────────────────────
//
// Maps the scan-pipeline event names to the `observabilityTracker`
// categories the operational dashboard already understands.
const _EVENT_TO_CATEGORY = Object.freeze({
  [SCAN_OBS.INVALID_BLOB]:          OBSERVABILITY.UPLOAD_FAILURE,
  [SCAN_OBS.PREVIEW_RENDER_FAILED]: OBSERVABILITY.SCAN_FAILURE,
  [SCAN_OBS.PREVIEW_SUCCESS]:       null, // no category — counter, see in-memory bag
  [SCAN_OBS.ANALYSIS_STARTED]:      null,
  [SCAN_OBS.ANALYSIS_FAILED]:       OBSERVABILITY.SCAN_FAILURE,
  [SCAN_OBS.CAMERA_TIMEOUT]:        OBSERVABILITY.SCAN_FAILURE,
  [SCAN_OBS.GALLERY_SUCCESS]:       null,
  [SCAN_OBS.LOW_CONFIDENCE_REASON]: null,
});

// Tiny in-memory bag for the non-error counts (success / started)
// so a debug screen can still surface them. Stays in memory only —
// the observabilityTracker handles the durable error counts.
const _scanCounts = {};

/**
 * Record a scan-pipeline event. Never throws — analytics failure
 * never breaks the scan flow.
 *
 * @param {string} event   one of SCAN_OBS
 * @returns {boolean}
 */
export function recordScanObservation(event) {
  try {
    if (!event) return false;
    _scanCounts[event] = (_scanCounts[event] || 0) + 1;
    const category = _EVENT_TO_CATEGORY[event];
    if (category) {
      try { recordObservation(category); } catch { /* observability is never load-bearing */ }
    }
    return true;
  } catch {
    return false;
  }
}

/** Read-only snapshot of the in-memory scan-event counters. */
export function getScanObservationCounts() {
  return { ..._scanCounts };
}

/** Reset the in-memory counters (test hook). */
export function resetScanObservationCounts() {
  for (const k of Object.keys(_scanCounts)) delete _scanCounts[k];
}

const _module = {
  SCAN_STAGE, SCAN_OBS,
  validateImageCapture, validateImageDimensions,
  canAnalyze, isPreviewStable, isImageQualityPoor,
  shouldRevokeBlobUrl,
  recordScanObservation, getScanObservationCounts, resetScanObservationCounts,
};
export default _module;
