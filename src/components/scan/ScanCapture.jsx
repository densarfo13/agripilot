/**
 * ScanCapture — image input + preview for the /scan flow.
 *
 * Camera flow: LiveCameraScanner overlay with a real MediaStream
 * (getUserMedia). Auto-opens on mount per the Scan Fullscreen
 * Auto-Camera spec — no Start Camera landing gate.
 *
 * Upload fallback: a hidden gallery-only `<input type="file"
 * accept="image/*">`. NO `capture` attribute on the input —
 * that would force iOS Safari into the OS Camera app and re-
 * introduce the dual-interface bug closed by the canonical-home
 * pass. The picker opens the gallery only.
 *
 *   • A denied camera permission falls back to the in-overlay
 *     upload-from-gallery panel — the user is never trapped.
 *   • The browser converts HEIC/large camera output for us; no
 *     ImageBitmap dance required.
 *
 * Spec safety
 *   • Never throws. Permission denial returns to idle.
 *   • Large images are size-checked (8MB cap) BEFORE base64
 *     encoding so a 50MB selfie can't lock the tab.
 *   • Preview uses ObjectURL + revokeObjectURL on unmount so the
 *     browser doesn't leak blobs across captures.
 *
 * Visible text via tStrict so non-English UIs render the right
 * labels.
 *
 * Props
 *   onContinue(payload) → fires when the user taps "Analyze"
 *   onCancel()          → optional; reset to idle
 *   experience          → 'farm' | 'backyard' | 'generic' (label flip)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
// Live in-app camera (full-screen native-style scanner). Replaces
// the previous `<input capture>` trigger that bounced the user
// into the OS Camera app — the live preview now sits inside the
// page so the experience reads like a real scanner.
import LiveCameraScanner from './LiveCameraScanner.jsx';
// Stage 1 of the agricultural-intelligence pipeline — score the
// captured photo's quality (blur + light) BEFORE we burn a backend
// scan call on it. The helper is pure, never throws, and SSR-safe;
// when document/Image are unavailable it returns ok=true so legacy
// callers keep working unchanged.
import { scoreImageQuality } from '../../lib/imageQualityPreflight.js';
// V5 stability pass — HEIC detection + JPEG re-encode + EXIF
// orientation. Pure async, never throws. Returns the original
// file's signature when normalization fails so the existing
// fallback path keeps working.
import {
  normalizeScanImage, isHeicFile,
} from '../../core/scan/imageNormalization.js';
import { emitScanEvent, SCAN_EVENTS } from '../../core/scan/scanTelemetry.js';
// Final Scan Consumer Migration — ScanCapture is now a PURE
// subscriber to the canonical ScanRuntime. Local previewUrl
// useState ownership is REMOVED. Runtime owns the preview
// lifecycle (creation, persistence, revocation on unmount).
import { useScanRuntime } from '../../hooks/useScanRuntime.js';
// Production-rebuild Phase 11: leaf isolation + lesion focus.
// Pure canvas — never throws, gracefully falls back when canvas /
// image decode isn't available. We hand the AI three crops
// (original, isolated leaf, lesion) so the classifier can rank
// disease probabilities against a tight, background-free target.
import { analyzeLeafFocus } from '../../core/scan/leafFocusEngine.js';

const MAX_BYTES = 12 * 1024 * 1024; // 12MB — bumped to honor V5 spec §12.

// Soft Ochre / Beige unified system — replaces the legacy white-on-
// dark inline tokens so the in-page capture surface visually
// matches the rest of the beige theme.
const STYLES = {
  wrap: {
    background: '#FFFFFF',
    border: '1px solid rgba(36,49,58,0.08)',
    borderRadius: 14,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  preview: {
    width: '100%',
    aspectRatio: '4 / 3',
    borderRadius: 12,
    background: '#FFF9F0',
    border: '1px dashed rgba(36,49,58,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    color: '#667085',
    fontSize: 13,
    textAlign: 'center',
    padding: 12,
  },
  previewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  buttonsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    appearance: 'none',
    border: '1px solid rgba(36,49,58,0.12)',
    background: 'transparent',
    color: '#1F2933',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    background: '#C8944D',
    color: '#FFFFFF',
    border: 'none',
    fontWeight: 700,
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  helper: {
    fontSize: 12,
    color: '#667085',
    lineHeight: 1.5,
  },
  error: {
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(198,90,75,0.10)',
    border: '1px solid rgba(198,90,75,0.30)',
    color: '#8A2E22',
    fontSize: 13,
  },
  // Dark fallback panel — matches the immersive companion theme.
  // Renders only when getUserMedia is unavailable OR while
  // analysis is in flight (the spinner state). Replaces the
  // legacy beige wrapper that used to be the first surface.
  fallbackPanel: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: '1.5rem 1.25rem',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    boxShadow: [
      '0 1px 0 0 rgba(255,255,255,0.06) inset',
      '0 12px 32px -12px rgba(0,0,0,0.55)',
    ].join(', '),
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  fallbackTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: '#FFFFFF',
  },
  fallbackBody: {
    margin: 0,
    fontSize: '0.92rem',
    fontWeight: 500,
    color: 'rgba(234,242,255,0.78)',
    lineHeight: 1.45,
  },
  fallbackError: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#F1A89E',
  },
  fallbackCta: {
    alignSelf: 'flex-start',
    padding: '0.7rem 1.1rem',
    fontSize: '0.95rem',
    fontWeight: 800,
    color: '#FFFFFF',
    background: 'linear-gradient(180deg, #C8944D 0%, #B9853F 100%)',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(185,133,63,0.40)',
    WebkitTapHighlightColor: 'transparent',
  },
};

export default function ScanCapture({ onContinue, onCancel, experience = 'generic' }) {
  // Subscribe to language change so labels refresh.
  useTranslation();

  // Single file input — gallery-only (no `capture` attribute). The
  // camera flow lives entirely in LiveCameraScanner's getUserMedia
  // overlay; the OS "open native camera" wrapper would force an
  // intermediate UI (iOS Safari opens a wrapper page) which is the
  // anti-pattern the iPhone-style scan pass explicitly forbids.
  const galleryInputRef = useRef(null);
  // Final Scan Consumer Migration — preview is now owned by
  // the canonical ScanRuntime. ScanCapture subscribes to its
  // snapshot for display; setPreview/local URL revocation is
  // gone. The runtime auto-registers with window.__scanSession()
  // so diagnostics reflect live state.
  const _scanRuntime = useScanRuntime({ autoRegisterDiagnostic: true });
  const preview = _scanRuntime.preview; // mirror — runtime is the truth
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Scan Fullscreen Auto-Camera spec §2 — tap Scan tab → camera
  // opens directly. The prior Start Camera gate was reverted
  // because users found the extra tap friction unhelpful: the
  // mobile camera permission prompt is itself the user gesture
  // the spec calls for, and any landing-button surface re-
  // introduces the dual-interface UX the canonical-home pass
  // closed. Permission failure surfaces the in-overlay denied
  // state with Retry + Upload from gallery.
  const supportsLiveCamera = typeof navigator !== 'undefined'
    && navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function';
  const [liveCameraOpen, setLiveCameraOpen] = useState(supportsLiveCamera);

  const navigate = useNavigate();
  // App Store launch audit §4.1: detect camera permission state
  // proactively so we can promote the gallery button and show a
  // calm hint when the user denied camera access. The Permissions
  // API isn't on every browser — we degrade silently when missing.
  const [cameraDenied, setCameraDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let firedDeniedEvent = false;
    const _logDenied = () => {
      // Fire-and-forget analytics the FIRST time the page sees
      // a denied state (either on initial query OR via the
      // permission-state change listener). Repeated firings are
      // suppressed via firedDeniedEvent.
      if (firedDeniedEvent) return;
      firedDeniedEvent = true;
      // Camera permission denied is an EXPECTED user state, not a
      // bug. Spec §6 - log at info level so it doesn't surface as
      // a yellow warning in the console; the UI surface already
      // routes the user to the gallery flow + manual fallback.
      try {
        // eslint-disable-next-line no-console
        console.info('[FARROWAY_SCAN] camera_permission_denied (info)');
      } catch { /* swallow */ }
      try {
        import('../../lib/analytics.js').then((mod) => {
          try { mod.safeTrackEvent && mod.safeTrackEvent('camera_permission_denied', {
            page: '/scan',
          }); } catch { /* never propagate */ }
        }).catch(() => { /* tolerate */ });
      } catch { /* never throw from a logger */ }
    };
    (async () => {
      try {
        if (typeof navigator === 'undefined') return;
        if (!navigator.permissions || typeof navigator.permissions.query !== 'function') return;
        const status = await navigator.permissions.query({ name: 'camera' });
        if (cancelled) return;
        if (status && status.state === 'denied') {
          setCameraDenied(true);
          _logDenied();
        }
        if (status && typeof status.addEventListener === 'function') {
          status.addEventListener('change', () => {
            if (cancelled) return;
            const denied = status.state === 'denied';
            setCameraDenied(denied);
            if (denied) _logDenied();
          });
        }
      } catch { /* permission query unsupported; silent degrade */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // ObjectURL revocation is now owned by the canonical ScanRuntime
  // (destroySession() releases every blob URL it created). The
  // useScanRuntime hook calls destroySession on unmount, so the
  // prior local revoke effect is removed.

  // ─── Live-camera handoff ─────────────────────────────────
  // Validates a captured/uploaded file and stages it as if it had
  // come from the hidden file input. Returns true on success so
  // the caller knows whether to keep the camera open or close.
  //
  // Async to give the image-quality preflight (Stage 1 of the
  // scan-intelligence pipeline) room to paint the candidate photo
  // onto a tiny canvas and compute luminance + sharpness. The
  // helper itself never throws — we still defensively wrap so a
  // rogue browser policy can't poison the capture path.
  const acceptCapturedFile = useCallback(async (next) => {
    if (!next) return false;
    if (next.size > MAX_BYTES) {
      setError(tStrict('scan.error.tooLarge', 'That photo is too large. Try a smaller one.'));
      return false;
    }
    // V5 stability pass — HEIC + extended-mime acceptance.
    // iPhone Safari + the Photos picker often hands back HEIC
    // (Apple's default capture format). The previous gate rejected
    // those outright. Now we accept and route HEIC through the
    // normalizer which decodes + re-encodes to JPEG so the
    // downstream pipeline only ever sees JPEG bytes.
    const ALLOWED_TYPES = new Set([
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/heic', 'image/heif',
    ]);
    const mime = String(next.type || '').toLowerCase();
    const heicByExt = await isHeicFile(next);
    const mimeOk = ALLOWED_TYPES.has(mime) || heicByExt;
    if (!mimeOk) {
      setError(tStrict('scan.error.badType',
        'Please use a JPEG, PNG, WebP, or HEIC photo.'));
      return false;
    }
    try {
      emitScanEvent(SCAN_EVENTS.IMAGE_CAPTURED, {
        mime, size: next.size, name: next.name || null, heic: heicByExt,
      });
    } catch { /* swallow */ }
    // V5 stability §3 — normalize BEFORE quality scoring so the
    // canvas-based luminance probe runs on the JPEG'd version
    // (matches what the AI sees). For non-HEIC inputs normalization
    // is still cheap (downscale + EXIF rotate + re-encode) — we
    // always want the AI to receive a stable JPEG.
    let workingFile = next;
    let normalizedDataUrl = '';
    try {
      const norm = await normalizeScanImage(next, { maxDim: 2048, quality: 0.82, maxBytes: MAX_BYTES });
      if (norm && norm.ok && norm.normalizedBlob) {
        // Use a deterministic filename so the upload path can derive
        // a stable scan id without re-hashing the bytes.
        const fname = (next.name && String(next.name).replace(/\.(heic|heif)$/i, '.jpg')) || 'scan.jpg';
        try {
          // Create a File so downstream code that probes `.name` /
          // `.lastModified` still works. Falls back to the blob if
          // the File constructor is unavailable.
          workingFile = new File([norm.normalizedBlob], fname, { type: 'image/jpeg' });
        } catch {
          workingFile = norm.normalizedBlob;
        }
        normalizedDataUrl = norm.normalizedDataUrl || '';
        try {
          emitScanEvent(SCAN_EVENTS.IMAGE_NORMALIZED, {
            isHeic: !!norm.isHeic, exifRotated: !!norm.exifRotated,
            w: norm.width, h: norm.height, mime: norm.mimeType,
          });
        } catch { /* swallow */ }
      } else if (norm && norm.reason === 'heic_decode_unsupported') {
        // Safari < 17 / non-Apple browsers can't decode HEIC. Show
        // a concrete hint instead of silently failing.
        setError(tStrict('scan.error.heicUnsupported',
          'HEIC photos aren’t supported on this device. Please share as JPEG.'));
        return false;
      }
      // Any other normalization failure falls through to the
      // pre-V5 path — better to attempt analysis on the raw file
      // than to block the user on a transient canvas hiccup.
    } catch { /* normalization is best-effort */ }
    // Stage 1 preflight — block blurry / dark / washed-out photos
    // BEFORE the scan API call. Returns ok=true on any environment
    // it can't measure (SSR, missing canvas) so legacy paths keep
    // working unchanged.
    try {
      const report = await scoreImageQuality(workingFile);
      if (report && report.ok === false && report.hint) {
        setError(report.hint);
        return false;
      }
    } catch { /* preflight is best-effort — never block on it */ }
    // Hand off to the canonical runtime. Runtime owns:
    //   • preview URL creation (prefers our normalized dataUrl
    //     for "AI sees the same bytes")
    //   • ObjectURL revocation on session destroy
    //   • the IMAGE_READY state transition that gates analysis
    await _scanRuntime.choosePhoto({
      size:    workingFile.size,
      type:    workingFile.type,
      dataUrl: normalizedDataUrl || null,
      _id:     workingFile.name || ('cap_' + Date.now()),
    });
    setFile(workingFile);
    setError('');
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // triggerPicker removed (May 2026 iPhone-style scan pass). The
  // only path that ever called it was the now-deleted hidden button
  // row; the live overlay (LiveCameraScanner) owns the entire
  // capture flow, and the gallery-only upload uses galleryInputRef
  // directly via triggerGallery.

  // Ref points at the latest continueAnalysis closure. The
  // handlers below are declared BEFORE continueAnalysis in the
  // component body, so we can't reference it directly in the
  // dep array (TDZ ReferenceError). The ref lets the handlers
  // call the freshest continueAnalysis at invocation time.
  const continueAnalysisRef = useRef(null);

  const onLiveCameraCaptured = useCallback(async ({ file: capturedFile }) => {
    setLiveCameraOpen(false);
    if (!capturedFile) return;
    // Stage the file in local state (so retake/error paths still
    // have access to it) AND fire analysis DIRECTLY via the ref
    // — skipping the wrapper preview flash. Without this, the
    // user saw the boxed wrapper for a render cycle before the
    // page advanced to the analyzing phase.
    //
    // The Stage 1 preflight inside acceptCapturedFile may reject
    // the photo (blur / dark / washed out). When that happens it
    // returns false AND sets a calm inline hint via setError so
    // the user can retake without leaving the page — we re-open
    // the camera overlay so the retake path is one tap away.
    const accepted = await acceptCapturedFile(capturedFile);
    if (!accepted) {
      if (supportsLiveCamera) setLiveCameraOpen(true);
      return;
    }
    if (continueAnalysisRef.current) {
      let url = '';
      try { url = URL.createObjectURL(capturedFile); } catch { /* swallow */ }
      continueAnalysisRef.current(capturedFile, url);
    }
  }, [acceptCapturedFile, supportsLiveCamera]);

  const onLiveCameraFallbackUpload = useCallback(async (uploadedFile) => {
    setLiveCameraOpen(false);
    if (!uploadedFile) return;
    // Same auto-analysis path for the in-overlay gallery picker.
    // The user picked a photo → they expect analysis to start;
    // the wrapper preview is a double-tap that adds nothing.
    const accepted = await acceptCapturedFile(uploadedFile);
    if (!accepted) return;
    if (continueAnalysisRef.current) {
      let url = '';
      try { url = URL.createObjectURL(uploadedFile); } catch { /* swallow */ }
      continueAnalysisRef.current(uploadedFile, url);
    }
  }, [acceptCapturedFile]);

  const onLiveCameraCancel = useCallback(() => {
    setLiveCameraOpen(false);
    // May 2026 scan-flow fix: when the user closes the camera
    // without capturing, route back to Home instead of dropping
    // them on the boxed wrapper. The wrapper exists only as the
    // post-capture preview + the denied/error fallback path. If
    // the user has an in-progress preview, stay on the page so
    // they can analyze or retake.
    if (!preview && !cameraDenied) {
      try { navigate('/'); } catch { /* swallow */ }
    }
  }, [preview, cameraDenied, navigate]);

  const triggerGallery = useCallback(() => {
    setError('');
    try { galleryInputRef.current?.click(); } catch { /* ignore */ }
  }, []);

  const onFileChange = useCallback(async (e) => {
    const next = e?.target?.files?.[0];
    if (!next) return;
    if (next.size > MAX_BYTES) {
      setError(tStrict('scan.error.tooLarge', 'That photo is too large. Try a smaller one.'));
      return;
    }
    // Phase 4 spec: only jpeg/png/webp — reject HEIC, TIFF, BMP, etc.
    const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    if (!ALLOWED_TYPES.has(String(next.type || '').toLowerCase())) {
      setError(tStrict('scan.error.badType', 'Please use a JPEG, PNG, or WebP photo.'));
      return;
    }
    // Stage 1 preflight — same gate the live-camera path runs.
    try {
      const report = await scoreImageQuality(next);
      if (report && report.ok === false && report.hint) {
        setError(report.hint);
        if (e?.target) { try { e.target.value = ''; } catch { /* swallow */ } }
        return;
      }
    } catch { /* best-effort */ }
    // Hand off to the canonical runtime — it creates the preview
    // URL, persists it, and emits IMAGE_READY when ready.
    await _scanRuntime.choosePhoto({
      size:    next.size,
      type:    next.type,
      _id:     next.name || ('gallery_' + Date.now()),
    });
    setFile(next);
    setError('');
    // Auto-fire analysis — the fallback-panel "Upload a photo"
    // button is the only path that reaches onFileChange now (the
    // boxed preview wrapper was removed). Any file the user picks
    // should advance to analysis immediately; matching the
    // in-overlay capture + in-overlay upload behaviour.
    if (continueAnalysisRef.current) {
      continueAnalysisRef.current(next, url);
    }
  }, [preview]);

  const reset = useCallback(() => {
    setError('');
    // Destroy the runtime session — runtime releases every blob
    // URL it created + resets to IDLE. The next photo handoff
    // starts a fresh session.
    _scanRuntime.destroySession();
    setFile(null);
    if (galleryInputRef.current) {
      try { galleryInputRef.current.value = ''; } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueAnalysis = useCallback(async (fileOverride, previewOverride) => {
    // fileOverride lets in-overlay handlers (capture / gallery)
    // pass the captured File directly without waiting for the
    // setFile state update. Without it, the user saw the boxed
    // wrapper preview flash between overlay-close and analysis-
    // start because React state hadn't updated yet.
    const fileToUse = fileOverride || file;
    if (!fileToUse) return;
    setBusy(true);
    setError('');
    try {
      // V5 stability §3 — `preview` already holds the normalized
      // dataURL (or an objectURL fallback) set during
      // acceptCapturedFile. We prefer that as the wire-side
      // imageBase64 because it survives the unmount-revoke cycle
      // and is the SAME bytes the AI receives. The FileReader
      // re-encode below is the legacy safety net for cases where
      // normalization didn't produce a dataURL.
      const cachedDataUrl = (typeof preview === 'string' && preview.startsWith('data:image/'))
        ? preview : '';
      const b64 = cachedDataUrl
        || (await _readAsBase64(fileToUse).catch(() => null));
      // Downscale to a small dataURL for the history thumbnail.
      // Best-effort — if canvas isn't available the consumer
      // simply falls back to the placeholder emoji.
      const thumbnail = await _makeThumbnail(fileToUse).catch(() => null);
      // V5 + Phase 11: leaf focus analysis. Pure canvas, never
      // throws. Returns the original / isolated-leaf / lesion-crop
      // dataURLs + metrics + guidance flags. On any failure we
      // pass a null focusContext through — analyzeScan + the UI
      // both degrade gracefully (no isolated crop, no guidance).
      const focusContext = await analyzeLeafFocus(fileToUse, {
        workingMaxDim: 320,
        cropMaxDim:    1024,
        jpegQuality:   0.85,
      }).catch(() => null);
      if (typeof onContinue === 'function') {
        try {
          await onContinue({
            imageBase64: b64,
            imageUrl:    previewOverride || preview,
            thumbnail,
            file: fileToUse,
            focusContext,
          });
        } catch { /* never propagate */ }
      }
    } finally {
      setBusy(false);
    }
  }, [file, preview, onContinue]);

  // Keep the ref in sync so the in-overlay handlers (declared
  // earlier in the component body to avoid hoisting issues) can
  // call the freshest continueAnalysis closure when the user
  // captures or uploads from inside the camera.
  useEffect(() => {
    continueAnalysisRef.current = continueAnalysis;
  }, [continueAnalysis]);

  // captureLabel + the isBackyard branching it drove went away with
  // the hidden legacy button row — LiveCameraScanner's own in-overlay
  // copy is the only capture-trigger label that ever renders now.

  // Single-interface scan fix: when the browser supports getUserMedia
  // AND we're not mid-analysis, render ONLY the live camera overlay
  // + the hidden gallery input. No wrap chrome, no background card,
  // no second surface behind the camera. The user sees exactly one
  // interface: the fullscreen camera (or its permission-denied
  // fallback, which LiveCameraScanner owns internally).
  //
  // The white wrapper card the user previously saw was this
  // component's `STYLES.wrap` div peeking out behind any gap in the
  // LiveCameraScanner overlay (cold start, permission grant pause,
  // narrow viewports). Switching to a Fragment kills that ghost
  // wrapper outright.
  if (supportsLiveCamera && !busy) {
    return (
      <>
        <LiveCameraScanner
          open={liveCameraOpen}
          facingHint="environment"
          onCancel={onLiveCameraCancel}
          onCaptured={onLiveCameraCaptured}
          onFallbackUpload={onLiveCameraFallbackUpload}
          testId="scan-live-camera"
        />
        {/* Gallery-only file input. No `capture` attribute — that
            would open the OS Camera app on iOS Safari and re-create
            the upload-opens-camera bug the fix is closing. */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          style={{ display: 'none' }}
          data-testid="scan-capture-gallery-input"
        />
      </>
    );
  }

  // Camera unsupported OR analysis in flight: render the calm
  // fallback panel. This is the ONLY surface that ever shows
  // wrapper chrome, and only because the live camera isn't
  // available right now.
  return (
    <div style={STYLES.wrap} data-testid="scan-capture" data-experience={experience}>
      {/* Gallery-only file input lives here too so the fallback
          panel's "Upload a photo" button can trigger it. */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        style={{ display: 'none' }}
        data-testid="scan-capture-gallery-input"
      />
      {!supportsLiveCamera ? (
        <div style={STYLES.fallbackPanel} data-testid="scan-capture-fallback">
          <h2 style={STYLES.fallbackTitle}>
            {tStrict('scan.fallback.title', 'Camera unavailable')}
          </h2>
          <p style={STYLES.fallbackBody}>
            {tStrict(
              'scan.fallback.body',
              "This browser can't open the live camera. Pick a saved photo to continue scanning.",
            )}
          </p>
          {error ? (
            <p style={STYLES.fallbackError} data-testid="scan-capture-error">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={triggerGallery}
            style={STYLES.fallbackCta}
            data-testid="scan-capture-gallery"
          >
            {tStrict('journey.scan.upload', 'Upload a photo')}
          </button>
        </div>
      ) : null}
      {busy ? (
        <div style={STYLES.fallbackPanel} role="status" aria-busy="true">
          <p style={STYLES.fallbackBody}>
            {tStrict('scan.analyzing', 'Analyzing…')}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Encode a File as a base64 dataURL. Returns null on any error so
 * the caller can fall through cleanly.
 */
function _readAsBase64(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const out = String(reader.result || '');
          if (!out) return reject(new Error('empty'));
          resolve(out);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(reader.error || new Error('read_failed'));
      reader.readAsDataURL(file);
    } catch (err) { reject(err); }
  });
}

/**
 * Generate a small JPEG thumbnail (max 96 px on longest side) for
 * the scan-history list. Returns a dataURL on success or null on
 * any failure (no canvas, decode error, etc.) — the consumer
 * falls back to a placeholder.
 */
function _makeThumbnail(file, maxDim = 96) {
  return new Promise((resolve) => {
    try {
      if (typeof URL === 'undefined' || typeof document === 'undefined') return resolve(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const ratio = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1);
          const w = Math.max(1, Math.round(img.naturalWidth  * ratio));
          const h = Math.max(1, Math.round(img.naturalHeight * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, w, h);
          let dataUrl = '';
          try { dataUrl = canvas.toDataURL('image/jpeg', 0.7); }
          catch { dataUrl = ''; }
          resolve(dataUrl || null);
        } catch { resolve(null); }
        finally {
          try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        }
      };
      img.onerror = () => {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        resolve(null);
      };
      img.src = url;
    } catch { resolve(null); }
  });
}
