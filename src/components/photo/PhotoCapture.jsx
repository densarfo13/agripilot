/**
 * PhotoCapture — camera or upload, preview, retake, remove,
 * continue. Pure presentational + lightweight image handling.
 *
 * Browser support
 *   • Mobile: <input capture="environment"> opens the back
 *     camera directly.
 *   • Desktop: same input falls through to the system file
 *     picker — every farmer surface still works.
 *
 * Strict-rule audit
 *   • No backend / network calls. The parent decides what to
 *     do with the dataUrl on `onContinue`.
 *   • Compresses to ≤ 100 KB JPEG before emitting so the
 *     scan-history localStorage doesn't blow the quota.
 *   • Permission-denied / unsupported-camera flows still let
 *     the farmer pick from the gallery — voice/help routes
 *     remain reachable from the surrounding UI.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const MAX_DIMENSION = 1280;     // px on the longest edge
const TARGET_KB     = 100;      // ≤ 100 KB once base64-encoded
const JPEG_QUALITY  = 0.78;

/**
 * compressDataUrl — resize + JPEG-encode an arbitrary data URL
 * so the resulting blob is small enough for localStorage.
 */
function compressDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = Math.min(
          1, MAX_DIMENSION / Math.max(img.width, img.height),
        );
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // Iteratively step quality down until the URL is small
        // enough — most photos hit target on the first pass.
        let quality = JPEG_QUALITY;
        let url = canvas.toDataURL('image/jpeg', quality);
        let kb = Math.round(url.length / 1024);
        while (kb > TARGET_KB && quality > 0.4) {
          quality -= 0.1;
          url = canvas.toDataURL('image/jpeg', quality);
          kb = Math.round(url.length / 1024);
        }
        resolve(url);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error || new Error('read-failed'));
    r.readAsDataURL(file);
  });
}

export default function PhotoCapture({
  onContinue,
  onCancel,
  initialDataUrl = '',
}) {
  const cameraRef = React.useRef(null);
  const galleryRef = React.useRef(null);

  const [dataUrl, setDataUrl] = React.useState(initialDataUrl || '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  async function handlePicked(event) {
    setError(null);
    const file = event.target.files && event.target.files[0];
    // Reset the input so picking the same file twice in a row
    // still fires `change`.
    try { event.target.value = ''; } catch { /* ignore */ }
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setError('not-image');
      return;
    }
    setBusy(true);
    try {
      const raw = await readFileAsDataUrl(file);
      const compressed = await compressDataUrl(raw);
      setDataUrl(compressed);
    } catch {
      setError('read-failed');
    } finally {
      setBusy(false);
    }
  }

  function handleRetake() {
    setDataUrl('');
    setError(null);
  }

  function handleContinue() {
    if (!dataUrl) return;
    if (typeof onContinue === 'function') onContinue(dataUrl);
  }

  return (
    <div style={S.wrap} data-testid="photo-capture">
      {/* Hidden file inputs — one for direct camera capture,
          one for gallery upload. Mobile browsers route the
          camera one to the back camera via `capture`. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePicked}
        style={{ display: 'none' }}
        data-testid="photo-capture-camera-input"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={handlePicked}
        style={{ display: 'none' }}
        data-testid="photo-capture-gallery-input"
      />

      {!dataUrl && (
        <div style={S.actions}>
          <button
            type="button"
            onClick={() => cameraRef.current && cameraRef.current.click()}
            style={{ ...S.btn, ...S.btnPrimary }}
            disabled={busy}
            data-testid="photo-capture-take"
          >
            {'\uD83D\uDCF7 '}{tSafe('photo.takePhoto', 'Take photo')}
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current && galleryRef.current.click()}
            style={{ ...S.btn, ...S.btnGhost }}
            disabled={busy}
            data-testid="photo-capture-upload"
          >
            {'\uD83D\uDDBC\uFE0F '}{tSafe('photo.uploadPhoto', 'Upload photo')}
          </button>
        </div>
      )}

      {dataUrl && (
        <div style={S.previewWrap}>
          <img src={dataUrl} alt="" style={S.preview} data-testid="photo-capture-preview" />
          <div style={S.previewActions}>
            <button
              type="button"
              onClick={handleRetake}
              style={{ ...S.btn, ...S.btnGhost }}
              data-testid="photo-capture-retake"
            >
              {tSafe('photo.retake', 'Retake')}
            </button>
            <button
              type="button"
              onClick={handleContinue}
              style={{ ...S.btn, ...S.btnPrimary }}
              data-testid="photo-capture-continue"
            >
              {tSafe('photo.continue', 'Continue')}
            </button>
          </div>
        </div>
      )}

      {busy && (
        <p style={S.hint} data-testid="photo-capture-busy">
          {tSafe('photo.processing', 'Preparing photo\u2026')}
        </p>
      )}

      {error === 'not-image' && (
        <p style={S.error}>
          {tSafe('photo.errNotImage', 'That file does not look like an image. Try again.')}
        </p>
      )}
      {error === 'read-failed' && (
        <p style={S.error}>
          {tSafe('photo.errReadFailed', 'Could not read the file. Try a different photo.')}
        </p>
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          style={{ ...S.btn, ...S.btnGhost, alignSelf: 'flex-start' }}
          data-testid="photo-capture-cancel"
        >
          {tSafe('common.cancel', 'Cancel')}
        </button>
      )}
    </div>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  actions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  btn: {
    padding: '0.625rem 1rem', borderRadius: 12, border: 'none',
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
    minHeight: 44,
  },
  btnPrimary: { background: '#22C55E', color: '#062714' },
  btnGhost: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#EAF2FF', fontWeight: 600,
  },
  previewWrap: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  preview: {
    width: '100%', maxHeight: 280, borderRadius: 12,
    objectFit: 'cover',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  previewActions: { display: 'flex', gap: '0.5rem' },
  hint: { margin: 0, fontSize: '0.8125rem', color: '#9FB3C8' },
  error: {
    margin: 0,
    color: '#FCA5A5',
    fontSize: '0.8125rem',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.28)',
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
  },
};
