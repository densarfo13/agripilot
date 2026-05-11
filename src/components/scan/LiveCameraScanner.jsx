/**
 * LiveCameraScanner — full-screen native-camera-style overlay
 * that owns a real `getUserMedia` stream and hands the captured
 * frame back to its parent.
 *
 *   <LiveCameraScanner
 *     open={isOpen}
 *     facingHint="environment"
 *     onCancel={() => setOpen(false)}
 *     onCaptured={({ file, dataUrl }) => { ... }}
 *     onFallbackUpload={(file) => { ... }}
 *   />
 *
 * UX contract
 *   • `open=false` → component renders nothing AND the camera
 *     stream is fully released. Toggling `open` is the only
 *     stop-the-camera signal a parent needs to send.
 *   • Live `<video>` preview fills the viewport, anchored under
 *     a rounded viewport mask. Top controls: Close + Flash.
 *     Bottom row: Gallery, Capture, Switch.
 *   • After capture, the live stream is paused and the frozen
 *     dataURL is shown full-screen with Retake + Analyze.
 *   • Permission denied → an inline "Upload from gallery" panel
 *     keeps the flow alive without trapping the user.
 *
 * iPhone Safari behaviour notes
 *   • <video> needs `playsInline` to stay embedded (otherwise
 *     iOS hijacks into the system fullscreen player).
 *   • `getUserMedia` MUST be invoked from a user gesture on iOS,
 *     so we never auto-start the stream on mount when the user
 *     has not yet tapped "Open camera". The parent decides
 *     when to flip `open=true`.
 *   • The torch / flashlight constraint is Chromium-only; we
 *     hide the flash button on iOS Safari and on any track
 *     whose capabilities don't expose `torch`.
 *   • iOS Permissions API doesn't always reflect camera state —
 *     we treat the actual getUserMedia error as the source of
 *     truth and fall back to the upload panel on any failure.
 *
 * Strict-rule audit
 *   • One source of stream lifecycle (the open prop). All paths
 *     stop tracks + revoke ObjectURLs.
 *   • SSR-safe — every navigator/window access is guarded.
 *   • Pure presentational over the camera primitive — no router,
 *     no analytics, no localStorage. Parent owns side-effects.
 *   • No emoji. Lucide-style inline SVG icons throughout.
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { tSafe } from '../../i18n/tSafe.js';

const PREFERRED_CONSTRAINTS = (facing) => ({
  audio: false,
  video: {
    facingMode: { ideal: facing },
    width:  { ideal: 1920 },
    height: { ideal: 1080 },
  },
});

const MIN_CONSTRAINTS = (facing) => ({
  audio: false,
  video: { facingMode: facing },
});

function _isIos() {
  try {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.platform || '')
      || (navigator.userAgent && /iPad|iPhone|iPod/.test(navigator.userAgent))
      || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));
  } catch { return false; }
}

// ─── Icons (inline SVG, no emoji) ───────────────────────────────

function _CloseIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
    </svg>
  );
}
function _FlashIcon({ size = 22, on = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L5 14h6l-2 8 10-14h-6l2-6z"
            stroke="currentColor" strokeWidth="1.7"
            strokeLinejoin="round"
            fill={on ? 'currentColor' : 'none'}/>
    </svg>
  );
}
function _SwitchIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h12l-2 -2M20 17H8l2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.7" fill="none"/>
    </svg>
  );
}
function _GalleryIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" fill="none"/>
      <path d="M3 16l5-4 4 3 3-2 6 5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="none"/>
      <circle cx="8" cy="9.5" r="1.3" fill="currentColor"/>
    </svg>
  );
}
function _CheckIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4 10-10" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function _RetakeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 16-5.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M19 4v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M21 12a9 9 0 0 1-16 5.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M5 20v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

// ─── Component ─────────────────────────────────────────────────

export default function LiveCameraScanner({
  open,
  facingHint = 'environment',
  onCancel,
  onCaptured,
  onFallbackUpload,
  testId = 'live-camera-scanner',
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [facing, setFacing] = useState(facingHint || 'environment');
  const [phase, setPhase] = useState('idle');
  // Rotating guidance text — cycles through 3 tips on a 3.2s loop
  // so the camera feels like it's coaching the user without
  // adding click affordance. Pauses when the camera isn't
  // streaming.
  const [guideTipIdx, setGuideTipIdx] = useState(0);
  // Capture flash flag — flips true for 220ms when the user taps
  // the shutter so the viewport feels like a real camera body
  // taking a photograph. CSS-only, no JS animation timer.
  const [captureFlash, setCaptureFlash] = useState(false);
  // 'idle' | 'requesting' | 'streaming' | 'captured' | 'denied' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);

  const isIos = useMemo(_isIos, []);

  // ─── Stream lifecycle ──────────────────────────────────────

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    try {
      s.getTracks().forEach((t) => { try { t.stop(); } catch { /* swallow */ } });
    } catch { /* swallow */ }
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      try { v.srcObject = null; } catch { /* swallow */ }
    }
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  const startStream = useCallback(async (nextFacing) => {
    const facingToUse = nextFacing || facing;
    if (typeof navigator === 'undefined'
        || !navigator.mediaDevices
        || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setPhase('denied');
      setErrorMsg(tSafe(
        'scan.camera.notSupported',
        'Camera is not available in this browser. Upload a photo instead.',
      ));
      return;
    }
    setPhase('requesting');
    setErrorMsg('');
    stopStream();
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(PREFERRED_CONSTRAINTS(facingToUse));
    } catch (e1) {
      // Re-try with the lenient constraints. Some Android browsers
      // reject the ideal-resolution hints; the bare facingMode
      // call usually succeeds.
      try {
        stream = await navigator.mediaDevices.getUserMedia(MIN_CONSTRAINTS(facingToUse));
      } catch (e2) {
        const denied = (e2 && (e2.name === 'NotAllowedError' || e2.name === 'SecurityError'))
                    || (e1 && (e1.name === 'NotAllowedError' || e1.name === 'SecurityError'));
        setPhase(denied ? 'denied' : 'error');
        setErrorMsg(
          denied
            ? tSafe(
                'scan.camera.denied',
                'Camera access was denied. Tap "Use a saved photo" to continue.',
              )
            : tSafe(
                'scan.camera.failed',
                "Couldn't open the camera. Tap retry or upload a photo.",
              ),
        );
        return;
      }
    }
    streamRef.current = stream;
    const v = videoRef.current;
    if (v) {
      try {
        v.srcObject = stream;
        // iOS Safari needs the explicit play() with a Promise so
        // we can await — the muted + playsInline attrs let it run
        // without user-gesture once a stream is attached.
        const p = v.play();
        if (p && typeof p.then === 'function') {
          await p.catch(() => { /* autoplay-blocked: leave UI to recover */ });
        }
      } catch { /* swallow */ }
    }
    // Probe torch capability + camera count for the switch button.
    try {
      const track = stream.getVideoTracks()[0];
      const caps = (track && typeof track.getCapabilities === 'function')
        ? track.getCapabilities() : null;
      setHasTorch(!!(caps && caps.torch));
    } catch { setHasTorch(false); }
    try {
      const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const cams = devs.filter((d) => d.kind === 'videoinput');
      setCanSwitch(cams.length > 1);
    } catch { setCanSwitch(false); }
    setPhase('streaming');
  }, [facing, stopStream]);

  // Open / close gating.
  useEffect(() => {
    if (!open) {
      stopStream();
      // Reset captured state so a re-open shows the live preview,
      // not the previously frozen frame.
      if (capturedUrl) {
        try { URL.revokeObjectURL(capturedUrl); } catch { /* swallow */ }
      }
      setCapturedUrl(null);
      setCapturedFile(null);
      setPhase('idle');
      setErrorMsg('');
      setTorchOn(false);
      return undefined;
    }
    // open=true: kick off the stream.
    startStream(facing);
    // Cleanup on every open→close transition AND on unmount.
    return () => { stopStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Page Visibility — if the tab is hidden, release the camera so
  // the OS indicator doesn't stay lit. We re-acquire on return.
  useEffect(() => {
    if (!open) return undefined;
    function onVis() {
      try {
        if (document.visibilityState === 'hidden') {
          stopStream();
        } else if (phase !== 'captured') {
          startStream(facing);
        }
      } catch { /* swallow */ }
    }
    try { document.addEventListener('visibilitychange', onVis); } catch { /* swallow */ }
    return () => {
      try { document.removeEventListener('visibilitychange', onVis); } catch { /* swallow */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, facing]);

  // Body-scroll lock while the camera is open.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { try { document.body.style.overflow = prev; } catch { /* swallow */ } };
  }, [open]);

  // Rotating live guidance text — three tips cycle on a 3.2s
  // loop while the camera is streaming. Reset to the first tip
  // when the camera opens / re-streams so each capture session
  // starts with "Place leaf or crop inside the frame".
  useEffect(() => {
    if (phase !== 'streaming') { setGuideTipIdx(0); return undefined; }
    const id = setInterval(() => {
      setGuideTipIdx((i) => (i + 1) % 3);
    }, 3200);
    return () => { try { clearInterval(id); } catch { /* swallow */ } };
  }, [phase]);

  // ─── Actions ───────────────────────────────────────────────

  const toggleTorch = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream) return;
    try {
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      const nextOn = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: nextOn }] });
      setTorchOn(nextOn);
    } catch {
      // Torch unsupported on this hardware / browser. Hide the
      // button so the user doesn't tap it again.
      setHasTorch(false);
    }
  }, [torchOn]);

  const switchCamera = useCallback(async () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    await startStream(next);
  }, [facing, startStream]);

  const captureFrame = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    // Flash the viewport for ~220ms so the capture feels like a
    // real camera shutter. The flag clears via setTimeout so the
    // overlay never sticks if the capture path bails out.
    setCaptureFlash(true);
    try {
      setTimeout(() => { try { setCaptureFlash(false); } catch { /* swallow */ } }, 220);
    } catch { /* swallow */ }
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(v, 0, 0, w, h);
    } catch { return; }
    // Prefer a Blob → File so the existing pipeline (which expects
    // a File) keeps working. Fall back to dataURL if the Blob
    // path throws (older Safari sometimes does).
    let file = null;
    let dataUrl = '';
    try {
      const blob = await new Promise((res, rej) => {
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error('toBlob returned null'))),
          'image/jpeg',
          0.92,
        );
      });
      dataUrl = URL.createObjectURL(blob);
      file = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
    } catch {
      try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        // Best-effort File from the dataURL.
        const bin = atob(dataUrl.split(',')[1] || '');
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: 'image/jpeg' });
        file = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
      } catch { /* swallow */ }
    }
    if (!file && !dataUrl) return;
    // Free the live stream while the user reviews — keeping the
    // camera lit during preview wastes battery + leaves the OS
    // indicator on for no benefit.
    stopStream();
    setCapturedFile(file);
    setCapturedUrl(dataUrl);
    setPhase('captured');
  }, [stopStream]);

  const retake = useCallback(() => {
    if (capturedUrl) {
      try { URL.revokeObjectURL(capturedUrl); } catch { /* swallow */ }
    }
    setCapturedFile(null);
    setCapturedUrl(null);
    startStream(facing);
  }, [capturedUrl, facing, startStream]);

  const acceptCaptured = useCallback(() => {
    if (!capturedFile && !capturedUrl) return;
    try { onCaptured && onCaptured({ file: capturedFile, dataUrl: capturedUrl }); }
    catch { /* never propagate */ }
  }, [capturedFile, capturedUrl, onCaptured]);

  const close = useCallback(() => {
    stopStream();
    if (capturedUrl) {
      try { URL.revokeObjectURL(capturedUrl); } catch { /* swallow */ }
    }
    setCapturedUrl(null);
    setCapturedFile(null);
    try { onCancel && onCancel(); } catch { /* swallow */ }
  }, [capturedUrl, onCancel, stopStream]);

  const pickFromGallery = useCallback(() => {
    try { fileInputRef.current?.click(); } catch { /* swallow */ }
  }, []);

  const onFileInputChange = useCallback((ev) => {
    const f = ev?.target?.files?.[0];
    if (!f) return;
    stopStream();
    try { onFallbackUpload && onFallbackUpload(f); } catch { /* swallow */ }
  }, [onFallbackUpload, stopStream]);

  // ─── Render ────────────────────────────────────────────────

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const showFlash  = hasTorch && !isIos && phase === 'streaming';
  const showSwitch = canSwitch && phase === 'streaming';

  return createPortal(
    <div
      style={S.root}
      data-testid={testId}
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={tSafe('scan.camera.title', 'Scanner camera')}
    >
      {/* ─── Top control bar ────────────────────────────────── */}
      <div style={S.topBar}>
        <button
          type="button"
          onClick={close}
          style={S.iconBtn}
          aria-label={tSafe('common.close', 'Close')}
          data-testid={`${testId}-close`}
        >
          <_CloseIcon />
        </button>
        {showFlash && (
          <button
            type="button"
            onClick={toggleTorch}
            style={{ ...S.iconBtn, ...(torchOn ? S.iconBtnOn : null) }}
            aria-label={tSafe('scan.camera.flash', 'Toggle flash')}
            aria-pressed={torchOn ? 'true' : 'false'}
            data-testid={`${testId}-flash`}
          >
            <_FlashIcon on={torchOn} />
          </button>
        )}
      </div>

      {/* ─── Camera viewport ────────────────────────────────── */}
      <div style={S.viewport} data-testid={`${testId}-viewport`}>
        {phase === 'streaming' || phase === 'requesting' ? (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={S.video}
            data-testid={`${testId}-video`}
          />
        ) : null}

        {phase === 'captured' && capturedUrl ? (
          <img
            src={capturedUrl}
            alt=""
            style={S.video}
            data-testid={`${testId}-captured`}
          />
        ) : null}

        {/* Frame guide + animated scan line — only visible while
            live-streaming. The scan line sweeps top-to-bottom on
            a 2.4s loop, CSS-driven (no JS timer), and gives the
            viewfinder a "scanning" feel without claiming AI is
            doing anything before the user actually captures. */}
        {phase === 'streaming' && (
          <>
            <div style={S.guideFrame} aria-hidden="true">
              {/* Soft ochre glow ring around the frame */}
              <span style={S.guideGlow} />
              {/* Animated sweep line */}
              <span style={S.scanLine} />
              <span style={{ ...S.guideCorner, top: -2,    left: -2,
                              borderTop:  '3px solid #E6BC85',
                              borderLeft: '3px solid #E6BC85' }}/>
              <span style={{ ...S.guideCorner, top: -2,    right: -2,
                              borderTop:   '3px solid #E6BC85',
                              borderRight: '3px solid #E6BC85' }}/>
              <span style={{ ...S.guideCorner, bottom: -2, left: -2,
                              borderBottom: '3px solid #E6BC85',
                              borderLeft:   '3px solid #E6BC85' }}/>
              <span style={{ ...S.guideCorner, bottom: -2, right: -2,
                              borderBottom: '3px solid #E6BC85',
                              borderRight:  '3px solid #E6BC85' }}/>
            </div>
            {/* Live coaching text — rotates through three tips on
                a 3.2s loop. The key on the <p> drives a CSS fade
                transition between tips (each tip mounts fresh so
                the entry animation re-fires). */}
            <p
              key={`tip-${guideTipIdx}`}
              style={S.guideHint}
              data-testid={`${testId}-tip-${guideTipIdx}`}
            >
              {guideTipIdx === 0 && tSafe('scan.camera.guideFrame',    'Place leaf or crop inside the frame')}
              {guideTipIdx === 1 && tSafe('scan.camera.guideSteady',   'Hold the camera steady')}
              {guideTipIdx === 2 && tSafe('scan.camera.guideLighting', 'Good lighting helps analysis')}
            </p>
          </>
        )}

        {/* Shutter flash overlay — paints a brief white wash
            over the viewport when the capture button is tapped
            so the moment feels like a real camera shutter. */}
        {captureFlash && (
          <div style={S.captureFlash} aria-hidden="true" />
        )}

        {/* Captured-frame confidence chip — sits above the
            preview to set expectation BEFORE the analyze tap.
            Calm "Ready to analyze" pill, not a fake AI score.
            Real confidence labels are emitted by the analysis
            engine after the analyze call completes. */}
        {phase === 'captured' && capturedUrl && (
          <div style={S.capturedBadge} aria-hidden="true">
            <span style={S.capturedDot} />
            <span>{tSafe('scan.camera.readyAnalyze', 'Ready to analyze')}</span>
          </div>
        )}

        {phase === 'requesting' && (
          <div style={S.statusOverlay}>
            <span style={S.spinner} />
            <p style={S.statusText}>
              {tSafe('scan.camera.requesting', 'Opening camera…')}
            </p>
          </div>
        )}

        {(phase === 'denied' || phase === 'error') && (
          <div style={S.statusOverlay}>
            <p style={S.statusTitle}>
              {phase === 'denied'
                ? tSafe('scan.camera.deniedTitle', 'Camera blocked')
                : tSafe('scan.camera.errorTitle',  'Camera unavailable')}
            </p>
            <p style={S.statusText}>{errorMsg}</p>
            <button
              type="button"
              onClick={pickFromGallery}
              style={S.uploadBtn}
              data-testid={`${testId}-upload-fallback`}
            >
              <_GalleryIcon size={18} />
              <span style={{ marginLeft: 8 }}>
                {tSafe('scan.camera.useSaved', 'Use a saved photo')}
              </span>
            </button>
            {phase === 'error' && (
              <button
                type="button"
                onClick={() => startStream(facing)}
                style={S.retryBtn}
                data-testid={`${testId}-retry`}
              >
                <_RetakeIcon size={16} />
                <span style={{ marginLeft: 6 }}>
                  {tSafe('common.tryAgain', 'Try again')}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Bottom control bar ────────────────────────────── */}
      <div style={S.bottomBar}>
        {phase === 'captured' ? (
          <>
            <button
              type="button"
              onClick={retake}
              style={S.bottomBtnGhost}
              data-testid={`${testId}-retake`}
            >
              <_RetakeIcon size={20} />
              <span style={S.bottomBtnLabel}>
                {tSafe('scan.camera.retake', 'Retake')}
              </span>
            </button>
            <button
              type="button"
              onClick={acceptCaptured}
              style={S.bottomBtnPrimary}
              data-testid={`${testId}-analyze`}
            >
              <_CheckIcon size={26} />
              <span style={S.bottomBtnLabelPrimary}>
                {tSafe('scan.camera.analyze', 'Analyze photo')}
              </span>
            </button>
            <span style={S.bottomSpacer} aria-hidden="true" />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={pickFromGallery}
              style={S.bottomBtnGhost}
              aria-label={tSafe('scan.camera.upload', 'Upload from gallery')}
              data-testid={`${testId}-gallery`}
            >
              <_GalleryIcon size={24} />
              <span style={S.bottomBtnLabel}>
                {tSafe('scan.camera.gallery', 'Gallery')}
              </span>
            </button>

            <button
              type="button"
              onClick={captureFrame}
              disabled={phase !== 'streaming'}
              style={{
                ...S.shutter,
                ...(phase !== 'streaming' ? S.shutterDisabled : null),
              }}
              aria-label={tSafe('scan.camera.capture', 'Capture')}
              data-testid={`${testId}-capture`}
            >
              <span style={S.shutterInner} />
            </button>

            {showSwitch ? (
              <button
                type="button"
                onClick={switchCamera}
                style={S.bottomBtnGhost}
                aria-label={tSafe('scan.camera.switch', 'Switch camera')}
                data-testid={`${testId}-switch`}
              >
                <_SwitchIcon size={24} />
                <span style={S.bottomBtnLabel}>
                  {tSafe('scan.camera.flip', 'Flip')}
                </span>
              </button>
            ) : (
              <span style={S.bottomSpacer} aria-hidden="true" />
            )}
          </>
        )}
      </div>

      {/* Hidden file input — feeds onFallbackUpload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileInputChange}
        style={{ display: 'none' }}
        data-testid={`${testId}-file-input`}
      />
    </div>,
    document.body,
  );
}

const S = {
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    background: '#0A0F14',
    color: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    paddingTop:    'env(safe-area-inset-top, 0)',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
  },
  topBar: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.65rem 0.8rem',
    zIndex: 2,
  },
  viewport: {
    position: 'relative',
    flex: 1,
    margin: '0 0.6rem',
    borderRadius: 22,
    overflow: 'hidden',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    background: '#000',
  },
  guideFrame: {
    position: 'absolute',
    top: '12%',
    left: '8%',
    right: '8%',
    bottom: '24%',
    borderRadius: 16,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  guideGlow: {
    position: 'absolute',
    inset: -8,
    borderRadius: 22,
    boxShadow: '0 0 0 1px rgba(230,188,133,0.18), 0 0 28px rgba(230,188,133,0.10)',
    pointerEvents: 'none',
  },
  scanLine: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    top: 0,
    height: 2,
    borderRadius: 2,
    background: 'linear-gradient(90deg, rgba(230,188,133,0) 0%, rgba(230,188,133,0.95) 50%, rgba(230,188,133,0) 100%)',
    boxShadow: '0 0 12px rgba(230,188,133,0.55)',
    animation: 'farroway-scan-line-sweep 2.4s ease-in-out infinite',
    willChange: 'transform, opacity',
    pointerEvents: 'none',
  },
  guideCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
  },
  capturedBadge: {
    position: 'absolute',
    top: '5%',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '0.4rem 0.85rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#A8C283',
    background: 'rgba(143,171,115,0.18)',
    border: '1px solid rgba(143,171,115,0.45)',
    borderRadius: 999,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    pointerEvents: 'none',
    letterSpacing: '0.01em',
  },
  capturedDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#8FAB73',
    boxShadow: '0 0 8px rgba(143,171,115,0.7)',
  },
  guideHint: {
    position: 'absolute',
    bottom: '8%',
    left: '50%',
    transform: 'translateX(-50%)',
    margin: 0,
    padding: '0.45rem 0.9rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    borderRadius: 999,
    color: 'rgba(255,255,255,0.95)',
    pointerEvents: 'none',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    // Soft fade-up when the tip swaps — the `key` change on the
    // <p> remounts the element so this animation re-fires each
    // rotation. 240ms in / 240ms out matches the global fade.
    animation: 'farroway-fade-in 240ms ease-out both',
  },
  // Shutter flash — full-viewport white wash for ~220ms when
  // the user taps capture. Three-stop opacity ramp so it reads
  // as a punchy shutter rather than a slow fade.
  captureFlash: {
    position: 'absolute',
    inset: 0,
    background: '#FFFFFF',
    pointerEvents: 'none',
    zIndex: 3,
    animation: 'farroway-capture-flash 220ms ease-out forwards',
  },
  statusOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(10,15,20,0.75)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem 1.5rem',
    textAlign: 'center',
  },
  statusTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 800,
    color: '#FFFFFF',
  },
  statusText: {
    margin: '0.5rem 0 1rem',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.85)',
    maxWidth: '20rem',
    lineHeight: 1.4,
  },
  spinner: {
    width: 28,
    height: 28,
    border: '2.5px solid rgba(255,255,255,0.18)',
    borderTopColor: '#C8944D',
    borderRadius: '50%',
    animation: 'farroway-spin 0.9s linear infinite',
    marginBottom: '0.6rem',
  },
  uploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.7rem 1.1rem',
    fontSize: '0.95rem',
    fontWeight: 800,
    color: '#0A0F14',
    background: '#FFFFFF',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  retryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: '0.55rem',
    padding: '0.5rem 0.95rem',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#FFFFFF',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 999,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  iconBtn: {
    width: 42,
    height: 42,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#FFFFFF',
    borderRadius: '50%',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    WebkitTapHighlightColor: 'transparent',
  },
  iconBtnOn: {
    background: 'rgba(245,201,125,0.85)',
    color: '#1F2933',
    border: '1px solid rgba(255,255,255,0.6)',
  },
  bottomBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.95rem 1.4rem 1.1rem',
    gap: '0.6rem',
    zIndex: 2,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: '50%',
    background: 'transparent',
    border: '4px solid #FFFFFF',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    flexShrink: 0,
  },
  shutterDisabled: {
    opacity: 0.5,
    cursor: 'default',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: '50%',
    background: '#FFFFFF',
    transition: 'transform 0.12s ease',
  },
  bottomBtnGhost: {
    width: 64,
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '0.3rem 0',
    background: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  bottomBtnPrimary: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '0.6rem 1.3rem',
    background: '#FFFFFF',
    border: 'none',
    color: '#0A0F14',
    borderRadius: 999,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    minWidth: 130,
  },
  bottomBtnLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: '0.02em',
  },
  bottomBtnLabelPrimary: {
    fontSize: '0.85rem',
    fontWeight: 800,
    color: '#0A0F14',
    letterSpacing: '0.005em',
  },
  bottomSpacer: {
    width: 64,
    display: 'inline-block',
  },
};
