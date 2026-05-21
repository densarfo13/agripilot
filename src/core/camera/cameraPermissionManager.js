/**
 * cameraPermissionManager.js — pure permission state machine + the
 * recovery rules for iPhone Safari / Android camera flows.
 *
 *   import { CAMERA_PERMISSION, nextPermissionState, canRetry,
 *            detectPlatform, settingsGuidance, isGalleryAvailable,
 *            CAMERA_PURPOSE, recordCameraObservation, CAMERA_OBS }
 *     from 'src/core/camera/cameraPermissionManager.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure, never-throws state machine + a small set of helpers
 *   the existing camera flow can adopt to STOP three production
 *   bugs:
 *
 *     • infinite retry loops (we never auto-retry more than once),
 *     • dead-ends after "Camera denied" (gallery is ALWAYS open),
 *     • cryptic settings advice (per-platform fallback text).
 *
 *   It does NOT call `navigator.mediaDevices`, NOT render anything,
 *   and NOT replace the existing camera capture code. The existing
 *   camera surface adopts these rules at its own pace.
 *
 * Strict-rule audit
 *   • Pure functions. Never throws. SSR-safe (no DOM reads).
 *   • Observability emit is fully wrapped — analytics never affects
 *     the camera path.
 */

import { recordObservation, OBSERVABILITY } from '../observability/observabilityTracker.js';

// ── Permission state machine ──────────────────────────────────
export const CAMERA_PERMISSION = Object.freeze({
  UNKNOWN:    'unknown',
  REQUESTING: 'requesting',
  GRANTED:    'granted',
  DENIED:     'denied',
  BLOCKED:    'blocked',    // user said never-ask-again / OS-level block
  RETRYING:   'retrying',
});

// Allowed transitions. Anything not listed is a no-op — we stay
// in the current state so a stray signal never breaks the flow.
const TRANSITIONS = Object.freeze({
  unknown:    [CAMERA_PERMISSION.REQUESTING, CAMERA_PERMISSION.GRANTED, CAMERA_PERMISSION.DENIED, CAMERA_PERMISSION.BLOCKED],
  requesting: [CAMERA_PERMISSION.GRANTED, CAMERA_PERMISSION.DENIED, CAMERA_PERMISSION.BLOCKED],
  granted:    [CAMERA_PERMISSION.UNKNOWN, CAMERA_PERMISSION.REQUESTING], // permission can be revoked → reset
  denied:     [CAMERA_PERMISSION.RETRYING, CAMERA_PERMISSION.BLOCKED, CAMERA_PERMISSION.GRANTED],
  retrying:   [CAMERA_PERMISSION.GRANTED, CAMERA_PERMISSION.DENIED, CAMERA_PERMISSION.BLOCKED],
  blocked:    [CAMERA_PERMISSION.UNKNOWN], // only an external action (Settings → Allow) can recover
});

/**
 * Advance the permission state machine. Invalid transitions are a
 * no-op (return the current state) so the UI never crashes on a
 * stray browser signal.
 *
 * @param {string} current
 * @param {string} next
 * @returns {string}
 */
export function nextPermissionState(current, next) {
  try {
    const cur = String(current || CAMERA_PERMISSION.UNKNOWN);
    const nxt = String(next || '');
    const allowed = TRANSITIONS[cur];
    if (allowed && allowed.includes(nxt)) return nxt;
    return cur;
  } catch {
    return CAMERA_PERMISSION.UNKNOWN;
  }
}

/**
 * Whether a retry is allowed right now. The rule: we retry AT
 * MOST once after a `denied` state, then escalate to `blocked` so
 * the UI shifts to "Open Settings / Use saved photo" instead of
 * looping prompts.
 *
 * @param {string} state
 * @param {number} retryCount
 * @returns {boolean}
 */
export function canRetry(state, retryCount) {
  try {
    if (state !== CAMERA_PERMISSION.DENIED) return false;
    const n = Number(retryCount);
    if (!Number.isFinite(n)) return false;
    return n < 1;
  } catch {
    return false;
  }
}

// ── Platform detection (string-only) ──────────────────────────
export const PLATFORM = Object.freeze({
  IOS:     'ios',
  ANDROID: 'android',
  DESKTOP: 'desktop',
  UNKNOWN: 'unknown',
});

/**
 * Detect the platform from a userAgent string. Pure; takes the UA
 * as input so it stays SSR-safe + testable.
 *
 * @param {string} userAgent
 * @returns {string}
 */
