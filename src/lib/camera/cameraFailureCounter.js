/**
 * cameraFailureCounter — in-session count of consecutive camera
 * start failures so the recovery UI can trigger the auto-fallback
 * path (highlight gallery upload) after 2 strikes.
 *
 *   import {
 *     recordCameraFailure, recordCameraSuccess,
 *     getCameraFailureCount, resetCameraFailureCounter,
 *   } from '../lib/camera/cameraFailureCounter.js';
 *
 *   const count = recordCameraFailure();
 *   if (count >= 2) {
 *     // surface "Scanning works with saved photos too."
 *   }
 *
 * Why this is a module-level counter
 *   A React state counter resets on unmount. Users who hit
 *   "Retry camera", get bounced back to the home page, and
 *   re-enter scan would otherwise see attemptCount reset to 0
 *   on every entry. The module-level singleton survives
 *   navigation (but NOT a full page reload — that's a
 *   deliberate session-scoped boundary).
 *
 * Strict-rule audit
 *   * Pure JS. Never throws. SSR-safe — the counter is held in
 *     a closure that does not touch the DOM or storage.
 *   * Resettable for tests + after a successful capture.
 */

export const AUTO_FALLBACK_THRESHOLD = 2;

let _count    = 0;
let _lastKind = null;

/** Record a camera-start failure. Returns the new count. */
export function recordCameraFailure(kind) {
  _count += 1;
  _lastKind = typeof kind === 'string' ? kind : null;
  return _count;
}

/** Record a successful camera-start. Clears the counter. */
export function recordCameraSuccess() {
  _count    = 0;
  _lastKind = null;
}

/** @returns {number} current consecutive failure count */
export function getCameraFailureCount() {
  return _count;
}

/** @returns {string|null} kind of the last recorded failure */
export function getLastCameraFailureKind() {
  return _lastKind;
}

/**
 * @returns {boolean} true when the recovery UI should promote
 *                    the gallery / saved-photo path. Resets on
 *                    success or explicit reset.
 */
export function shouldAutoFallback() {
  return _count >= AUTO_FALLBACK_THRESHOLD;
}

/** Test seam — reset back to zero. */
export function resetCameraFailureCounter() {
  _count    = 0;
  _lastKind = null;
}

const _module = {
  AUTO_FALLBACK_THRESHOLD,
  recordCameraFailure,
  recordCameraSuccess,
  getCameraFailureCount,
  getLastCameraFailureKind,
  shouldAutoFallback,
  resetCameraFailureCounter,
};
export default _module;
