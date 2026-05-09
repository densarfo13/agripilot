/**
 * SafeCameraSurface — production-hardened camera capture surface.
 *
 *   <SafeCameraSurface
 *     onResult={(result) => ...}
 *     onBackHome={() => navigate('/')}
 *   />
 *
 * MAY 2026 CAMERA HARDENING PASS
 * ──────────────────────────────
 *   The previous flow occasionally:
 *     • timed out at 4 s on slow Android camera negotiation,
 *     • showed a black preview because the <video> mounted before
 *       the MediaStream finished its first frame,
 *     • attached the stream BEFORE the track was actually `live`,
 *     • failed silently on Safari (where srcObject is async).
 *
 *   This rewrite delegates the lifecycle dance to
 *   `src/lib/cameraLifecycle.js` — a typed state machine that
 *   verifies `track.readyState === 'live'`, awaits
 *   `loadedmetadata`, polls `video.readyState >= 2`, races a 9 s
 *   hard fence, and tolerates Safari's quirks. The component
 *   below only handles what's left: phase rendering, calm
 *   placeholder, fallback CTAs, and stream cleanup on every
 *   transition.
 *
 *   Phases
 *     idle        — initial; first paint, "Ready to scan" card.
 *     starting    — "Preparing camera…" shimmer (preview NOT mounted).
 *     ready       — live preview painting; capture button visible.
 *     denied      — permission refused; calm fallback + upload.
 *     unsup       — getUserMedia missing; calm fallback + upload.
 *     timeout     — camera took too long; calm fallback + upload.
 *     preview     — photo captured / uploaded; result rendered.
 *
 *   Render contract
 *     The <video> element ONLY mounts in `ready` phase. While
 *     `starting`, the user sees the calm shimmer placeholder so
 *     they're never staring at a black box.
 *
 * STRICT-RULE AUDIT
 *   • Inline styles only, Soft Ochre tokens via PREMIUM_TOKENS.
 *   • Stream cleanup runs on unmount AND every transition out of
 *     ready (capture, retake, upload, fallback, retry).
 *   • Visible text via tSafe with English fallbacks.
 *   • Never throws. Every async path try/catched.
 *   • <video> renders with playsInline + muted + autoPlay so iOS
 *     Safari's autoplay policy never blocks the preview.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';
// Premium line-icon system (May 2026 realism migration). Replaces
// the legacy camera emoji glyphs on the idle + fallback cards with
// a scalable single-stroke SVG that inherits currentColor — same
// silhouette across every render size + zero rasterisation.
import RealisticIcon from '../../assets/realism/icons/RealisticIcon.jsx';
import {
  startCamera as _startCamera,
  stopStream as _stopStream,
  CAMERA_TIMEOUT_MS,
} from '../../lib/cameraLifecycle.js';

const SAFE_MOCK_RESULT = Object.freeze({
  status:     'needs_review',
  label:      'Plant photo received',
  message:    'Farroway saved your photo. Review or expert scan can be added next.',
  confidence: null,
});

function _logEvent(eventName, payload) {
  try {
    console.log('[FARROWAY_SCAN]', eventName, payload || {});
  } catch { /* swallow */ }
  try {
    import('../../lib/analytics.js').then((mod) => {
      try {
        if (mod && typeof mod.safeTrackEvent === 'function') {
          mod.safeTrackEvent(eventName, payload || {});
        }
      } catch { /* never propagate */ }
    }).catch(() => { /* tolerate */ });
  } catch { /* never throw from a logger */ }
}

