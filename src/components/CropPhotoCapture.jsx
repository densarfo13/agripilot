import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { detectCrop } from '../lib/vision/cropDetector.js';
import { getCropLabel, getCropImage } from '../config/crops/index.js';
import { tSafe } from '../i18n/tSafe.js';

/**
 * CropPhotoCapture — foundation for "take a photo of your crop".
 *
 * What it does today
 *   1. Opens the device camera OR accepts a file upload
 *   2. Previews the selected image
 *   3. Runs the pluggable crop detector (heuristic placeholder for
 *      now; real classifier can be swapped in without changing this
 *      component)
 *   4. Shows a confirmation UX — farmer either accepts the detection,
 *      picks a different crop manually, or retakes the photo
 *   5. Calls back to parent with { cropKey, sourceFile, detection }
 *      so the selected crop can be updated in the farm record
 *
 * What it deliberately does NOT do yet
 *   • Disease / pest detection — that is `src/engine/cameraDiagnosis.js`
 *   • Uploading to server — the parent decides whether to persist
 *   • Any "your crop is 87% healthy" overclaim. Heuristic provider
 *     caps confidence at 0.45 so the UI always asks the farmer to
 *     confirm.
 *
 * Props
 *   onConfirm(result) — required. Receives:
 *     {
 *       cropKey:   canonical crop key farmer confirmed,
 *       sourceFile: the original File/Blob (for upstream upload),
 *       previewUrl: data URL (for instant UI updates),
 *       detection: raw detector result (for analytics / why-this),
 *       confirmed: true,
 *     }
 *   onCancel()       — optional. Called on close / back.
 *   manualOptions    — array of canonical keys to offer as a manual
 *                      picker when detection is low-confidence.
 *                      Default: the priority 12 crops.
 *   compact          — boolean; tightens the layout for modal use.
 */
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const DEFAULT_MANUAL = Object.freeze([
  'cassava', 'maize', 'rice', 'tomato',
  'onion', 'okra', 'pepper', 'potato',
  'banana', 'plantain', 'cocoa', 'mango',
]);

export default function CropPhotoCapture({
  onConfirm,
  onCancel,
  manualOptions = DEFAULT_MANUAL,
  compact = false,
}) {
  const { t, lang } = useTranslation();
  const inputRef = useRef(null);

  const [file, setFile]             = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError]           = useState('');
  const [detecting, setDetecting]   = useState(false);
  const [detection, setDetection]   = useState(null);
  const [mode, setMode]             = useState('idle'); // idle | ready | detecting | confirm | manual

  const reset = useCallback(() => {
    setFile(null); setPreviewUrl(null); setDetection(null);
    setMode('idle'); setError(''); setDetecting(false);
  }, []);

  const openPicker = () => inputRef.current && inputRef.current.click();

  const handleFile = async (e) => {
    setError('');
    const f = e && e.target && e.target.files && e.target.files[0];
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError(tSafe('cropPhoto.err.type', ''));
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError(tSafe('cropPhoto.err.size', ''));
      return;
    }
    setFile(f);

    // Preview
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(f);

    // Detect
    setDetecting(true);
    setMode('detecting');
    try {
      const result = await detectCrop(f, { language: lang });
      setDetection(result);
      setMode(result.best ? 'confirm' : 'manual');
    } catch (err) {
      // Shouldn't happen — detectCrop swallows provider errors — but
      // be defensive so we never leave the user stuck on a spinner.
      setError(tSafe('cropPhoto.err.detect', ''));
      setMode('manual');
    } finally {
      setDetecting(false);
    }
  };

  const handleConfirm = (cropKey) => {
    if (!cropKey) return;
    onConfirm && onConfirm({
      cropKey,
      sourceFile: file,
      previewUrl,
      detection,
      confirmed: true,
    });
  };

  // ─── Styles ─────────────────────────────────────────────────
  const styles = buildStyles(compact);

  return (
    <div style={styles.root} data-testid="crop-photo-capture">
      {/* Hidden file input — opens camera on mobile, picker on desktop */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: 'none' }}
        data-testid="crop-photo-input"
      />

      {/* ─── Idle / CTA ─────────────────────────────────────── */}
      {mode === 'idle' && (
        <div style={styles.ctaBlock}>
          <div style={styles.iconCircle} aria-hidden>📷</div>
          <h3 style={styles.title}>
            {tSafe('cropPhoto.title', '')}
          </h3>
          <p style={styles.sub}>
            {tSafe('cropPhoto.sub', '')}
          </p>
          <button type="button" style={styles.primaryBtn} onClick={openPicker}
                  data-testid="crop-photo-start">
            {tSafe('cropPhoto.takePhoto', '')}
          </button>
          <button type="button" style={styles.ghostBtn} onClick={openPicker}>
            {tSafe('cropPhoto.upload', '')}
          </button>
          {onCancel && (
            <button type="button" style={styles.ghostBtn} onClick={onCancel}>
              {tSafe('common.cancel', '')}
            </button>
          )}
        </div>
      )}

      {/* ─── Preview + detecting ───────────────────────────── */}
      {(mode === 'detecting' || mode === 'confirm' || mode === 'manual') && previewUrl && (
        <div style={styles.previewBlock}>
          <img src={previewUrl} alt="" style={styles.previewImg} data-testid="crop-photo-preview" />
          {detecting && (
            <div style={styles.detectingBar} data-testid="crop-photo-detecting">
              {tSafe('cropPhoto.detecting', '')}
            </div>
          )}
        </div>
      )}

      {/* ─── Confirm detected crop ─────────────────────────── */}
      {mode === 'confirm' && detection && detection.best && (
        <div style={styles.confirmBlock} data-testid="crop-photo-confirm">
          <p style={styles.sub}>
            {tSafe('cropPhoto.looksLike', '')}
          </p>
          <div style={styles.cropCard}>
            <img src={getCropImage(detection.best.cropKey)} alt=""
                 style={styles.cropThumb} />
            <div style={styles.cropText}>
              <div style={styles.cropLabel}>
                {getCropLabelSafe(detection.best.cropKey, lang)}
              </div>
              <div style={styles.cropConf}>
                {tSafe('cropPhoto.lowConfidence', '')}
              </div>
            </div>
          </div>
          <button type="button" style={styles.primaryBtn}
                  onClick={() => handleConfirm(detection.best.cropKey)}
                  data-testid="crop-photo-accept">
            {tSafe('cropPhoto.confirm', '')}
          </button>
          <button type="button" style={styles.ghostBtn}
                  onClick={() => setMode('manual')}
                  data-testid="crop-photo-different">
            {tSafe('cropPhoto.pickDifferent', '')}
          </button>
          <button type="button" style={styles.ghostBtn} onClick={reset}>
            {tSafe('cropPhoto.retake', '')}
          </button>
        </div>
      )}

      {/* ─── Manual fallback ────────────────────────────────── */}
      {mode === 'manual' && (
        <div style={styles.manualBlock} data-testid="crop-photo-manual">
          <p style={styles.sub}>
            {detection && detection.best
              ? (tSafe('cropPhoto.pickInsteadOf', ''))
              : (tSafe('cropPhoto.pickYours', ''))}
          </p>
          <div style={styles.grid}>
            {manualOptions.map((key) => (
              <button key={key} type="button" style={styles.chip}
                      onClick={() => handleConfirm(key)}
                      data-testid={`crop-photo-manual-${key}`}>
                <img src={getCropImage(key)} alt="" style={styles.chipImg} />
                <span>{getCropLabelSafe(key, lang)}</span>
              </button>
            ))}
          </div>
          <button type="button" style={styles.ghostBtn} onClick={reset}>
            {tSafe('cropPhoto.retake', '')}
          </button>
        </div>
      )}

      {error && (
        <div style={styles.error} role="alert" data-testid="crop-photo-error">
          {error}
        </div>
      )}
    </div>
  );
}