export function detectPlatform(userAgent) {
  try {
    const ua = String(userAgent || '').toLowerCase();
    if (!ua) return PLATFORM.UNKNOWN;
    // iOS check first — iPad on iOS 13+ also reports "Macintosh".
    if (/iphone|ipad|ipod/.test(ua)) return PLATFORM.IOS;
    if (/macintosh/.test(ua) && /touch|mobile/.test(ua)) return PLATFORM.IOS;
    if (/android/.test(ua)) return PLATFORM.ANDROID;
    if (/windows|macintosh|linux/.test(ua)) return PLATFORM.DESKTOP;
    return PLATFORM.UNKNOWN;
  } catch {
    return PLATFORM.UNKNOWN;
  }
}

// ── Recovery guidance (localised) ─────────────────────────────
const GUIDANCE = Object.freeze({
  ios: {
    key:      'camera.settings.ios',
    fallback: 'On iPhone: open Settings → Safari → Camera → Allow. Then come back and tap Retry.',
  },
  android: {
    key:      'camera.settings.android',
    fallback: 'On Android: open the site settings (lock icon) → Permissions → Camera → Allow. Then tap Retry.',
  },
  desktop: {
    key:      'camera.settings.desktop',
    fallback: 'In your browser, open the site permissions (lock icon) → Camera → Allow. Then tap Retry.',
  },
  unknown: {
    key:      'camera.settings.generic',
    fallback: 'Enable the camera in your browser or device settings, then tap Retry.',
  },
});

/**
 * Per-platform "Open Settings" guidance — a translation key + an
 * English fallback. Caller localises via tSafe.
 */
export function settingsGuidance(platform) {
  const p = String(platform || '').toLowerCase();
  return GUIDANCE[p] || GUIDANCE.unknown;
}

// ── Camera education ─────────────────────────────────────────
/**
 * Short, calm copy explaining WHY we need the camera. Localised
 * as a key + fallback so the prompt screen never shows a raw key.
 */
export const CAMERA_PURPOSE = Object.freeze({
  key:      'camera.purpose',
  fallback: 'We use the camera to analyse your crop or plant. Photos stay on your device.',
});

// ── Gallery is always available ──────────────────────────────
/**
 * Gallery upload must remain usable regardless of camera state.
 * This helper is intentionally trivial — it documents the rule
 * AND lets the surface code branch on `isGalleryAvailable(state)`
 * without sprinkling the constant `true` everywhere.
 *
 * @param {string} _state ignored — gallery is always open
 * @returns {true}
 */
export function isGalleryAvailable(_state) {
  return true;
}

// ── Observability ────────────────────────────────────────────
export const CAMERA_OBS = Object.freeze({
  PERMISSION_DENIED:        'permission_denied',
  PERMISSION_BLOCKED:       'permission_blocked',
  RETRY_SUCCESS:            'retry_success',
  GALLERY_FALLBACK_USED:    'gallery_fallback_used',
  SETTINGS_OPENED:          'settings_opened',
  CAMERA_RECOVERY_SUCCESS:  'camera_recovery_success',
});

const _EVENT_TO_CATEGORY = Object.freeze({
  [CAMERA_OBS.PERMISSION_DENIED]:       OBSERVABILITY.SCAN_FAILURE,
  [CAMERA_OBS.PERMISSION_BLOCKED]:      OBSERVABILITY.SCAN_FAILURE,
  [CAMERA_OBS.RETRY_SUCCESS]:           null, // counter only
  [CAMERA_OBS.GALLERY_FALLBACK_USED]:   null,
  [CAMERA_OBS.SETTINGS_OPENED]:         null,
  [CAMERA_OBS.CAMERA_RECOVERY_SUCCESS]: null,
});

const _cameraCounts = {};

/**
 * Record a camera-flow event. Never throws — observability is
 * never load-bearing on the camera path.
 *
 * @param {string} event one of CAMERA_OBS
 * @returns {boolean}
 */
export function recordCameraObservation(event) {
  try {
    if (!event) return false;
    _cameraCounts[event] = (_cameraCounts[event] || 0) + 1;
    const category = _EVENT_TO_CATEGORY[event];
    if (category) {
      try { recordObservation(category); } catch { /* ignore */ }
    }
    return true;
  } catch {
    return false;
  }
}

/** Read-only snapshot of in-memory camera-flow counters. */
export function getCameraObservationCounts() {
  return { ..._cameraCounts };
}

/** Reset the in-memory camera counters (test hook). */
export function resetCameraObservationCounts() {
  for (const k of Object.keys(_cameraCounts)) delete _cameraCounts[k];
}

const _module = {
  CAMERA_PERMISSION, PLATFORM, CAMERA_PURPOSE, CAMERA_OBS,
  nextPermissionState, canRetry, detectPlatform, settingsGuidance,
  isGalleryAvailable,
  recordCameraObservation, getCameraObservationCounts, resetCameraObservationCounts,
};
export default _module;
