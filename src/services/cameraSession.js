/**
 * cameraSession.js — canonical single-session camera service.
 *
 *   import { startCamera, stopCamera, getCameraState }
 *     from '../services/cameraSession.js';
 *
 *   const result = await startCamera(videoEl, { facingMode: 'environment' });
 *   if (!result.ok) {
 *     // show fallback UI
 *   }
 *
 *   // On unmount / route change:
 *   stopCamera();
 *
 * Why this exists
 *   iPhone Safari (and to a lesser extent iOS PWAs + Android
 *   Chrome) become unstable when two getUserMedia calls overlap,
 *   when a stream attaches to a video element that's still
 *   mid-rerender, or when a stream is abandoned without its
 *   tracks being explicitly stopped. Symptoms include:
 *     • "Camera ran into a problem" with no further info.
 *     • Black preview that never updates.
 *     • OS camera light staying on after route change.
 *     • Second permission prompt on subsequent visits.
 *
 *   This module is the spec-mandated single source of truth for
 *   camera streams. It maintains a module-level singleton stream
 *   reference and guarantees:
 *     • Only ONE active stream at a time.
 *     • Only ONE getUserMedia call in flight.
 *     • Every old stream's tracks are explicitly stopped before
 *       a new one is requested.
 *     • Visibility-change events pause + resume cleanly.
 *     • Failed starts retry exactly ONCE after 500 ms; no
 *       infinite retry storm.
 *     • Safari 150 ms stabilisation delay before attaching the
 *       stream to the supplied video element.
 *
 * State machine (matches the iPhone Safari Stability spec §7)
 *   idle | requesting_permission | starting_camera | camera_ready
 *   | capturing | uploading | analyzing | completed | failed
 *
 * Strict-rule audit
 *   • Pure JS — no React imports.
 *   • SSR-safe — every navigator/document/window access guarded.
 *   • Never throws — every entry point catches and returns a
 *     typed result object.
 */

const PREFERRED_CONSTRAINTS = (facing) => ({
  video: {
    facingMode: { ideal: facing || 'environment' },
    width:  { ideal: 1280 },
    height: { ideal: 720  },
  },
  audio: false,
});

const MIN_CONSTRAINTS = () => ({
  video: true,
  audio: false,
});

const SAFARI_ATTACH_DELAY_MS = 150;
const RETRY_DELAY_MS         = 500;
const READY_DEADLINE_MS      = 10000;

// ─── Canonical state machine ────────────────────────────────────
export const CAMERA_SESSION_STATES = Object.freeze({
  IDLE:                  'idle',
  REQUESTING_PERMISSION: 'requesting_permission',
  STARTING_CAMERA:       'starting_camera',
  CAMERA_READY:          'camera_ready',
  CAPTURING:             'capturing',
  UPLOADING:             'uploading',
  ANALYZING:             'analyzing',
  COMPLETED:             'completed',
  FAILED:                'failed',
});

// ─── Module-level singleton ────────────────────────────────────
let _activeStream = null;
let _activeVideo  = null;
let _initializing = false;
let _state        = CAMERA_SESSION_STATES.IDLE;
let _visibilityHandler = null;

function _setState(next) {
  if (_state === next) return;
  _state = next;
  try {
    // eslint-disable-next-line no-console
    console.log('[SCAN_CAMERA_STATE]', next);
  } catch { /* swallow */ }
}

/**
 * Current session state. Pure read; never throws.
 */
export function getCameraState() {
  return _state;
}

/**
 * Whether a stream is currently active. Pure read.
 */
export function isCameraActive() {
  return !!_activeStream;
}

/**
 * Stop the active stream, if any. Idempotent + SSR-safe.
 * Logs [SCAN_STREAM_STOPPED] when something was actually stopped.
 */
export function stopCamera() {
  let stopped = false;
  try {
    if (_activeStream && typeof _activeStream.getTracks === 'function') {
      _activeStream.getTracks().forEach((track) => {
        try { track.stop(); stopped = true; }
        catch { /* per-track tolerate */ }
      });
    }
  } catch { /* swallow */ }
  _activeStream = null;
  try {
    if (_activeVideo) {
      try { _activeVideo.pause(); } catch { /* swallow */ }
      try { _activeVideo.srcObject = null; } catch { /* swallow */ }
    }
  } catch { /* swallow */ }
  _activeVideo = null;
  try {
    if (_visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', _visibilityHandler);
    }
  } catch { /* swallow */ }
  _visibilityHandler = null;
  _setState(CAMERA_SESSION_STATES.IDLE);
  if (stopped) {
    try {
      // eslint-disable-next-line no-console
      console.log('[SCAN_STREAM_STOPPED]');
    } catch { /* swallow */ }
  }
  try {
    // eslint-disable-next-line no-console
    console.log('[SCAN_STREAM_ACTIVE]', false);
  } catch { /* swallow */ }
}

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, Math.max(0, ms | 0)));
}

