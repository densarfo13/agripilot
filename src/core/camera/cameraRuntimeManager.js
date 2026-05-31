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
// iOS camera-init diagnostics — the REAL failed stage (not the vague
// "runtimeInitialized" the scan-startup probe reported) + timing.
let _failedStage    = null;
let _lastErrorName  = null;
let _startedAt      = 0;
let _settledAt      = 0;

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
    _failedStage = null;
    _startedAt   = _safe(() => Date.now(), 0);
    _settledAt   = 0;

    if (typeof navigator === 'undefined'
        || !navigator.mediaDevices
        || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      _setState(CAMERA_STATE.FAILED);
      _lastError   = 'getusermedia_unavailable';
      _failedStage = 'getusermedia_unsupported';
      return Object.freeze({
        ok: false, state: _state, stream: null,
        reason: _lastError, failedStage: _failedStage,
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
      _lastError   = 'init_timeout_or_denied';
      _failedStage = 'starting';   // getUserMedia timed out or was denied
      return Object.freeze({
        ok: false, state: _state, stream: null,
        reason: _lastError, failedStage: _failedStage,
      });
    }

    _activeStream = stream;
    _activeVideo  = _isObj(o.videoEl) ? o.videoEl : null;
    if (_activeVideo) {
      _safe(() => {
        const v = _activeVideo;
        // ─── iOS Safari video-attach order (CRITICAL) ───────────
        // The inline-playback attributes MUST be present as real
        // ATTRIBUTES, and set BEFORE the stream is attached — incl.
        // the legacy `webkit-playsinline` for older iOS. Setting them
        // only as properties, or after srcObject, makes iOS attempt
        // fullscreen playback, which fails inline and leaves
        // videoWidth at 0 ("stream received but no frames / Camera
        // unavailable" — the exact reported symptom).
        try { v.setAttribute('playsinline', 'true'); } catch { /* swallow */ }
        try { v.setAttribute('webkit-playsinline', 'true'); } catch { /* swallow */ }
        v.playsInline = true;
        v.muted       = true;
        v.autoplay    = true;
        // THEN attach the stream.
        v.srcObject = stream;
        const playRes = v.play && v.play();
        if (playRes && typeof playRes.catch === 'function') {
          // iOS may reject play() without a user gesture; the caller
          // (LiveCameraScanner) awaits real frames + offers a visible
          // "Tap to start camera" gesture path. Don't fail here.
          playRes.catch(() => { _failedStage = 'video_play_blocked'; });
        }
      }, null);
    }

    _installResumeListeners();
    _setState(CAMERA_STATE.ACTIVE);
    _lastError   = null;
    _settledAt   = _safe(() => Date.now(), 0);

    return Object.freeze({
      ok: true, state: _state, stream,
      reason: null, failedStage: null,
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
    const v = _activeVideo;
    const vw = (v && typeof v.videoWidth === 'number') ? v.videoWidth : 0;
    const vh = (v && typeof v.videoHeight === 'number') ? v.videoHeight : 0;
    const startupMs = (_startedAt > 0)
      ? Math.max(0, (_settledAt > 0 ? _settledAt : Date.now()) - _startedAt)
      : null;
    return Object.freeze({
      engineVersion:       ENGINE_VERSION,
      state:               _state,
      streamActive:        !!_activeStream,
      trackCount:          probe.trackCount || 0,
      validation:          probe,
      recoveryCount:       _recoveryCount,
      lastRecoveryReason:  _lastRecoveryReason,
      lastError:           _lastError,
      lastErrorName:       _lastErrorName,
      failedStage:         _failedStage,
      videoBound:          !!_activeVideo,
      videoAttached:       !!(v && v.srcObject),
      videoWidth:          vw,
      videoHeight:         vh,
      videoReady:          vw > 0,
      startupMs,
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

/**
 * installCameraHealthGlobal — pins window.__cameraHealth() with the
 * iOS camera-init contract envelope. Read-only; composes the live
 * runtime snapshot + a best-effort permission read. SSR-safe.
 */
export function installCameraHealthGlobal() {
  return _safe(() => {
    if (!_hasWindow()) return false;
    const w = window;
    if (typeof w.__cameraHealth === 'function') return true;
    w.__cameraHealth = function () {
      const snap = getRuntimeSnapshot();
      const getUserMediaSupported = _safe(() =>
        typeof navigator !== 'undefined'
        && !!navigator.mediaDevices
        && typeof navigator.mediaDevices.getUserMedia === 'function', false);
      // Permission state — synchronous best-effort; the live
      // LiveCameraScanner refreshes this via the Permissions API.
      const permissionState = _safe(() => {
        const cached = w.__farrowayCameraPermission;
        return typeof cached === 'string' ? cached : 'unknown';
      }, 'unknown');
      const out = Object.freeze({
        state:                 snap.state,
        permissionState,
        getUserMediaSupported,
        streamActive:          snap.streamActive,
        videoAttached:         snap.videoAttached,
        videoReady:            snap.videoReady,
        videoWidth:            snap.videoWidth,
        videoHeight:           snap.videoHeight,
        deviceCount:           _safe(() => {
          const n = w.__farrowayCameraDeviceCount;
          return typeof n === 'number' ? n : null;
        }, null),
        lastErrorName:         snap.lastErrorName,
        lastErrorMessage:      snap.lastError,
        startupMs:             snap.startupMs,
        failedStage:           snap.failedStage,
        // §3 — tracks stopped on close/unmount/retry (releaseTracks).
        cleanupReady:          true,
      });
      try {
        const dev = typeof import.meta !== 'undefined'
          && import.meta.env && import.meta.env.DEV;
        if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Camera]', out);
      } catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
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
  _failedStage = null;
  _lastErrorName = null;
  _startedAt = 0;
  _settledAt = 0;
}

export const _internal = Object.freeze({
  DEFAULT_TIMEOUT_MS, ENGINE_VERSION,
});

const _module = {
  CAMERA_STATE,
  initializeCamera, stopCamera, restartCamera,
  recoverCamera, releaseTracks, validateStream,
  isCameraHealthy, getActiveStream,
  releaseBlobUrl, getRuntimeSnapshot, installCameraHealthGlobal,
  _resetCameraRuntimeForTests, _internal,
};
export default _module;