function buildStyles(compact) {
  const pad = compact ? 12 : 20;
  return {
    root: {
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: pad, color: '#E6F4EA',
    },
    ctaBlock: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 12, textAlign: 'center',
    },
    iconCircle: {
      width: 72, height: 72, borderRadius: '50%',
      background: 'rgba(34,197,94,0.12)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: 32,
    },
    title:      { margin: 0, fontSize: 18, fontWeight: 600 },
    sub:        { margin: 0, fontSize: 14, color: 'rgba(230,244,234,0.75)' },
    primaryBtn: {
      width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none',
      background: '#22C55E', color: '#0B1D34', fontWeight: 600, fontSize: 16,
      cursor: 'pointer',
    },
    ghostBtn: {
      width: '100%', padding: '10px 16px', borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.16)', background: 'transparent',
      color: '#E6F4EA', fontSize: 14, cursor: 'pointer',
    },
    previewBlock: { position: 'relative' },
    previewImg: {
      width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.08)',
    },
    detectingBar: {
      position: 'absolute', bottom: 8, left: 8, right: 8, padding: '6px 10px',
      background: 'rgba(11,29,52,0.85)', borderRadius: 8, fontSize: 13,
    },
    confirmBlock:
      { display: 'flex', flexDirection: 'column', gap: 10 },
    cropCard: {
      display: 'flex', gap: 12, padding: 10, alignItems: 'center',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
    },
    cropThumb: { width: 56, height: 56, borderRadius: 12, objectFit: 'cover' },
    cropText:  { flex: 1, minWidth: 0 },
    cropLabel: { fontSize: 16, fontWeight: 600 },
    cropConf:  { fontSize: 12, color: 'rgba(230,244,234,0.65)', marginTop: 2 },
    manualBlock: { display: 'flex', flexDirection: 'column', gap: 10 },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
    },
    chip: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 4, padding: 8, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.04)', color: '#E6F4EA', cursor: 'pointer',
      fontSize: 12,
    },
    chipImg: { width: 40, height: 40, borderRadius: 10, objectFit: 'cover' },
    error: {
      padding: 10, borderRadius: 10, fontSize: 13, color: '#FEE2E2',
      background: 'rgba(239,68,68,0.16)', border: '1px solid rgba(239,68,68,0.32)',
    },
  };
}