function _isSupported() {
  try {
    if (typeof navigator === 'undefined') return false;
    if (!navigator.mediaDevices) return false;
    if (typeof navigator.mediaDevices.getUserMedia !== 'function') return false;
    return true;
  } catch { return false; }
}

function _classifyError(err) {
  try {
    const name = (err && (err.name || err.code)) || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
    if (name === 'NotFoundError'   || name === 'DevicesNotFoundError') return 'not_found';
    if (name === 'NotReadableError' || name === 'TrackStartError')      return 'busy';
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'overconstrained';
    return 'unknown';
  } catch { return 'unknown'; }
}

async function _getMedia(facing) {
  // First attempt — preferred constraints.
  try {
    return await navigator.mediaDevices.getUserMedia(PREFERRED_CONSTRAINTS(facing));
  } catch (e1) {
    // Spec §6 — retry exactly once after 500 ms with lenient
    // constraints. Single-camera devices + older browsers reject
    // the ideal-resolution hints.
    await _sleep(RETRY_DELAY_MS);
    try {
      return await navigator.mediaDevices.getUserMedia(MIN_CONSTRAINTS());
    } catch (e2) {
      const err = new Error('getUserMedia_failed');
      err.cause  = e2 || e1;
      err.reason = _classifyError(e2 || e1);
      throw err;
    }
  }
}

function _awaitVideoReady(videoEl, deadlineMs) {
  return new Promise((resolve, reject) => {
    if (!videoEl) { reject(new Error('no_video_element')); return; }
    let done = false;
    const cleanup = () => {
      try { videoEl.removeEventListener('loadedmetadata', onMeta); } catch { /* swallow */ }
      try { videoEl.removeEventListener('canplay',        onCanPlay); } catch { /* swallow */ }
      try { videoEl.removeEventListener('playing',        onPlaying); } catch { /* swallow */ }
      try { clearTimeout(timer); } catch { /* swallow */ }
    };
    const finish = (ok, why) => {
      if (done) return;
      done = true;
      cleanup();
      if (ok) resolve(); else reject(new Error(why || 'unknown'));
    };
    let metaSeen = false;
    let playingSeen = false;
    function maybeReady() {
      if (metaSeen && (playingSeen || videoEl.readyState >= 3)) {
        if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          try {
            // eslint-disable-next-line no-console
            console.log('[SCAN_VIDEO_READY]');
          } catch { /* swallow */ }
          finish(true);
        }
      }
    }
    function onMeta()    { metaSeen = true;    maybeReady(); }
    function onCanPlay() { if (videoEl.videoWidth > 0) { metaSeen = true; playingSeen = true; maybeReady(); } }
    function onPlaying() { playingSeen = true; maybeReady(); }
    try {
      videoEl.addEventListener('loadedmetadata', onMeta);
      videoEl.addEventListener('canplay',        onCanPlay);
      videoEl.addEventListener('playing',        onPlaying);
    } catch { /* swallow */ }
    if (videoEl.readyState >= 1) onMeta();
    if (videoEl.readyState >= 3) onCanPlay();
    const timer = setTimeout(() => finish(false, 'ready_deadline'), Math.max(1000, deadlineMs | 0));
  });
}

function _installVisibilityHandler() {
  try {
    if (typeof document === 'undefined') return;
    if (_visibilityHandler) return;
    _visibilityHandler = () => {
      try {
        if (document.visibilityState === 'hidden') {
          // Pause video — keep the stream alive so a quick
          // tab-switch back doesn't require re-prompt. The track
          // stays live but the <video> stops decoding frames.
          if (_activeVideo) {
            try { _activeVideo.pause(); } catch { /* swallow */ }
          }
        } else if (_activeVideo && _activeStream) {
          // Resume — re-attach if Safari nulled srcObject during
          // the hide window.
          if (!_activeVideo.srcObject) {
            try { _activeVideo.srcObject = _activeStream; } catch { /* swallow */ }
          }
          try {
            const p = _activeVideo.play();
            if (p && typeof p.catch === 'function') p.catch(() => { /* swallow */ });
          } catch { /* swallow */ }
        }
      } catch { /* swallow */ }
    };
    document.addEventListener('visibilitychange', _visibilityHandler);
  } catch { /* swallow */ }
}

