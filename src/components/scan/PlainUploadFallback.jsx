/**
 * PlainUploadFallback — the last-resort, dependency-free scan upload
 * surface (spec §4).
 *
 *   <PlainUploadFallback onAnalyzed={(result) => ...} />
 *
 * Contract
 * ────────
 * This component MUST render even when everything else has failed:
 *   • the live-camera chunk failed to load
 *   • the ScanHub safe-shell chunk failed to load
 *   • the ScanRuntime / scan provider is unavailable
 *   • the user denied camera permission
 *
 * To guarantee that, it has ZERO lazy imports and ZERO scan-runtime
 * imports at module load. It is a plain <input type="file"
 * accept="image/*"> + a calm message. Only AFTER the user picks a
 * file does it dynamically import the analysis engine. If that
 * import (or the analysis) fails, the photo is saved locally
 * best-effort and an HONEST message is shown — never a fake success.
 *
 * It deliberately does NOT use the camera (`capture` attribute is
 * omitted) so it can never re-trigger the iOS getUserMedia path.
 *
 * Strict-rule audit
 *   • Inline styles only. SSR-safe (browser APIs guarded).
 *   • No lazy() / React.lazy / Suspense. No ScanRuntime import at
 *     module load — analysis is dynamic-imported post-selection.
 *   • Never throws. Never fakes a result.
 */

import React, { useCallback, useRef, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Best-effort local stash so a failed analysis still preserves the
// farmer's photo for a later retry. Capped + namespaced; never PII.
function _stashImageLocally(dataUrl) {
  return _safe(() => {
    if (typeof localStorage === 'undefined' || typeof dataUrl !== 'string') return false;
    // Keep only the most recent pending upload to bound storage.
    const rec = JSON.stringify({ dataUrl, at: new Date().toISOString() });
    // ~5MB localStorage ceiling — skip the stash for very large
    // images rather than throwing a QuotaExceededError.
    if (rec.length > 3_500_000) return false;
    localStorage.setItem('farroway_pending_upload_v1', rec);
    return true;
  }, false);
}

export default function PlainUploadFallback({
  onAnalyzed,
  title,
  body,
}) {
  const inputRef = useRef(null);
  // 'idle' | 'analyzing' | 'done' | 'saved_offline' | 'error'
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');

  const openPicker = useCallback(() => {
    try { inputRef.current && inputRef.current.click(); }
    catch { /* swallow — picker is best-effort */ }
  }, []);

  const goHome = useCallback(() => {
    try { if (typeof window !== 'undefined') window.location.assign('/home'); }
    catch { /* swallow */ }
  }, []);

  const handleFile = useCallback(async (ev) => {
    const file = _safe(() => ev && ev.target && ev.target.files && ev.target.files[0], null);
    // Reset the input so re-picking the same file fires onChange again.
    try { if (ev && ev.target) ev.target.value = ''; } catch { /* ignore */ }
    if (!file) return;

    setState('analyzing');
    setMessage('');

    // Read the file to a dataURL with the platform FileReader (no deps).
    const dataUrl = await new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => resolve(
          (e && e.target && typeof e.target.result === 'string') ? e.target.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      } catch { resolve(null); }
    });

    if (!dataUrl) {
      setState('error');
      setMessage(tSafe('scan.plainUpload.readFailed',
        'That photo could not be read. Please choose a different photo.'));
      return;
    }
    const base64 = _safe(() => dataUrl.split(',')[1] || '', '');

    // ── Dynamic-import the analysis engine ONLY now (post-selection).
    // A failed import here is the "scan provider unavailable" path:
    // we keep the photo and tell the truth.
    let analyzed = null;
    let importOk = false;
    try {
      const mod = await import('../../core/scanDetectionEngine.js');
      importOk = !!(mod && typeof mod.analyzeScan === 'function');
      if (importOk) {
        analyzed = await mod.analyzeScan({
          imageBase64: base64,
          imageUrl:    dataUrl,
          cropId:      null,
          cropName:    null,
          plantName:   null,
          country:     null,
          region:      null,
          experience:  'generic',
          activeExperience: 'generic',
          weather:     null,
        });
      }
    } catch {
      importOk = false;
    }

    if (importOk && analyzed) {
      // Best-effort persist to the local journal so the result is not
      // lost if the host page never mounted. Dynamic import — never
      // a hard dependency of this fallback.
      try {
        const store = await import('../../lib/scan/scanHistoryStore.js');
        if (store && typeof store.saveScanUseful === 'function') {
          store.saveScanUseful(analyzed, { experience: 'generic' });
        }
      } catch { /* journal save is best-effort */ }
      setState('done');
      setMessage(tSafe('scan.plainUpload.done',
        'Photo analyzed. Open Home to see your result and follow-up.'));
      try { if (typeof onAnalyzed === 'function') onAnalyzed(analyzed); }
      catch { /* never throw from a callback */ }
      return;
    }

    // Analysis unavailable — save locally + honest message. NO fake
    // success, NO fabricated diagnosis.
    const stashed = _stashImageLocally(dataUrl);
    setState(stashed ? 'saved_offline' : 'error');
    setMessage(stashed
      ? tSafe('scan.plainUpload.savedOffline',
          'We saved your photo. The scan service is unavailable right '
          + 'now — it will be analyzed when you reconnect.')
      : tSafe('scan.plainUpload.unavailable',
          'The scan service is unavailable right now. Please check your '
          + 'connection and try again.'));
  }, [onAnalyzed]);

  return (
    <main style={S.page} data-testid="plain-upload-fallback" data-state={state}>
      <div style={S.card}>
        <div style={S.icon} aria-hidden="true">🖼</div>
        <h1 style={S.title}>
          {title || tSafe('scan.plainUpload.title', 'Scan Your Plant')}
        </h1>
        <p style={S.body}>
          {body || tSafe('scan.plainUpload.body',
            'Upload a clear photo of the affected leaf or plant and '
            + 'we’ll suggest what it might be.')}
        </p>

        {/* PRIMARY action — plain file input, no camera, no lazy chunk. */}
        <button
          type="button"
          style={S.primary}
          onClick={openPicker}
          disabled={state === 'analyzing'}
          data-testid="plain-upload-choose"
        >
          {state === 'analyzing'
            ? tSafe('scan.plainUpload.analyzing', 'Analyzing…')
            : tSafe('scan.plainUpload.choose', 'Upload Photo')}
        </button>

        <button
          type="button"
          style={S.ghost}
          onClick={goHome}
          data-testid="plain-upload-home"
        >
          {tSafe('common.goHome', 'Go Home')}
        </button>

        {message ? (
          <p style={S.status} role="status" data-testid="plain-upload-status">
            {message}
          </p>
        ) : null}

        {/* Gallery-only — NO `capture` attribute so iOS Safari never
            forces the OS camera app (which would re-introduce the
            getUserMedia path this fallback exists to bypass). */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
          data-testid="plain-upload-input"
        />
      </div>
    </main>
  );
}

