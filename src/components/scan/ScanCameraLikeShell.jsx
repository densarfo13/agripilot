/**
 * ScanCameraLikeShell — Option 3: the mobile /scan idle surface,
 * re-skinned to LOOK like a full-screen iPhone-style camera scanner
 * WITHOUT reversing any safe-shell protection.
 *
 *   <ScanCameraLikeShell
 *     onTakePhoto={...}     // gesture-gated — opens the real camera
 *     onUploadPhoto={...}   // opens the gallery picker immediately
 *     onClose={...}         // → /home
 *   />
 *
 * What this is — and is NOT
 * ─────────────────────────
 *   • It is PRESENTATIONAL ONLY. It NEVER calls getUserMedia, never
 *     imports ScanRuntime, never starts a camera. The viewport is a
 *     styled placeholder ("Ready to scan") until the user taps Take
 *     Photo — at which point the PARENT (ScanPage) flips to the
 *     capture phase and mounts the real LiveCameraScanner. So there
 *     is NO startup permission race and NO autostart on route load.
 *   • Upload / Gallery is ALWAYS available and never gated on camera.
 *   • No full-screen spinner. No "Camera ran into a problem". The
 *     surface is usable from the first frame.
 *
 * It is the camera-LOOK of the safe shell, not a camera.
 *
 * Strict-rule audit
 *   • Inline styles only. SSR-safe. Never throws.
 *   • No getUserMedia / no MediaDevices / no ScanRuntime import.
 *   • Localized via tSafe with English fallbacks.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isFn = (v) => typeof v === 'function';

export default function ScanCameraLikeShell({
  onTakePhoto,
  onUploadPhoto,
  onClose,
  // Flip is only meaningful once a live stream is running. On the
  // idle shell there is no stream, so it is hidden by default. The
  // real flip control lives inside LiveCameraScanner (capture phase).
  streamRunning = false,
}) {
  const goHome = () => {
    try {
      if (_isFn(onClose)) { onClose(); return; }
      if (typeof window !== 'undefined') window.location.assign('/home');
    } catch { /* swallow */ }
  };

  return (
    <main
      style={S.page}
      data-testid="scan-camera-like-shell"
      data-scan-default-mode="camera-like-idle"
    >
      {/* Top bar — Close */}
      <div style={S.topBar}>
        <button
          type="button"
          style={S.closeBtn}
          onClick={goHome}
          aria-label={tSafe('common.close', 'Close')}
          data-testid="scan-camera-like-close"
        >
          ✕
        </button>
        <span style={S.topTitle}>
          {tSafe('scan.cameraLike.title', 'Scan Your Plant')}
        </span>
        <span style={{ width: 40 }} aria-hidden="true" />
      </div>

      {/* Center — camera-style viewport (placeholder until Take Photo) */}
      <div style={S.viewportWrap}>
        <div style={S.viewport} data-testid="scan-camera-like-viewport">
          {/* Guide corners */}
          <span style={{ ...S.corner, ...S.cornerTL }} aria-hidden="true" />
          <span style={{ ...S.corner, ...S.cornerTR }} aria-hidden="true" />
          <span style={{ ...S.corner, ...S.cornerBL }} aria-hidden="true" />
          <span style={{ ...S.corner, ...S.cornerBR }} aria-hidden="true" />

          <div style={S.viewportCenter}>
            <div style={S.viewportEmoji} aria-hidden="true">🌿</div>
            <p style={S.viewportReady}>
              {tSafe('scan.cameraLike.ready', 'Ready to scan')}
            </p>
            <p style={S.viewportHint}>
              {tSafe('scan.cameraLike.hint',
                'Tap Take Photo or upload from Gallery')}
            </p>
          </div>

          {/* Guidance pill */}
          <div style={S.pill} data-testid="scan-camera-like-guidance">
            {tSafe('scan.cameraLike.guide', 'Center crop or leaf')}
          </div>
        </div>
      </div>

      {/* Bottom controls — Gallery · Capture · Flip */}
      <div style={S.controls}>
        <button
          type="button"
          style={S.sideBtn}
          onClick={_isFn(onUploadPhoto) ? onUploadPhoto : undefined}
          disabled={!_isFn(onUploadPhoto)}
          data-testid="scan-camera-like-upload"
          aria-label={tSafe('scan.cameraLike.gallery', 'Upload from gallery')}
        >
          <span style={S.sideIcon} aria-hidden="true">🖼</span>
          <span style={S.sideLabel}>
            {tSafe('scan.cameraLike.galleryShort', 'Gallery')}
          </span>
        </button>

        <button
          type="button"
          style={S.shutter}
          onClick={_isFn(onTakePhoto) ? onTakePhoto : undefined}
          disabled={!_isFn(onTakePhoto)}
          data-testid="scan-camera-like-take-photo"
          aria-label={tSafe('scan.cameraLike.takePhoto', 'Take photo')}
        >
          <span style={S.shutterInner} aria-hidden="true" />
        </button>

        {/* Flip is intentionally NOT rendered on the idle shell:
            there is no live stream yet, so a flip control would be a
            no-op (dead click). The real Flip lives inside
            LiveCameraScanner once the user taps Take Photo and the
            capture phase mounts the camera. We keep a spacer so the
            shutter stays centred. (`streamRunning` is reserved for a
            future in-shell live preview.) */}
        <span style={{ width: 64 }} aria-hidden="true" data-camera-like-flip-slot={String(!!streamRunning)} />
      </div>

      <p style={S.takeHint}>
        {tSafe('scan.cameraLike.takeHint',
          'Camera opens only when you tap Take Photo.')}
      </p>
    </main>
  );
}