/**
 * Start the camera and attach to the supplied video element.
 *
 *   const result = await startCamera(videoEl, { facingMode });
 *
 *   result.ok      — true when the preview is ready
 *   result.stream  — the active MediaStream
 *   result.reason  — when ok=false: 'unsupported' | 'denied' |
 *                    'not_found' | 'busy' | 'overconstrained' |
 *                    'in_flight' | 'no_video' | 'ready_deadline'
 *                    | 'unknown'
 *
 * Idempotency: if a stream is already active AND the same video
 * element is supplied, returns the existing stream with ok=true.
 * If a different video element is supplied, the existing stream
 * is stopped first.
 */
export async function startCamera(videoEl, options = {}) {
  if (!_isSupported()) {
    _setState(CAMERA_SESSION_STATES.FAILED);
    return { ok: false, reason: 'unsupported' };
  }
  if (!videoEl) {
    _setState(CAMERA_SESSION_STATES.FAILED);
    return { ok: false, reason: 'no_video' };
  }
  // Reuse — same video element, stream alive.
  if (_activeStream && _activeVideo === videoEl) {
    _setState(CAMERA_SESSION_STATES.CAMERA_READY);
    return { ok: true, stream: _activeStream, reused: true };
  }
  // Different video element — stop the old stream first.
  if (_activeStream && _activeVideo !== videoEl) {
    stopCamera();
  }
  // In-flight guard.
  if (_initializing) {
    return { ok: false, reason: 'in_flight' };
  }
  _initializing = true;
  _setState(CAMERA_SESSION_STATES.REQUESTING_PERMISSION);
  try {
    const facing = options.facingMode || 'environment';
    const stream = await _getMedia(facing);
    _activeStream = stream;
    _activeVideo  = videoEl;
    _setState(CAMERA_SESSION_STATES.STARTING_CAMERA);
    // Spec §10 — Safari needs a slight stabilisation delay before
    // attaching the stream to the video element.
    await _sleep(SAFARI_ATTACH_DELAY_MS);
    try {
      videoEl.srcObject = stream;
      const p = videoEl.play();
      if (p && typeof p.catch === 'function') {
        await p.catch(() => { /* autoplay policy — let readiness wait decide */ });
      }
    } catch { /* swallow — readiness wait will catch */ }
    try {
      await _awaitVideoReady(videoEl, READY_DEADLINE_MS);
    } catch (waitErr) {
      stopCamera();
      _setState(CAMERA_SESSION_STATES.FAILED);
      return { ok: false, reason: waitErr && waitErr.message ? waitErr.message : 'ready_deadline' };
    }
    _installVisibilityHandler();
    _setState(CAMERA_SESSION_STATES.CAMERA_READY);
    try {
      // eslint-disable-next-line no-console
      console.log('[SCAN_STREAM_ACTIVE]', true);
    } catch { /* swallow */ }
    return { ok: true, stream };
  } catch (err) {
    stopCamera();
    _setState(CAMERA_SESSION_STATES.FAILED);
    return { ok: false, reason: (err && err.reason) || _classifyError(err) || 'unknown' };
  } finally {
    _initializing = false;
  }
}

/**
 * Retry — fully stop the current stream, clear pending state,
 * and re-attempt startCamera with the same video element.
 *
 * Logs [SCAN_RETRY_TRIGGERED] before retrying.
 */
export async function retryCamera(videoEl, options = {}) {
  try {
    // eslint-disable-next-line no-console
    console.log('[SCAN_RETRY_TRIGGERED]');
  } catch { /* swallow */ }
  stopCamera();
  return startCamera(videoEl, options);
}

/**
 * Update the workflow state after camera_ready (capturing,
 * uploading, analyzing, completed). Exposed so the consumer
 * can drive the state machine through the upload/analyze
 * lifecycle without the service needing to know about those
 * subsystems.
 */
export function setSessionState(next) {
  if (typeof next !== 'string') return;
  if (!Object.values(CAMERA_SESSION_STATES).includes(next)) return;
  _setState(next);
}

// Test-only reset.
export function _resetCameraSession() {
  _activeStream = null;
  _activeVideo  = null;
  _initializing = false;
  _state        = CAMERA_SESSION_STATES.IDLE;
  _visibilityHandler = null;
}

const _module = {
  CAMERA_SESSION_STATES,
  startCamera,
  stopCamera,
  retryCamera,
  getCameraState,
  isCameraActive,
  setSessionState,
  _resetCameraSession,
};
export default _module;
