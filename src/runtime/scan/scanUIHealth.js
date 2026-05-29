/**
 * scanUIHealth.js — RC1 scan-UI health diagnostic.
 *
 *   import {
 *     installScanUIHealthGlobal, getScanUIHealth,
 *     recordCameraAttempt, recordCameraStatus,
 *     recordPermissionStatus,
 *   } from 'src/runtime/scan/scanUIHealth.js';
 *
 * What this is
 * ────────────
 *   Surface-side health probe specifically for the /scan landing
 *   behaviour. After RC1 the scan page must NOT auto-start the
 *   camera on mount; this diagnostic surfaces the current entry-
 *   mode + camera attempt state so QA can verify on-device that
 *   no eager getUserMedia call fires.
 *
 *   Exposed as `window.__scanUIHealth()` — returns:
 *     {
 *       route: '/scan',
 *       defaultEntryMode: 'idle',
 *       cameraAutoStart: false,         // constant — RC1 contract
 *       cameraAttempted: boolean,       // true after user gesture
 *       cameraStatus: string|null,      // 'idle'|'opening'|'error'|...
 *       permissionStatus: string|null,  // 'unknown'|'granted'|'denied'|...
 *       savedPhotoAvailable: true,
 *     }
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Module-level state, idempotent install.
 *   • No PII; only enum values + booleans.
 */

const RUNTIME_VERSION = 'scan-ui-health-v1';

const _state = {
  cameraAttempted:  false,
  cameraStatus:     null,
  permissionStatus: null,
  installed:        false,
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

export function recordCameraAttempt() { _state.cameraAttempted = true; }
export function recordCameraStatus(s) {
  if (typeof s === 'string') _state.cameraStatus = s;
}
export function recordPermissionStatus(s) {
  if (typeof s === 'string') _state.permissionStatus = s;
}

/**
 * Read-only snapshot.
 */
export function getScanUIHealth() {
  return Object.freeze({
    runtimeVersion:    RUNTIME_VERSION,
    route:             '/scan',
    defaultEntryMode:  'idle',
    // Constant — RC1 contract. The check-scan-no-autostart CI
    // gate verifies the ScanPage source still defaults to 'idle'
    // and never auto-starts the camera; this field is the runtime
    // mirror of that contract.
    cameraAutoStart:   false,
    cameraAttempted:   _state.cameraAttempted,
    cameraStatus:      _state.cameraStatus,
    permissionStatus:  _state.permissionStatus,
    savedPhotoAvailable: true,
  });
}

/**
 * Pin `window.__scanUIHealth` to the getter. Idempotent.
 */
export function installScanUIHealthGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.__scanUIHealth === 'function') return true;
    window.__scanUIHealth = getScanUIHealth;
    _state.installed = true;
    return true;
  }, false);
}

export function _resetForTests() {
  _state.cameraAttempted = false;
  _state.cameraStatus = null;
  _state.permissionStatus = null;
  _state.installed = false;
}