const C = {
  bg:     '#F6F1E7',
  ink:    '#1F2933',
  accent: '#16A34A',
  border: 'rgba(36,49,58,0.10)',
  inkDim: 'rgba(36,49,58,0.65)',
};
const S = {
  page: {
    minHeight: '100dvh', background: C.bg, color: C.ink,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    maxWidth: 420, width: '100%', textAlign: 'center',
    padding: '28px 24px', background: '#FFFFFF',
    borderRadius: 16, border: '1px solid ' + C.border,
    boxShadow: '0 8px 22px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  icon:   { fontSize: 40 },
  title:  { fontSize: 22, fontWeight: 800, margin: 0, color: C.ink },
  body:   { fontSize: 14, color: C.inkDim, margin: 0, lineHeight: 1.5 },
  primary: {
    appearance: 'none', border: 'none',
    padding: '14px 18px', borderRadius: 14,
    background: C.accent, color: '#FFFFFF',
    fontSize: 16, fontWeight: 700, cursor: 'pointer',
    minHeight: 48, marginTop: 6, fontFamily: 'inherit',
  },
  ghost: {
    appearance: 'none',
    padding: '11px 18px', borderRadius: 14,
    border: '1px solid ' + C.border, background: 'transparent',
    color: C.inkDim, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
  },
  status: {
    fontSize: 13, color: C.inkDim, margin: '4px 0 0', lineHeight: 1.5,
  },
};
