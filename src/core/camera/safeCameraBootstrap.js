/**
 * safeCameraBootstrap.js — iPhone Safari camera stream-bootstrap
 * state machine + readiness gate.
 *
 *   import { BOOTSTRAP_STAGE, REQUIRED_VIDEO_ATTRS, READY_STATE,
 *            nextBootstrapStage, shouldShowFallback,
 *            cameraHealthCheck, isFrameRendering, canEnableCapture,
 *            cleanupStream, getCleanupSteps,
 *            recordBootstrapObservation, BOOTSTRAP_OBS }
 *     from 'src/core/camera/safeCameraBootstrap.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Pure helpers that fix the "iPhone Safari fallback fires before
 *   the camera has actually failed" bug. The fallback timer rule
 *   is the heart of it: the fallback may only fire after
 *   permission has been granted AND while we are still stuck
 *   waiting for getUserMedia. As soon as the stream is attached
 *   to the <video>, the fallback must back off and let Safari
 *   finish its render.
 *
 *   This module does NOT call `navigator.mediaDevices`, does NOT
 *   own the video element, and does NOT replace
 *   `cameraPermissionManager`. The two compose: permission first,
 *   bootstrap second.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe — DOM is only touched through
 *     objects the caller hands in. Observability emit is wrapped.
 */

import { recordObservation, OBSERVABILITY } from '../observability/observabilityTracker.js';

// Bootstrap lifecycle stages.
export const BOOTSTRAP_STAGE = Object.freeze({
  IDLE:              'idle',
  PERMISSION_CHECK:  'permission_check',
  STREAM_REQUESTING: 'stream_requesting',  // getUserMedia is pending
  STREAM_ATTACHED:   'stream_attached',    // video.srcObject set
  METADATA_LOADED:   'metadata_loaded',    // loadedmetadata fired
  FIRST_FRAME:       'first_frame',        // playing event / first frame painted
  READY:             'ready',              // safe to enable capture
  FAILED:            'failed',
  CLEANING:          'cleaning',
});

// Allowed transitions; anything not listed is a no-op (we stay in
// the current stage so a stray event never breaks the flow).
const TRANSITIONS = Object.freeze({
  idle:              [BOOTSTRAP_STAGE.PERMISSION_CHECK, BOOTSTRAP_STAGE.FAILED],
  permission_check:  [BOOTSTRAP_STAGE.STREAM_REQUESTING, BOOTSTRAP_STAGE.FAILED],
  stream_requesting: [BOOTSTRAP_STAGE.STREAM_ATTACHED, BOOTSTRAP_STAGE.FAILED],
  stream_attached:   [BOOTSTRAP_STAGE.METADATA_LOADED, BOOTSTRAP_STAGE.FAILED, BOOTSTRAP_STAGE.CLEANING],
  metadata_loaded:   [BOOTSTRAP_STAGE.FIRST_FRAME, BOOTSTRAP_STAGE.FAILED, BOOTSTRAP_STAGE.CLEANING],
  first_frame:       [BOOTSTRAP_STAGE.READY, BOOTSTRAP_STAGE.FAILED, BOOTSTRAP_STAGE.CLEANING],
  ready:             [BOOTSTRAP_STAGE.CLEANING, BOOTSTRAP_STAGE.FAILED],
  failed:            [BOOTSTRAP_STAGE.IDLE, BOOTSTRAP_STAGE.CLEANING],
  cleaning:          [BOOTSTRAP_STAGE.IDLE],
});

/**
 * Advance the bootstrap state machine. Invalid signals are a
 * no-op so the UI never crashes on a stray browser event.
 */
export function nextBootstrapStage(current, next) {
  try {
    const cur = String(current || BOOTSTRAP_STAGE.IDLE);
    const nxt = String(next || '');
    const allowed = TRANSITIONS[cur];
    if (allowed && allowed.includes(nxt)) return nxt;
    return cur;
  } catch {
    return BOOTSTRAP_STAGE.IDLE;
  }
}

// HTMLMediaElement.readyState constants — mirrored so tests / non-
// DOM callers can compare without a `HTMLMediaElement` reference.
export const READY_STATE = Object.freeze({
  HAVE_NOTHING:      0,
  HAVE_METADATA:     1,
  HAVE_CURRENT_DATA: 2,
  HAVE_FUTURE_DATA:  3,
  HAVE_ENOUGH_DATA:  4,
});

