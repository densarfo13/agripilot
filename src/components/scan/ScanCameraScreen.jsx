/**
 * src/components/scan/ScanCameraScreen.jsx — Spec-named alias
 * for the native-style camera capture surface.
 *
 *   <ScanCameraScreen
 *     onCaptured={...}
 *     onUpload={...}
 *     onCancel={...}
 *   />
 *
 * What this is
 * ────────────
 *   The canonical camera UI is `LiveCameraScanner` — it already
 *   ships the spec-required behaviors:
 *     • Full-screen dark surface
 *     • Top-left Close (X) button
 *     • Rounded camera viewport
 *     • "Center crop or leaf" helper pill
 *     • Bottom controls: Gallery · Shutter · Flip
 *     • Permission-denied / camera-failure fallback shows
 *       "Upload a photo instead" — NEVER the banned
 *       "Camera ran into a problem" wording.
 *
 *   This module is a thin re-export so consumers can import
 *   the spec-named component path. NO new render logic — the
 *   single source of truth stays `LiveCameraScanner`, audited
 *   by `scripts/check-no-grower-camera-error-card.mjs`.
 *
 * Strict-rule audit
 *   • Pure render delegation.
 *   • SSR-safe (LiveCameraScanner guards window access).
 *   • Never throws.
 *   • No camera ownership taken — CameraRuntimeManager + the
 *     existing ScanRuntime own start/stop / permission probes.
 */

export { default } from './LiveCameraScanner.jsx';
export { default as ScanCameraScreen } from './LiveCameraScanner.jsx';