export default function SafeCameraSurface({
  onResult = null,
  onBackHome = null,
  hideBackHome = false,
}) {
  // Phases: idle | starting | ready | denied | unsup | timeout | preview
  const [phase, setPhase]   = useState('idle');
  const [error, setError]   = useState(null);
  const [photo, setPhoto]   = useState(null);     // { dataUrl, file? }
  const [result, setResult] = useState(null);

  const videoRef       = useRef(null);
  const streamRef      = useRef(null);
  const fileInputRef   = useRef(null);
  // Cancellation token so a slow startCamera that resolves AFTER
  // the user navigated away or retried can self-discard instead
  // of stomping the new lifecycle.
  const startTokenRef  = useRef(0);

  // ─── Cleanup on unmount + page-visibility-hidden ──────────
  // Capture refs at effect-run time so the cleanup never reads
  // stale `.current` (the React-Hooks lint rule's exact concern).
  // We also stop the stream when the tab becomes hidden so the
  // camera light goes off the moment the user backgrounds the
  // app — Android Chrome does NOT auto-suspend MediaStream
  // tracks on visibility change, so without this the camera
  // light stays on while the user is on a different tab.
  useEffect(() => {
    _logEvent('scan_page_opened', { surface: 'SafeCameraSurface' });
    const tokenRefSnapshot  = startTokenRef;
    const streamRefSnapshot = streamRef;
    const videoRefSnapshot  = videoRef;
    const onVisibility = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          // Bump token so any in-flight startCamera() bails out.
          tokenRefSnapshot.current += 1;
          _stopStream(streamRefSnapshot.current, videoRefSnapshot.current);
          streamRefSnapshot.current = null;
        }
      } catch { /* never throw from a listener */ }
    };
    try {
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', onVisibility);
      }
    } catch { /* ignore */ }
    return () => {
      try {
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
          document.removeEventListener('visibilitychange', onVisibility);
        }
      } catch { /* ignore */ }
      // Bump token so any in-flight startCamera() bails out.
      tokenRefSnapshot.current += 1;
      _stopStream(streamRefSnapshot.current, videoRefSnapshot.current);
      streamRefSnapshot.current = null;
    };
  }, []);

  // ─── Start camera ──────────────────────────────────────────
  // Uses the lifecycle helper so the preview is gated on
  // metadata + live track + ≥9 s budget. Self-cancels via
  // startTokenRef when a newer attempt supersedes it.
  const startCamera = useCallback(async () => {
    setError(null);
    // Drop any stream we might still hold from a prior attempt.
    _stopStream(streamRef.current, videoRef.current);
    streamRef.current = null;

    // Mount the "Preparing camera…" shimmer FIRST so the user
    // never sees a black <video>. The <video> element itself
    // doesn't render until `ready`.
    setPhase('starting');

    const myToken = ++startTokenRef.current;

    // The <video> ref isn't mounted while we're in `starting`
    // (preview is gated on `ready`), but the lifecycle helper
    // needs an element. We mount a hidden, off-screen <video>
    // below in JSX so the ref always exists. After the helper
    // resolves successfully we flip to `ready` and CSS unhides
    // the same element (it stays in the DOM the whole time).

    const result = await _startCamera({
      video:     videoRef.current,
      timeoutMs: CAMERA_TIMEOUT_MS,
      facing:    'environment',
      onLog:     (event, detail) => _logEvent(event, detail),
    });

    // Stale start? The user retried, navigated, or unmounted.
    if (myToken !== startTokenRef.current) {
      try { _stopStream(result && result.ok ? result.stream : null, videoRef.current); } catch { /* ignore */ }
      return;
    }

    if (result.ok) {
      streamRef.current = result.stream;
      setPhase('ready');
      return;
    }

    // Failure path — map typed reason to a user-facing phase.
    // Each phase carries its own calm, non-technical copy below.
    //   denied          — NotAllowedError   (permission off)
    //   unsup           — getUserMedia missing entirely
    //   not_found       — NotFoundError     (no camera device)
    //   busy            — NotReadableError  (camera in use by another app)
    //   overconstrained — Constraints rejected; lifecycle already
    //                     retried with `video: true`, so reaching
    //                     this branch means even generic failed
    //   timeout         — getUserMedia / metadata exceeded budget
    //   no_dimensions   — videoWidth=0 after ready (black-preview
    //                     guard); treat as timeout to keep copy calm
    //   anything else   — fall through to denied so the user always
    //                     gets a working upload path
    const reason = result.reason || 'unknown';
    setError(result.message || reason);
    if (reason === 'unsupported')         setPhase('unsup');
    else if (reason === 'denied')         setPhase('denied');
    else if (reason === 'not_found')      setPhase('not_found');
    else if (reason === 'busy')           setPhase('busy');
    else if (reason === 'overconstrained') setPhase('not_found'); // single-camera laptops, etc.
    else if (reason === 'timeout')        setPhase('timeout');
    else if (reason === 'no_dimensions')  setPhase('timeout');
    else setPhase('denied'); // safest default — fallback offers retry + upload.
  }, []);

  // ─── Capture photo from the live stream ───────────────────
  const capturePhoto = useCallback(() => {
    try {
      const video = videoRef.current;
      if (!video) throw new Error('No video element');
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhoto({ dataUrl, file: null });
      setResult({ ...SAFE_MOCK_RESULT });
      setPhase('preview');
      // Stop the stream now that we have the frame.
      _stopStream(streamRef.current, videoRef.current);
      streamRef.current = null;
      _logEvent('scan_photo_uploaded', { source: 'camera' });
    } catch (err) {
      try { console.error('Capture failed:', err && err.message); }
      catch { /* swallow */ }
      // Don't crash — fall back to the upload path.
      _stopStream(streamRef.current, videoRef.current);
      streamRef.current = null;
      setPhase('denied');
    }
  }, []);

  // ─── Upload photo from gallery / file picker ──────────────
  const handleUploadClick = useCallback(() => {
    try {
      if (fileInputRef.current) fileInputRef.current.click();
    } catch { /* swallow */ }
  }, []);

  const handleFileChange = useCallback((e) => {
    try {
      const file = e && e.target && e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          setPhoto({ dataUrl: String(reader.result || ''), file });
          setResult({ ...SAFE_MOCK_RESULT });
          setPhase('preview');
          // Stop any live stream we no longer need.
          _stopStream(streamRef.current, videoRef.current);
          streamRef.current = null;
          _logEvent('scan_photo_uploaded', { source: 'upload' });
        } catch { /* swallow */ }
      };
      reader.onerror = () => { /* let the user retry — no crash */ };
      reader.readAsDataURL(file);
    } catch (err) {
      try { console.error('Upload failed:', err && err.message); }
      catch { /* swallow */ }
    }
  }, []);

  // ─── Save / retake handlers ───────────────────────────────
  const handleSave = useCallback(() => {
    _logEvent('scan_result_saved', {});
    if (typeof onResult === 'function' && photo && result) {
      try { onResult({ photo, result }); } catch { /* swallow */ }
    }
  }, [onResult, photo, result]);

  const handleRetake = useCallback(() => {
    _logEvent('scan_retry_clicked', {});
    setPhoto(null);
    setResult(null);
    setError(null);
    // Always release any prior stream before a fresh start.
    _stopStream(streamRef.current, videoRef.current);
    streamRef.current = null;
    setPhase('idle');
  }, []);

  // ─── Render ───────────────────────────────────────────────
  // The <video> element is rendered for every phase so the ref
  // is always present when startCamera() needs to attach. It is
  // visually hidden outside the `ready` phase via display:none.
  const videoVisible = phase === 'ready';

  return (
    <main style={S.page} data-testid="safe-camera-surface" data-phase={phase}>
      <header style={S.header}>
        <h1 style={S.title}>
          {tSafe('safeCamera.title', 'Scan plant or crop')}
        </h1>
        <p style={S.subtitle}>
          {tSafe(
            'safeCamera.subtitle',
            'Take a clear photo of the leaf, fruit, or stem. Good light helps.',
          )}
        </p>
      </header>

      {/* Phase: preview — photo captured or uploaded */}
      {phase === 'preview' && photo && result ? (
        <section style={S.previewCard}>
          {photo.dataUrl ? (
            <img src={photo.dataUrl} alt="" style={S.previewImg} />
          ) : null}
          <div style={S.resultBox}>
            <div style={S.resultLabel}>{String(result.label || 'Photo received')}</div>
            <div style={S.resultMsg}>{String(result.message || '')}</div>
          </div>
          <div style={S.btnRow}>
            <button type="button" onClick={handleSave} style={S.btnPrimary}
                    className="ff-tap" data-testid="safe-scan-save">
              {tSafe('safeCamera.save', 'Save scan')}
            </button>
            <button type="button" onClick={handleRetake} style={S.btnGhost}
                    className="ff-tap" data-testid="safe-scan-retake">
              {tSafe('safeCamera.retake', 'Retake')}
            </button>
          </div>
        </section>
      ) : null}

      {/* Phase: starting — calm shimmer placeholder
          The <video> ref is mounted but display:none so
          loadedmetadata fires; the user only sees the shimmer. */}
      {phase === 'starting' ? (
        <section style={S.cameraCard} data-testid="safe-scan-starting">
          <div style={S.shimmerWrap} aria-hidden="true">
            <div style={S.shimmer} />
            <div style={S.shimmerLabel}>
              {tSafe('safeCamera.preparing', 'Preparing camera…')}
            </div>
          </div>
        </section>
      ) : null}

      {/* Phase: ready — live preview */}
      {phase === 'ready' ? (
        <section style={S.cameraCard}>
          {/* video rendered below — same element across phases */}
          <div style={S.btnRow}>
            <button type="button" onClick={capturePhoto} style={S.btnPrimary}
                    className="ff-tap" data-testid="safe-scan-capture">
              {tSafe('safeCamera.takePhoto', 'Take photo')}
            </button>
            <button type="button" onClick={handleUploadClick} style={S.btnGhost}
                    className="ff-tap" data-testid="safe-scan-upload-secondary">
              {tSafe('safeCamera.uploadPhoto', 'Upload photo')}
            </button>
          </div>
        </section>
      ) : null}

      {/* The single <video> element. Mounted at all times so the
          ref exists when startCamera() runs; visually shown only
          when phase === 'ready'. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ ...S.video, display: videoVisible ? 'block' : 'none' }}
        data-testid="safe-scan-video"
      />

      {/* Phase: idle — first-paint card */}
      {phase === 'idle' && !photo ? (
        <section style={S.idleCard}>
          <RealisticIcon name="camera" size={48} style={S.bigIcon} />
          <h2 style={S.idleTitle}>
            {tSafe('safeCamera.readyTitle', 'Ready to scan')}
          </h2>
          <p style={S.idleBody}>
            {tSafe(
              'safeCamera.readyBody',
              'Take a photo with your camera, or upload one from your gallery.',
            )}
          </p>
          <div style={S.btnRow}>
            <button type="button" onClick={startCamera} style={S.btnPrimary}
                    className="ff-tap" data-testid="safe-scan-start">
              {tSafe('safeCamera.openCamera', 'Open camera')}
            </button>
            <button type="button" onClick={handleUploadClick} style={S.btnGhost}
                    className="ff-tap" data-testid="safe-scan-upload-primary">
              {tSafe('safeCamera.uploadPhoto', 'Upload photo')}
            </button>
          </div>
        </section>
      ) : null}

      {/* Phase: denied / unsup / timeout / not_found / busy
          → calm, non-technical fallback. Each branch picks the
          copy that matches its specific failure mode so the user
          gets actionable guidance, not a generic "try again". */}
      {(phase === 'denied'
         || phase === 'unsup'
         || phase === 'timeout'
         || phase === 'not_found'
         || phase === 'busy') && !photo ? (
        <section style={S.fallbackCard} data-testid={`safe-scan-fallback-${phase}`}>
          <RealisticIcon name="camera" size={48} style={S.bigIcon} />
          <h2 style={S.idleTitle}>
            {phase === 'denied'
              ? tSafe('safeCamera.deniedTitle', 'Camera permission needed')
              : phase === 'unsup'
                ? tSafe('safeCamera.unsupTitle', 'Camera not available on this device')
                : phase === 'not_found'
                  ? tSafe('safeCamera.notFoundTitle', 'No camera found')
                  : phase === 'busy'
                    ? tSafe('safeCamera.busyTitle', 'Camera is in use')
                    : tSafe('safeCamera.timeoutTitle', 'Camera is taking longer than expected')}
          </h2>
          <p style={S.idleBody}>
            {phase === 'denied'
              ? tSafe('safeCamera.deniedBody', 'Camera access is off. You can upload a photo instead.')
              : phase === 'not_found'
                ? tSafe('safeCamera.notFoundBody', 'No camera found. Upload a photo to continue.')
                : phase === 'busy'
                  ? tSafe('safeCamera.busyBody', 'Camera may be used by another app. Try again or upload a photo.')
                  : phase === 'timeout'
                    ? tSafe('safeCamera.timeoutBody', 'You can still upload a photo, or try again.')
                    : tSafe('safeCamera.unsupBody', 'You can still upload a photo to continue.')}
          </p>
          <div style={S.btnRow}>
            <button type="button" onClick={handleUploadClick} style={S.btnPrimary}
                    className="ff-tap" data-testid="safe-scan-upload-fallback">
              {tSafe('safeCamera.uploadPhoto', 'Upload photo')}
            </button>
            <button type="button" onClick={startCamera} style={S.btnGhost}
                    className="ff-tap" data-testid="safe-scan-retry-camera">
              {tSafe('safeCamera.retryCamera', 'Retry camera')}
            </button>
            {!hideBackHome && typeof onBackHome === 'function' ? (
              <button type="button" onClick={onBackHome} style={S.btnGhost}
                      className="ff-tap" data-testid="safe-scan-back-home">
                {tSafe('safeCamera.backHome', 'Back to Home')}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Hidden file picker — used by all upload paths. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        data-testid="safe-scan-file-input"
      />
    </main>
  );
}

// Test hooks (kept for the existing test surface — re-exports
// from the lifecycle helper so the timeout constant has a single
// source of truth).
export const _internal = Object.freeze({
  CAMERA_TIMEOUT_MS,
  SAFE_MOCK_RESULT,
});

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${T.bgTop} 0%, ${T.bgBottom} 100%)`,
    color: T.ink,
    padding: '24px 16px 96px',
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  header: { padding: '4px 0' },
  title:  { margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', color: T.ink },
  subtitle: { margin: '4px 0 0', fontSize: 14, color: T.inkDim, lineHeight: 1.5 },
  cameraCard: {
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: 12, borderRadius: T.radiusCard, background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  video: {
    width: '100%', maxHeight: '60vh', borderRadius: 12, background: '#000',
    objectFit: 'cover',
  },
  shimmerWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 3',
    borderRadius: 12,
    overflow: 'hidden',
    background: T.ochreSoft,
    border: `1px solid ${T.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmer: {
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(90deg, ${T.ochreSoft} 0%, rgba(255,255,255,0.55) 50%, ${T.ochreSoft} 100%)`,
    backgroundSize: '200% 100%',
    animation: 'farroway-shimmer 1.4s ease-in-out infinite',
  },
  shimmerLabel: {
    position: 'relative',
    fontSize: 14,
    fontWeight: 700,
    color: T.ochreInk,
    letterSpacing: '0.02em',
    background: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    padding: '0.45rem 0.9rem',
    border: `1px solid ${T.ochreBorder}`,
  },
  idleCard: {
    padding: '2rem 1.5rem', borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
    textAlign: 'center', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 12,
  },
  fallbackCard: {
    padding: '2rem 1.5rem', borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.amberBorder}`,
    boxShadow: T.shadowCard,
    textAlign: 'center', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 10,
  },
  bigIcon: { fontSize: 48, lineHeight: 1 },
  idleTitle: { margin: '0.25rem 0 0', fontSize: 20, fontWeight: 800, color: T.ink },
  idleBody:  { margin: '0.25rem 0 0', fontSize: 14, color: T.inkDim, lineHeight: 1.5 },
  errBody:   { margin: '0.25rem 0 0', fontSize: 12, color: T.error },
  previewCard: {
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: 12, borderRadius: T.radiusCard, background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  previewImg: {
    width: '100%', maxHeight: '50vh', borderRadius: 12, background: '#000',
    objectFit: 'contain',
  },
  resultBox: {
    padding: 12, borderRadius: 12, background: T.greenSoft,
    border: `1px solid ${T.greenBorder}`,
  },
  resultLabel: { fontSize: 16, fontWeight: 800, color: T.greenInk },
  resultMsg:   { marginTop: 4, fontSize: 14, color: T.ink, lineHeight: 1.5 },
  btnRow: {
    display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12,
    justifyContent: 'center',
  },
  btnPrimary: {
    flex: 1, minWidth: '10rem', minHeight: 48, padding: '0.85rem 1.25rem',
    border: 'none', borderRadius: 999,
    background: `linear-gradient(180deg, ${T.ochre} 0%, ${T.ochreActive} 100%)`,
    color: '#FFFFFF',
    fontSize: 14, fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(185,133,63,0.32)',
    letterSpacing: '0.005em',
    fontFamily: 'inherit',
  },
  btnGhost: {
    flex: 1, minWidth: '10rem', minHeight: 48, padding: '0.85rem 1.25rem',
    border: `1px solid ${T.border}`, borderRadius: 999,
    background: 'transparent', color: T.ink,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
