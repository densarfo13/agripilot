/**
 * ScanCapture — image input + preview for the new /scan flow.
 *
 * Uses a hidden `<input type="file" capture="environment">` rather
 * than a custom MediaStream pipeline. This is intentional:
 *   • The native picker handles permission prompts (camera + photo
 *     library) consistently across iOS and Android.
 *   • A denied permission falls back to the picker's library tab —
 *     the user is never trapped.
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
import { isFeatureEnabled } from '../../config/features.js';
// Live in-app camera (full-screen native-style scanner). Replaces
// the previous `<input capture>` trigger that bounced the user
// into the OS Camera app — the live preview now sits inside the
// page so the experience reads like a real scanner.
import LiveCameraScanner from './LiveCameraScanner.jsx';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

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
};

export default function ScanCapture({ onContinue, onCancel, experience = 'generic' }) {
  // Subscribe to language change so labels refresh.
  useTranslation();

  const inputRef = useRef(null);
  // Robust journey §1: a second input WITHOUT the `capture`
  // attribute so the OS shows the gallery picker directly when
  // the user prefers an upload (or when camera permission is
  // denied). Visually exposed as a small "Upload from gallery"
  // button beside the camera trigger.
  const galleryInputRef = useRef(null);
  const [preview, setPreview] = useState(null);   // ObjectURL
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Live in-app camera open state. Per the May 2026 scan-flow
  // fix: AUTO-OPEN on mount so /scan goes straight to the
  // immersive camera. The boxed wrapper that used to be the
  // first surface is now a fallback only — it appears when
  // (a) the user has captured a photo and is reviewing it, OR
  // (b) the camera was denied / errored and the upload path is
  //     the active option.
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
      try {
        // eslint-disable-next-line no-console
        console.warn('[FARROWAY_SCAN] camera_permission_denied');
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

  // Revoke ObjectURL on unmount + when preview changes.
  useEffect(() => () => {
    if (preview) {
      try { URL.revokeObjectURL(preview); } catch { /* ignore */ }
    }
  }, [preview]);

  const isBackyard = experience === 'backyard';

  // ─── Live-camera handoff ─────────────────────────────────
  // Validates a captured/uploaded file and stages it as if it had
  // come from the hidden file input. Returns true on success so
  // the caller knows whether to keep the camera open or close.
  const acceptCapturedFile = useCallback((next) => {
    if (!next) return false;
    if (next.size > MAX_BYTES) {
      setError(tStrict('scan.error.tooLarge', 'That photo is too large. Try a smaller one.'));
      return false;
    }
    const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    if (!ALLOWED_TYPES.has(String(next.type || '').toLowerCase())) {
      setError(tStrict('scan.error.badType', 'Please use a JPEG, PNG, or WebP photo.'));
      return false;
    }
    if (preview) {
      try { URL.revokeObjectURL(preview); } catch { /* ignore */ }
    }
    let url = '';
    try { url = URL.createObjectURL(next); }
    catch { /* fall through */ }
    setPreview(url);
    setFile(next);
    setError('');
    return true;
  }, [preview]);

  const triggerPicker = useCallback(() => {
    setError('');
    // Live in-app camera. Falls back to the OS file picker
    // (with capture=environment) only if getUserMedia is
    // unavailable — LiveCameraScanner's own denied/error states
    // will show the "Use a saved photo" panel from inside the
    // overlay before we ever reach this branch.
    const supportsLive = typeof navigator !== 'undefined'
      && navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function';
    if (supportsLive) {
      setLiveCameraOpen(true);
      return;
    }
    try { inputRef.current?.click(); } catch { /* ignore */ }
  }, []);

  // Ref points at the latest continueAnalysis closure. The
  // handlers below are declared BEFORE continueAnalysis in the
  // component body, so we can't reference it directly in the
  // dep array (TDZ ReferenceError). The ref lets the handlers
  // call the freshest continueAnalysis at invocation time.
  const continueAnalysisRef = useRef(null);

  const onLiveCameraCaptured = useCallback(({ file: capturedFile }) => {
    setLiveCameraOpen(false);
    if (!capturedFile) return;
    // Stage the file in local state (so retake/error paths still
    // have access to it) AND fire analysis DIRECTLY via the ref
    // — skipping the wrapper preview flash. Without this, the
    // user saw the boxed wrapper for a render cycle before the
    // page advanced to the analyzing phase.
    const accepted = acceptCapturedFile(capturedFile);
    if (accepted && continueAnalysisRef.current) {
      let url = '';
      try { url = URL.createObjectURL(capturedFile); } catch { /* swallow */ }
      continueAnalysisRef.current(capturedFile, url);
    }
  }, [acceptCapturedFile]);

  const onLiveCameraFallbackUpload = useCallback((uploadedFile) => {
    setLiveCameraOpen(false);
    if (!uploadedFile) return;
    // Same auto-analysis path for the in-overlay gallery picker.
    // The user picked a photo → they expect analysis to start;
    // the wrapper preview is a double-tap that adds nothing.
    const accepted = acceptCapturedFile(uploadedFile);
    if (accepted && continueAnalysisRef.current) {
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

  const onFileChange = useCallback((e) => {
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
    // Revoke any previous preview URL.
    if (preview) {
      try { URL.revokeObjectURL(preview); } catch { /* ignore */ }
    }
    let url = '';
    try { url = URL.createObjectURL(next); }
    catch { /* fall through — preview will stay empty */ }
    setPreview(url);
    setFile(next);
    setError('');
  }, [preview]);

  const reset = useCallback(() => {
    setError('');
    if (preview) {
      try { URL.revokeObjectURL(preview); } catch { /* ignore */ }
    }
    setPreview(null);
    setFile(null);
    if (inputRef.current) {
      try { inputRef.current.value = ''; } catch { /* ignore */ }
    }
  }, [preview]);

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
      // Encode to base64 for the engine. If encoding fails we
      // still hand off the URL so the engine can run the
      // rule-based fallback.
      const b64 = await _readAsBase64(fileToUse).catch(() => null);
      // Downscale to a small dataURL for the history thumbnail.
      // Best-effort — if canvas isn't available the consumer
      // simply falls back to the placeholder emoji.
      const thumbnail = await _makeThumbnail(fileToUse).catch(() => null);
      if (typeof onContinue === 'function') {
        try {
          await onContinue({
            imageBase64: b64,
            imageUrl:    previewOverride || preview,
            thumbnail,
            file: fileToUse,
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

  const captureLabel = isBackyard
    ? tStrict('scan.takePlantPhoto', 'Take Plant Photo')
    : tStrict('scan.takeCropPhoto', 'Scan Crop');

  return (
    <div style={STYLES.wrap} data-testid="scan-capture" data-experience={experience}>
      {/* Full-screen live camera scanner. Renders nothing when
          liveCameraOpen is false and owns its own stream
          lifecycle so we never leave the camera hot. */}
      <LiveCameraScanner
        open={liveCameraOpen}
        facingHint="environment"
        onCancel={onLiveCameraCancel}
        onCaptured={onLiveCameraCaptured}
        onFallbackUpload={onLiveCameraFallbackUpload}
        testId="scan-live-camera"
      />
      {error ? <div style={STYLES.error}>{error}</div> : null}
      <div style={STYLES.preview} data-testid="scan-capture-preview">
        {preview ? (
          <img src={preview} alt="" style={STYLES.previewImg} />
        ) : (
          <span>
            {tStrict(
              'scan.previewPlaceholder',
              'Take a photo, or pick one from your gallery.'
            )}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileChange}
        style={{ display: 'none' }}
        data-testid="scan-capture-input"
      />
      {/* Robust journey §1: explicit gallery upload fallback.
          Same handler as the camera input but no `capture` hint
          so the OS shows the file picker directly. Self-hides
          when `journeyResilience` is off so existing surfaces
          stay identical. */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        style={{ display: 'none' }}
        data-testid="scan-capture-gallery-input"
      />
      {/* App Store launch audit §4.1: when the camera permission
          is explicitly denied, show a calm hint so the user
          knows the gallery button below is the path forward.
          Self-suppresses when permission isn't denied OR the
          Permissions API is unavailable (we never assume denied). */}
      {cameraDenied && !preview ? (
        <div
          style={{
            background: 'rgba(245,158,11,0.10)',
            border: '1px solid rgba(245,158,11,0.40)',
            borderRadius: 10,
            padding: '8px 12px',
            color: '#FDE68A',
            fontSize: 13,
            lineHeight: 1.45,
            marginBottom: 8,
          }}
          data-testid="scan-capture-camera-denied"
        >
          {tStrict('scan.cameraDenied',
            'Camera access is off. Use Upload from gallery below, or enable camera in your browser settings.')}
        </div>
      ) : null}
      <div style={STYLES.buttonsRow}>
        {/* When camera is denied, demote the camera button to
            secondary and promote the gallery button to primary. */}
        <button
          type="button"
          onClick={triggerPicker}
          style={cameraDenied && !preview
            ? { ...STYLES.btn, opacity: 0.7 }
            : STYLES.btn}
          data-testid="scan-capture-pick"
        >
          {preview ? tStrict('scan.retake', 'Retake') : captureLabel}
        </button>
        {!preview && (isFeatureEnabled('journeyResilience') || cameraDenied) ? (
          <button
            type="button"
            onClick={triggerGallery}
            style={cameraDenied
              ? { ...STYLES.btn, ...(STYLES.btnPrimary || {}) }
              : STYLES.btn}
            data-testid="scan-capture-gallery"
          >
            {tStrict('journey.scan.upload', 'Upload from gallery')}
          </button>
        ) : null}
        {preview ? (
          <button
            type="button"
            onClick={continueAnalysis}
            style={{ ...STYLES.btn, ...STYLES.btnPrimary, ...(busy ? STYLES.btnDisabled : null) }}
            disabled={busy}
            data-testid="scan-capture-analyze"
          >
            {busy
              ? tStrict('scan.analyzing', 'Analyzing\u2026')
              : tStrict('scan.analyze', 'Analyze')}
          </button>
        ) : null}
        {preview ? (
          <button type="button" onClick={reset} style={STYLES.btn} data-testid="scan-capture-cancel">
            {tStrict('common.cancel', 'Cancel')}
          </button>
        ) : null}
      </div>
      <p style={STYLES.helper}>
        {tStrict(
          'scan.captureHelper',
          'Tip: take a close-up in bright daylight. Aim at the affected leaf or area.'
        )}
      </p>
      {!preview && typeof onCancel === 'function' ? (
        <button type="button" onClick={onCancel} style={{ ...STYLES.btn, alignSelf: 'flex-start' }}>
          {tStrict('common.back', 'Back')}
        </button>
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
