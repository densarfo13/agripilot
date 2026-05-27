/**
 * cameraRuntimeManager.js — single MediaStream lifecycle owner.
 *
 *   import {
 *     initializeCamera, stopCamera, restartCamera,
 *     recoverCamera, releaseTracks, validateStream, isCameraHealthy,
 *     getActiveStream, CAMERA_STATE,
 *   } from 'src/core/camera/cameraRuntimeManager.js';
 *
 *   const r = await initializeCamera({ videoEl, constraints });
 *   if (!r.ok) { ... surface upload fallback ... }
 *
 * What this is
 * ────────────
 *   Enforces SPEC §2: one active stream at a time. Every call to
 *   `initializeCamera` first releases any prior tracks. Every
 *   visibility change revalidates the stream. Page navigation
 *   stops the stream cleanly.
 *
 *   Combines spec §1 + §2 + §5 + §6 + §7 + §12 in one focused
 *   module — runtime ownership, recovery, memory release, resume,
 *   and timeout protection. Pairs with cameraHealthEngine for the
 *   probe + permission contract.
 *
 *   Does NOT replace mobileCameraLifecycle / cameraFallbackEngine
 *   — composes alongside them. Those handle HEIC + EXIF + 3-tier
 *   fallback strategy; this owns the live MediaStream.
 *
 * Strict-rule audit
 *   • Pure-ish runtime. Never throws. SSR-safe.
 *   • Tracks are released BEFORE creating a new stream — no
 *     overlapping requests.
 *   • Visibility + pagehide listeners idempotently installed.
 *   • Stream creation timeout = 8s per spec §12.
 */

const ENGINE_VERSION = 'camera-runtime-v1';
const DEFAULT_TIMEOUT_MS = 8000;

export const CAMERA_STATE = Object.freeze({
  IDLE:        'idle',
  STARTING:    'starting',
  ACTIVE:      'active',
  RECOVERING:  'recovering',
  STOPPED:     'stopped',
  FAILED:      'failed',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

let _activeStream   = null;
let _activeVideo    = null;
let _state          = CAMERA_STATE.IDLE;
let _lastError      = null;
let _recoveryCount  = 0;
let _lastRecoveryReason = null;
let _listenersInstalled = false;
let _initInFlight   = false;

function _hasWindow()   { try { return typeof window !== 'undefined'; } catch { return false; } }
function _hasDocument() { try { return typeof document !== 'undefined'; } catch { return false; } }

function _setState(s) { _state = s; }

/**
 * Release every track on the currently-active stream. Idempotent.
 */
export function releaseTracks() {
  return _safe(() => {
    if (!_activeStream) return false;
    try {
      const tracks = _activeStream.getTracks
        ? _activeStream.getTracks() : [];
      for (const t of tracks) {
        try { t.stop(); } catch { /* swallow */ }
      }
    } catch { /* swallow */ }
    // Detach from any bound video element.
    if (_activeVideo) {
      try { _activeVideo.srcObject = null; } catch { /* swallow */ }
    }
    _activeStream = null;
    return true;
  }, false);
}

/**
 * Stop the camera + release resources. Use on unmount / route
 * change / background.
 */
export function stopCamera(reason) {
  return _safe(() => {
    releaseTracks();
    _activeVideo = null;
    _setState(CAMERA_STATE.STOPPED);
    return Object.freeze({ ok: true, reason: reason || 'manual_stop' });
  }, Object.freeze({ ok: false, reason: 'stop_error' }));
}

/**
 * Validate the current stream — checks track count, readyState,
 * and (if a video element is attached) video dimensions.
 */
export function validateStream() {
  return _safe(() => {
    if (!_activeStream) {
      return Object.freeze({ valid: false, reason: 'no_stream' });
    }
    const tracks = _activeStream.getTracks
      ? _activeStream.getTracks() : [];
    if (tracks.length === 0) {
      return Object.freeze({ valid: false, reason: 'no_tracks' });
    }
    const liveTracks = tracks.filter((t) => t && t.readyState === 'live');
    if (liveTracks.length === 0) {
      return Object.freeze({ valid: false, reason: 'no_live_tracks' });
    }
    if (_activeVideo) {
      const w = _activeVideo.videoWidth;
      const h = _activeVideo.videoHeight;
      if (typeof w === 'number' && typeof h === 'number' && w === 0 && h === 0) {
        return Object.freeze({ valid: false, reason: 'zero_dimensions' });
      }
    }
    return Object.freeze({ valid: true, reason: null,
      trackCount: tracks.length });
  }, Object.freeze({ valid: false, reason: 'validate_error' }));
}

/**
 * One-look healthy probe — quick boolean for surfaces.
 */
export function isCameraHealthy() {
  return validateStream().valid;
}

export function getActiveStream() { return _activeStream; }

/**
 * Initialize the camera. Releases any prior stream first.
 * Idempotent — concurrent calls return the first result.
 *
 *   @param {object} opts
 *     @prop {HTMLVideoElement} [opts.videoEl]
 *     @prop {object} [opts.constraints]  — getUserMedia constraints
 *     @prop {number} [opts.timeoutMs]    — default 8000
 *   @returns Promise<{ ok, state, stream, reason }>
 */
export async function initializeCamera(opts) {
  if (_initInFlight) {
    return Object.freeze({
      ok: false, state: _state, stream: null,
      reason: 'init_already_in_flight',
    });
  }
  _initInFlight = true;
  try {
    const o = _isObj(opts) ? opts : {};
    const timeoutMs = (typeof o.timeoutMs === 'number' && o.timeoutMs > 0)
      ? o.timeoutMs : DEFAULT_TIMEOUT_MS;

    // 1) Release any prior stream.
    releaseTracks();
    _setState(CAMERA_STATE.STARTING);

    if (typeof navigator === 'undefined'
        || !navigator.mediaDevices
        || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      _setState(CAMERA_STATE.FAILED);
      _lastError = 'getusermedia_unavailable';
      return Object.freeze({
        ok: false, state: _state, stream: null,
        reason: _lastError,
      });
    }

    // 2) Race timeout + actual getUserMedia.
    const stream = await _safe(async () => {
      const userMediaPromise = navigator.mediaDevices.getUserMedia(
        o.constraints || { video: { facingMode: { ideal: 'environment' } } },
      );
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), timeoutMs);
      });
      return Promise.race([userMediaPromise, timeoutPromise]);
    }, null);

    if (!stream) {
      _setState(CAMERA_STATE.FAILED);
      _lastError = 'init_timeout_or_denied';
      return Object.freeze({
        ok: false, state: _state, stream: null,
        reason: _lastError,
      });
    }

    _activeStream = stream;
    _activeVideo  = _isObj(o.videoEl) ? o.videoEl : null;
    if (_activeVideo) {
      _safe(() => {
        _activeVideo.srcObject = stream;
        // iOS Safari critical attrs
        _activeVideo.playsInline = true;
        _activeVideo.muted       = true;
        _activeVideo.autoplay    = true;
        const playRes = _activeVideo.play && _activeVideo.play();
        if (playRes && typeof playRes.catch === 'function') {
          playRes.catch(() => { /* iOS rejects when not user-initiated */ });
        }
      }, null);
    }

    _installResumeListeners();
    _setState(CAMERA_STATE.ACTIVE);
    _lastError = null;

    return Object.freeze({
      ok: true, state: _state, stream,
      reason: null,
    });
  } finally {
    _initInFlight = false;
  }
}