const S = {
  page: {
    position: 'fixed', inset: 0,
    background: '#0B0F14', color: '#FFFFFF',
    display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 50,
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px',
  },
  closeBtn: {
    appearance: 'none', border: 'none',
    width: 40, height: 40, borderRadius: 20,
    background: 'rgba(255,255,255,0.12)', color: '#FFFFFF',
    fontSize: 18, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  topTitle: { fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.92)' },
  viewportWrap: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px 16px',
  },
  viewport: {
    position: 'relative', width: '100%', maxWidth: 460,
    aspectRatio: '3 / 4',
    background: 'radial-gradient(120% 100% at 50% 30%, #14202B 0%, #0B0F14 100%)',
    borderRadius: 28,
    border: '1px solid rgba(255,255,255,0.08)',
    overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  corner: {
    position: 'absolute', width: 34, height: 34,
    borderColor: 'rgba(255,255,255,0.65)', borderStyle: 'solid', borderWidth: 0,
  },
  cornerTL: { top: 18, left: 18, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  cornerTR: { top: 18, right: 18, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  cornerBL: { bottom: 18, left: 18, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 18, right: 18, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  viewportCenter: { textAlign: 'center', padding: '0 24px' },
  viewportEmoji: { fontSize: 46, lineHeight: 1, marginBottom: 12 },
  viewportReady: { margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#FFFFFF' },
  viewportHint: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 },
  pill: {
    position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.55)', color: '#FFFFFF',
    fontSize: 12, fontWeight: 600,
    padding: '6px 14px', borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)', whiteSpace: 'nowrap',
  },
  controls: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    padding: '14px 24px 8px',
  },
  sideBtn: {
    appearance: 'none', border: 'none', background: 'transparent',
    color: '#FFFFFF', cursor: 'pointer', width: 64,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    fontFamily: 'inherit',
  },
  sideIcon: { fontSize: 26, lineHeight: 1 },
  sideLabel: { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.72)' },
  shutter: {
    appearance: 'none', cursor: 'pointer',
    width: 78, height: 78, borderRadius: '50%',
    background: 'transparent',
    border: '4px solid rgba(255,255,255,0.92)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
  },
  shutterInner: {
    width: 60, height: 60, borderRadius: '50%',
    background: '#FFFFFF',
    boxShadow: '0 0 0 2px #0B0F14 inset',
  },
  takeHint: {
    margin: 0, padding: '0 24px 14px', textAlign: 'center',
    fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 1.4,
  },
};
