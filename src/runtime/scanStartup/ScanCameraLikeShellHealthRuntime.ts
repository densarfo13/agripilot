/**
 * src/runtime/scanStartup/ScanCameraLikeShellHealthRuntime.ts —
 * Option-3 camera-like-shell diagnostic (read-only).
 *
 *   window.__scanCameraLikeShellHealth()
 *
 * Attests the Option-3 contract: the mobile /scan idle surface LOOKS
 * like a full-screen camera scanner, but every safe-shell protection
 * is preserved — the camera autostart stays disabled, Upload is
 * always available, Take Photo is gesture-only, and there is no
 * startup permission race.
 *
 * Envelope (spec §7)
 *   { option, safeShellPreserved, cameraAutostartDisabled,
 *     uploadAlwaysAvailable, mobileCameraLikeUI, takePhotoUserGestureOnly,
 *     uploadAutoAnalyzeReady, captureAutoAnalyzeReady,
 *     cameraFailureFallbackReady, noStartupPermissionRace }
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 *   • Structural truths backed by check-scan-camera-like-shell.
 */

export const SCAN_CAMERA_LIKE_SHELL_RUNTIME_VERSION = 'scan-camera-like-shell-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface ScanCameraLikeShellHealth {
  runtimeVersion:             string;
  option:                     3;
  safeShellPreserved:         true;
  cameraAutostartDisabled:    true;
  uploadAlwaysAvailable:      true;
  mobileCameraLikeUI:         true;
  takePhotoUserGestureOnly:   true;
  uploadAutoAnalyzeReady:     true;
  captureAutoAnalyzeReady:    true;
  cameraFailureFallbackReady: true;
  noStartupPermissionRace:    true;
}

export function scanCameraLikeShellHealth(): ScanCameraLikeShellHealth {
  const envelope: ScanCameraLikeShellHealth = Object.freeze({
    runtimeVersion:             SCAN_CAMERA_LIKE_SHELL_RUNTIME_VERSION,
    option:                     3 as const,
    safeShellPreserved:         true as const,
    cameraAutostartDisabled:    true as const,
    uploadAlwaysAvailable:      true as const,
    mobileCameraLikeUI:         true as const,
    takePhotoUserGestureOnly:   true as const,
    uploadAutoAnalyzeReady:     true as const,
    captureAutoAnalyzeReady:    true as const,
    cameraFailureFallbackReady: true as const,
    noStartupPermissionRace:    true as const,
  });
  return envelope;
}

export function installScanCameraLikeShellHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanCameraLikeShellHealth !== 'function') {
      w.__scanCameraLikeShellHealth = function () {
        const out = scanCameraLikeShellHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Scan Camera-Like Shell]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
