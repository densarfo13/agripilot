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
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

const STYLES = {
  wrap: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
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
    background: 'rgba(255,255,255,0.06)',
    border: '1px dashed rgba(255,255,255,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    color: 'rgba(255,255,255,0.55)',
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
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    background: '#22C55E',
    color: '#0B1D34',
    border: 'none',
    fontWeight: 700,
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  helper: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
  },
  error: {
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(239,68,68,0.14)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#FCA5A5',
    fontSize: 13,
  },
};

export default function ScanCapture({ onContinue, onCancel, experience = 'generic' }) {
  // Subscribe to language change so labels refresh.
  useTranslation();

  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);   // ObjectURL
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Revoke ObjectURL on unmount + when preview changes.
  useEffect(() => () => {
    if (preview) {
      try { URL.revokeObjectURL(preview); } catch { /* ignore */ }
    }
  }, [preview]);

  const isBackyard = experience === 'backyard';

  const triggerPicker = useCallback(() => {
    setError('');
    try { inputRef.current?.click(); } catch { /* ignore */ }
  }, []);

  const onFileChange = useCallback((e) => {
    const next = e?.target?.files?.[0];
    if (!next) return;
    if (next.size > MAX_BYTES) {
      setError(tStrict('scan.error.tooLarge', 'That photo is too large. Try a smaller one.'));
      return;
    }
    if (!String(next.type || '').startsWith('image/')) {
      setError(tStrict('scan.error.notImage', 'Please pick an image file.'));
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

  const continueAnalysis = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      // Encode to base64 for the engine. If encoding fails we
      // still hand off the URL so the engine can run the
      // rule-based fallback.
      const b64 = await _readAsBase64(file).catch(() => null);
      if (typeof onContinue === 'function') {
        try {
          await onContinue({
            imageBase64: b64,
            imageUrl:    preview,
            file,
          });
        } catch { /* never propagate */ }
      }
    } finally {
      setBusy(false);
    }
  }, [file, preview, onContinue]);

  const captureLabel = isBackyard
    ? tStrict('scan.takePlantPhoto', 'Take Plant Photo')
    : tStrict('scan.takeCropPhoto', 'Scan Crop');

  return (
    <div style={STYLES.wrap} data-testid="scan-capture" data-experience={experience}>
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
      <div style={STYLES.buttonsRow}>
        <button type="button" onClick={triggerPicker} style={STYLES.btn} data-testid="scan-capture-pick">
          {preview ? tStrict('scan.retake', 'Retake') : captureLabel}
        </button>
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