// Mandatory <video> attributes for the iPhone Safari path.
// The capture surface should spread these onto its element.
export const REQUIRED_VIDEO_ATTRS = Object.freeze({
  autoPlay:    true,
  muted:       true,
  playsInline: true,
});

// Default fallback windows. Safari can legitimately take 3–5 s to
// paint the first frame, so the "stuck attached" threshold is
// double the "stuck requesting" one.
const DEFAULT_REQUEST_FALLBACK_MS = 7_000;
const DEFAULT_ATTACHED_FALLBACK_MS = 14_000;

/**
 * Whether the fallback UI should be shown right now.
 *
 *   • TRUE  when the stage is FAILED.
 *   • TRUE  when we are still in STREAM_REQUESTING and have waited
 *           past `fallbackMs`.
 *   • TRUE  when the stream is ATTACHED but has not progressed past
 *           it past `fallbackMs * 2` (Safari render lag).
 *   • FALSE in every other stage — once the stream is progressing
 *           we let Safari finish. This is the heart of the fix.
 *
 * @param {object} args
 * @param {string} args.stage          current bootstrap stage
 * @param {number} args.stageStartMs   when the current stage was entered
 * @param {number} [args.nowMs]        injectable clock
 * @param {number} [args.fallbackMs]   default 7 s for REQUESTING
 * @returns {boolean}
 */
export function shouldShowFallback(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const stage = String(a.stage || '');
    if (stage === BOOTSTRAP_STAGE.FAILED) return true;
    const start = Number(a.stageStartMs);
    if (!Number.isFinite(start)) return false;
    const now = Number.isFinite(a.nowMs) ? a.nowMs : Date.now();
    const elapsed = now - start;
    const requestFallback = Number.isFinite(a.fallbackMs) ? a.fallbackMs : DEFAULT_REQUEST_FALLBACK_MS;
    const attachedFallback = Number.isFinite(a.attachedFallbackMs) ? a.attachedFallbackMs : Math.max(requestFallback * 2, DEFAULT_ATTACHED_FALLBACK_MS);

    if (stage === BOOTSTRAP_STAGE.STREAM_REQUESTING && elapsed > requestFallback) return true;
    if (stage === BOOTSTRAP_STAGE.STREAM_ATTACHED   && elapsed > attachedFallback) return true;
    // METADATA_LOADED / FIRST_FRAME / READY / IDLE / PERMISSION_CHECK / CLEANING
    // are explicitly NOT eligible — the stream is progressing or
    // we have not yet started, so showing a fallback is wrong.
    return false;
  } catch {
    return false;
  }
}

/**
 * Health check for an in-flight camera session — used both for
 * "is the stream alive?" polling and for the final
 * `canEnableCapture` gate. Returns `{ healthy, issues[] }`.
 *
 * @param {object} state
 * @param {object} [state.stream]      MediaStream-like
 * @param {object} [state.video]       HTMLVideoElement-like
 */
export function cameraHealthCheck(state) {
  try {
    const issues = [];
    if (!state || typeof state !== 'object') return { healthy: false, issues: ['no_state'] };

    const stream = state.stream;
    if (!stream) issues.push('no_stream');
    else if (typeof stream.getTracks === 'function') {
      const tracks = stream.getTracks() || [];
      if (tracks.length === 0) issues.push('no_tracks');
      else if (tracks.every((t) => t && t.readyState === 'ended')) issues.push('tracks_ended');
    }

    const video = state.video;
    if (!video) issues.push('no_video');
    else {
      if (!video.srcObject) issues.push('no_srcObject');
      const rs = Number(video.readyState);
      if (!Number.isFinite(rs) || rs < READY_STATE.HAVE_CURRENT_DATA) issues.push('not_ready');
      const w = Number(video.videoWidth);
      const h = Number(video.videoHeight);
      if (!w || !h) issues.push('no_dimensions');
    }

    return { healthy: issues.length === 0, issues };
  } catch {
    return { healthy: false, issues: ['exception'] };
  }
}

/** Quick boolean — is the video actually rendering frames? */
export function isFrameRendering(state) {
  return cameraHealthCheck(state).healthy;
}

/**
 * The capture button gate. Capture is enabled ONLY when the stage
 * machine has reached READY AND the health check passes. Never
 * trust the stage alone — Safari sometimes fires `playing` before
 * the first frame paints, so we always also verify dimensions +
 * readyState.
 *
 * @param {object} state { stage, stream, video }
 * @returns {boolean}
 */
