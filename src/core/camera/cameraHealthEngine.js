/**
 * cameraHealthEngine.js — health probe + permission state
 * (combines spec §4 + §9 + §14 + §15 in one focused module).
 *
 *   import {
 *     probeCameraHealth, probeCameraPermissionState,
 *     installCameraDiagnostics, PERMISSION_STATE,
 *     resolveStartupMessage,
 *   } from 'src/core/camera/cameraHealthEngine.js';
 *
 *   const h = probeCameraHealth({ videoEl });
 *   const p = await probeCameraPermissionState();
 *   const msg = resolveStartupMessage({ state, recovering });
 *
 * What this is
 * ────────────
 *   The READ side of the camera runtime contract:
 *
 *     • probeCameraHealth() — synchronous structural snapshot of
 *       the current stream + video element. Returns the §4 envelope.
 *
 *     • probeCameraPermissionState() — silently probes
 *       navigator.permissions and returns one of GRANTED / DENIED
 *       / PROMPT / BLOCKED / UNAVAILABLE. NEVER triggers the OS
 *       prompt. Maps spec §9.
 *
 *     • installCameraDiagnostics() — pins `window.__cameraHealth()`
 *       per spec §15.
 *
 *     • resolveStartupMessage() — returns a calm tSafe envelope
 *       per spec §14 (no "Camera is taking a moment" / no panic).
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback}` envelope.
 *   • Idempotent install.
 */

import {
  validateStream, getRuntimeSnapshot, getActiveStream,
} from './cameraRuntimeManager.js';

const ENGINE_VERSION = 'camera-health-v1';

export const PERMISSION_STATE = Object.freeze({
  GRANTED:     'granted',
  DENIED:      'denied',
  PROMPT:      'prompt',
  BLOCKED:     'blocked',
  UNAVAILABLE: 'unavailable',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── Permission state ────────────────────────────────────────

export async function probeCameraPermissionState() {
  return _safe(async () => {
    if (typeof navigator === 'undefined' || !navigator.permissions
        || typeof navigator.permissions.query !== 'function') {
      // Could still be working — getUserMedia may exist without
      // the permissions query API. UNAVAILABLE = "unknown".
      return Object.freeze({
        state: PERMISSION_STATE.UNAVAILABLE,
        supported: false,
        canAutoInit: false,
      });
    }
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      const raw = result && typeof result.state === 'string' ? result.state : 'unknown';
      let state;
      switch (raw) {
        case 'granted': state = PERMISSION_STATE.GRANTED; break;
        case 'denied':  state = PERMISSION_STATE.DENIED;  break;
        case 'prompt':  state = PERMISSION_STATE.PROMPT;  break;
        default:        state = PERMISSION_STATE.UNAVAILABLE;
      }
      return Object.freeze({
        state,
        supported:   true,
        canAutoInit: state === PERMISSION_STATE.GRANTED,
      });
    } catch {
      return Object.freeze({
        state: PERMISSION_STATE.UNAVAILABLE,
        supported: false,
        canAutoInit: false,
      });
    }
  }, Object.freeze({
    state: PERMISSION_STATE.UNAVAILABLE,
    supported: false, canAutoInit: false,
  }));
}

// ─── Health probe ────────────────────────────────────────────

export function probeCameraHealth(input) {
  return _safe(() => {
    const o = _isObj(input) ? input : {};
    const videoEl = _isObj(o.videoEl) ? o.videoEl : null;
    const stream = getActiveStream();
    const probe = validateStream();

    const tracksActive = !!(probe.valid && (probe.trackCount || 0) > 0);
    const videoReady = !!(videoEl
      && typeof videoEl.videoWidth === 'number'
      && videoEl.videoWidth > 0
      && typeof videoEl.videoHeight === 'number'
      && videoEl.videoHeight > 0);

    return Object.freeze({
      engineVersion:   ENGINE_VERSION,
      healthy:         probe.valid && (!videoEl || videoReady),
      reason:          probe.valid ? null : probe.reason,
      streamActive:    !!stream,
      tracksActive,
      videoReady:      videoEl ? videoReady : null,
      permissionState: null, // populated by probeCameraPermissionState (async)
      generatedAt:     Date.now(),
    });
  }, Object.freeze({
    engineVersion: ENGINE_VERSION,
    healthy: false, reason: 'probe_error',
    streamActive: false, tracksActive: false, videoReady: null,
    permissionState: null, generatedAt: Date.now(),
  }));
}

// ─── Startup messaging (spec §14) ────────────────────────────

/**
 * Returns the calm tSafe envelope for the current camera state.
 * Replaces "Camera is taking a moment" wording with operational
 * copy. Surfaces render this string instead of inventing their own.
 */
export function resolveStartupMessage(input) {
  return _safe(() => {
    const o = _isObj(input) ? input : {};
    const state = typeof o.state === 'string' ? o.state : '';
    const recovering = !!o.recovering;
    if (recovering) {
      return Object.freeze({
        key:      'camera.startup.recovering',
        fallback: 'Recovering camera',
      });
    }
    switch (state) {
      case 'starting':
        return Object.freeze({
          key:      'camera.startup.preparing',
          fallback: 'Preparing camera',
        });
      case 'failed':
        return Object.freeze({
          key:      'camera.startup.uploadFallback',
          fallback: 'You can also upload a photo',
        });
      case 'recovering':
        return Object.freeze({
          key:      'camera.startup.recovering',
          fallback: 'Recovering camera',
        });
      case 'active':
        return Object.freeze({
          key:      'camera.startup.ready',
          fallback: 'Camera ready',
        });
      case 'idle':
      case 'stopped':
      default:
        return Object.freeze({
          key:      'camera.startup.preparing',
          fallback: 'Preparing camera',
        });
    }
  }, Object.freeze({
    key:      'camera.startup.preparing',
    fallback: 'Preparing camera',
  }));
}

// ─── Diagnostics ─────────────────────────────────────────────

let _installed = false;

export function installCameraDiagnostics() {
  return _safe(() => {
    if (_installed) return true;
    if (typeof window === 'undefined') return false;
    if (!window.__cameraHealth) {
      window.__cameraHealth = async function () {
        const health = probeCameraHealth({});
        const perm = await probeCameraPermissionState();
        const runtime = getRuntimeSnapshot();
        const snap = {
          streamActive:           runtime.streamActive,
          tracksActive:           health.tracksActive,
          permissionState:        perm.state,
          recoveryTriggered:      runtime.recoveryCount > 0,
          recoveryCount:          runtime.recoveryCount,
          lastRecoveryReason:     runtime.lastRecoveryReason,
          videoReady:             health.videoReady,
          memorySafe:             true, // surfaces flip this if they
                                        // observe a forced release
          uploadFallbackReady:    true, // cameraFallbackEngine present
          scanContinuityHealthy:  health.healthy,
          state:                  runtime.state,
          generatedAt:            new Date().toISOString(),
        };
        try { console.log('[Farroway · Camera Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    _installed = true;
    return true;
  }, false);
}

/** Test-only reset. */
export function _resetCameraDiagnosticsForTests() {
  _installed = false;
}

export const _internal = Object.freeze({ ENGINE_VERSION });

const _module = {
  PERMISSION_STATE,
  probeCameraHealth, probeCameraPermissionState,
  resolveStartupMessage, installCameraDiagnostics,
  _resetCameraDiagnosticsForTests, _internal,
};
export default _module;
