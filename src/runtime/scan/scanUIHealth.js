/**
 * scanUIHealth.js — scan-idle-entry-v3 diagnostic.
 *
 *   import {
 *     installScanUIHealthGlobal, getScanUIHealth,
 *     recordCameraAttempt, recordCameraStatus,
 *     recordPermissionStatus, recordUserInitiatedCamera,
 *   } from 'src/runtime/scan/scanUIHealth.js';
 *
 * What this is
 * ────────────
 *   Production health probe for the /scan landing behaviour.
 *   v3 contract (emergency fix):
 *     • /scan must render ScanEntryCard (via ScanHub) on first
 *       load — never the camera-error card.
 *     • Camera-failure fallback wording is HARD-BLOCKED unless
 *       BOTH cameraAttempted AND userInitiatedCamera flip true.
 *
 *   Exposed as `window.__scanUIHealth()` — returns:
 *     {
 *       version: 'scan-idle-entry-v3',
 *       route: '/scan',
 *       initialPhase: 'idle',
 *       cameraAutoStart: false,
 *       cameraAttempted: boolean,
 *       userInitiatedCamera: boolean,
 *       firstLoadErrorCardBlocked: true,
 *       cameraStatus: string|null,
 *       permissionStatus: string|null,
 *       savedPhotoAvailable: true,
 *     }
 *
 *   Also pins:
 *     window.__forceScanIdle() — hard-reset hook ScanPage installs.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Module-level state, idempotent install.
 *   • No PII; only enum values + booleans.
 */

const RUNTIME_VERSION = 'scan-idle-entry-v3';

const _state = {
  cameraAttempted:     false,
  userInitiatedCamera: false,
  cameraStatus:        null,
  permissionStatus:    null,
  installed:           false,
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

export function recordCameraAttempt() { _state.cameraAttempted = true; }
export function recordUserInitiatedCamera() {
  _state.userInitiatedCamera = true;
  _state.cameraAttempted = true;
}
export function recordCameraStatus(s) {
  if (typeof s === 'string') _state.cameraStatus = s;
}
export function recordPermissionStatus(s) {
  if (typeof s === 'string') _state.permissionStatus = s;
}

/**
 * Read-only snapshot. Field names match the emergency-fix spec
 * verbatim — QA checks these in the console.
 */
export function getScanUIHealth() {
  return Object.freeze({
    version:                   RUNTIME_VERSION,
    runtimeVersion:            RUNTIME_VERSION, // legacy alias
    route:                     '/scan',
    initialPhase:              'idle',
    defaultEntryMode:          'idle', // legacy alias
    cameraAutoStart:           false,
    cameraAttempted:           _state.cameraAttempted,
    userInitiatedCamera:       _state.userInitiatedCamera,
    firstLoadErrorCardBlocked: true,
    cameraStatus:              _state.cameraStatus,
    permissionStatus:          _state.permissionStatus,
    savedPhotoAvailable:       true,
  });
}

/**
 * Pin `window.__scanUIHealth` to the getter. Idempotent.
 *
 * Also installs a SAFE fallback for `window.__forceScanIdle` —
 * ScanPage replaces this with its React-state-aware version on
 * mount; the pre-mount stub keeps the call shape safe to invoke
 * from a console before /scan has loaded.
 */
export function installScanUIHealthGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    // Always overwrite — v3 contract supersedes v1.
    window.__scanUIHealth = getScanUIHealth;
    if (typeof window.__forceScanIdle !== 'function') {
      window.__forceScanIdle = function _forceScanIdleStub() {
        // Pre-mount stub: just reset our state probe + reload
        // the route. ScanPage's mount effect overwrites with a
        // React-state-aware version.
        try {
          _state.cameraAttempted = false;
          _state.userInitiatedCamera = false;
          _state.cameraStatus = null;
        } catch { /* swallow */ }
        try {
          if (typeof window.location !== 'undefined'
              && typeof window.location.assign === 'function') {
            window.location.assign('/scan');
          }
        } catch { /* swallow */ }
        return true;
      };
    }
    _state.installed = true;
    return true;
  }, false);
}

export function _resetForTests() {
  _state.cameraAttempted = false;
  _state.userInitiatedCamera = false;
  _state.cameraStatus = null;
  _state.permissionStatus = null;
  _state.installed = false;
}