export function canEnableCapture(state) {
  try {
    if (!state || state.stage !== BOOTSTRAP_STAGE.READY) return false;
    return cameraHealthCheck(state).healthy === true;
  } catch {
    return false;
  }
}

// ── Cleanup ──────────────────────────────────────────────────
/**
 * Stop every track on a MediaStream. The caller still clears
 * `video.srcObject` themselves — this module never touches the
 * DOM. Returns true if at least one track was found and stopped.
 *
 * @param {object} stream  MediaStream-like (must expose getTracks)
 * @returns {boolean}
 */
export function cleanupStream(stream) {
  try {
    if (!stream || typeof stream.getTracks !== 'function') return false;
    const tracks = stream.getTracks() || [];
    if (tracks.length === 0) return false;
    for (const t of tracks) {
      try { if (t && typeof t.stop === 'function') t.stop(); }
      catch { /* swallow — best effort */ }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * The cleanup script — the ordered list of actions the surface
 * must run before a retry. We expose this as data, not behaviour,
 * so the surface can apply it in its own React effect cleanly.
 */
export const CLEANUP_STEPS = Object.freeze([
  'stop_tracks',          // stream.getTracks().forEach(t => t.stop())
  'clear_src_object',     // video.srcObject = null
  'await_release',        // await microtask so Safari releases the lock
]);

export function getCleanupSteps() {
  return CLEANUP_STEPS.slice();
}

// ── Observability ────────────────────────────────────────────
export const BOOTSTRAP_OBS = Object.freeze({
  STREAM_ACQUIRED:         'stream_acquired',
  STREAM_FAILED:           'stream_failed',
  VIDEO_READY:             'video_ready',
  FALLBACK_TRIGGERED:      'fallback_triggered',
  RETRY_SUCCESS:           'retry_success',
  STREAM_CLEANUP_SUCCESS:  'stream_cleanup_success',
  SAFARI_STREAM_DELAY:     'safari_stream_delay',
});

const _EVENT_TO_CATEGORY = Object.freeze({
  [BOOTSTRAP_OBS.STREAM_FAILED]:        OBSERVABILITY.SCAN_FAILURE,
  [BOOTSTRAP_OBS.FALLBACK_TRIGGERED]:   OBSERVABILITY.SCAN_FAILURE,
  // The remaining events are counters only (no error category).
  [BOOTSTRAP_OBS.STREAM_ACQUIRED]:        null,
  [BOOTSTRAP_OBS.VIDEO_READY]:            null,
  [BOOTSTRAP_OBS.RETRY_SUCCESS]:          null,
  [BOOTSTRAP_OBS.STREAM_CLEANUP_SUCCESS]: null,
  [BOOTSTRAP_OBS.SAFARI_STREAM_DELAY]:    null,
});

const _bootstrapCounts = {};

/**
 * Record a bootstrap event. Never throws — observability is never
 * load-bearing on the camera path.
 *
 * @param {string} event one of BOOTSTRAP_OBS
 * @returns {boolean}
 */
export function recordBootstrapObservation(event) {
  try {
    if (!event) return false;
    _bootstrapCounts[event] = (_bootstrapCounts[event] || 0) + 1;
    const category = _EVENT_TO_CATEGORY[event];
    if (category) {
      try { recordObservation(category); } catch { /* ignore */ }
    }
    return true;
  } catch {
    return false;
  }
}

/** Read-only snapshot of bootstrap counters. */
export function getBootstrapObservationCounts() {
  return { ..._bootstrapCounts };
}

/** Reset bootstrap counters (test hook). */
export function resetBootstrapObservationCounts() {
  for (const k of Object.keys(_bootstrapCounts)) delete _bootstrapCounts[k];
}

const _module = {
  BOOTSTRAP_STAGE, BOOTSTRAP_OBS, READY_STATE, REQUIRED_VIDEO_ATTRS, CLEANUP_STEPS,
  nextBootstrapStage, shouldShowFallback,
  cameraHealthCheck, isFrameRendering, canEnableCapture,
  cleanupStream, getCleanupSteps,
  recordBootstrapObservation, getBootstrapObservationCounts, resetBootstrapObservationCounts,
};
export default _module;