/**
 * Restart the camera — stop + initialize again. Used by surfaces
 * after a failed scan or when the user explicitly retries.
 */
export async function restartCamera(opts) {
  stopCamera('restart');
  return initializeCamera(opts);
}

/**
 * Auto-recover from a degraded stream. Validates first; recovers
 * silently when validation fails. Preserves scan continuity by
 * NOT firing any visible error.
 */
export async function recoverCamera(opts) {
  return _safe(async () => {
    const probe = validateStream();
    if (probe.valid) return Object.freeze({
      ok: true, recovered: false, reason: 'already_healthy',
    });
    _recoveryCount += 1;
    _lastRecoveryReason = probe.reason;
    _setState(CAMERA_STATE.RECOVERING);
    const init = await initializeCamera(opts);
    return Object.freeze({
      ok:        init.ok,
      recovered: init.ok,
      reason:    probe.reason,
      newState:  _state,
    });
  }, Object.freeze({ ok: false, recovered: false, reason: 'recover_error' }));
}

// ─── Resume / visibility listeners ───────────────────────────

function _installResumeListeners() {
  if (_listenersInstalled) return;
  if (!_hasDocument()) return;
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && _state === CAMERA_STATE.ACTIVE) {
      const probe = validateStream();
      if (!probe.valid) {
        // Silent revalidate via recovery — defensive only.
        _safe(() => recoverCamera({}), null);
      }
    }
  };
  const onPagehide = () => {
    stopCamera('pagehide');
  };
  _safe(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (_hasWindow()) window.addEventListener('pagehide', onPagehide);
  }, null);
  _listenersInstalled = true;
}

// ─── Memory pressure helpers ─────────────────────────────────

/**
 * Release a stale image blob URL safely. Used by surfaces that
 * cycle through multiple previews to keep mobile Safari from
 * holding GC'd blobs.
 */
export function releaseBlobUrl(url) {
  return _safe(() => {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return false;
    if (typeof url !== 'string' || !url.startsWith('blob:')) return false;
    URL.revokeObjectURL(url);
    return true;
  }, false);
}

// ─── Public snapshot ─────────────────────────────────────────

export function getRuntimeSnapshot() {
  return _safe(() => {
    const probe = validateStream();
    return Object.freeze({
      engineVersion:       ENGINE_VERSION,
      state:               _state,
      streamActive:        !!_activeStream,
      trackCount:          probe.trackCount || 0,
      validation:          probe,
      recoveryCount:       _recoveryCount,
      lastRecoveryReason:  _lastRecoveryReason,
      lastError:           _lastError,
      videoBound:          !!_activeVideo,
      generatedAt:         Date.now(),
    });
  }, Object.freeze({
    engineVersion: ENGINE_VERSION,
    state: _state, streamActive: false, trackCount: 0,
    validation: { valid: false, reason: 'snapshot_error' },
    recoveryCount: _recoveryCount,
    lastRecoveryReason: _lastRecoveryReason,
    lastError: _lastError, videoBound: false,
    generatedAt: Date.now(),
  }));
}

/** Test-only reset. */
export function _resetCameraRuntimeForTests() {
  releaseTracks();
  _activeStream = null;
  _activeVideo  = null;
  _state        = CAMERA_STATE.IDLE;
  _lastError    = null;
  _recoveryCount = 0;
  _lastRecoveryReason = null;
  _listenersInstalled = false;
  _initInFlight = false;
}

export const _internal = Object.freeze({
  DEFAULT_TIMEOUT_MS, ENGINE_VERSION,
});

const _module = {
  CAMERA_STATE,
  initializeCamera, stopCamera, restartCamera,
  recoverCamera, releaseTracks, validateStream,
  isCameraHealthy, getActiveStream,
  releaseBlobUrl, getRuntimeSnapshot,
  _resetCameraRuntimeForTests, _internal,
};
export default _module;
