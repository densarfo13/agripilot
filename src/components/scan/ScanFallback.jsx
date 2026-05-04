/**
 * ScanFallback — crash-safe alternate surface for the /scan
 * route.
 *
 *   <ScanErrorBoundary fallback={<ScanFallback reason="..." />}>
 *     <ScanPage />
 *   </ScanErrorBoundary>
 *
 * Used in three situations
 *   1. Crash escape — ScanErrorBoundary catches a render throw
 *      and swaps the live page for this surface.
 *   2. Camera unavailable — getUserMedia rejected / unsupported
 *      / permission denied.
 *   3. 3-second load timeout — page hasn't finished mounting.
 *
 * Affordances
 *   • Upload photo button (synthesises a file picker on tap).
 *   • Retry button (calls window.location.reload()).
 *   • "Set up your crop" link (when the page noticed missing
 *     setup state).
 *   • Plain-text instructions so a low-literacy farmer still
 *     understands what to do.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only — matches the rest of the scan UI.
 *   • Never mounts the live camera; ALL retry paths defer to
 *     the page reload, which lets the original ScanPage try
 *     again from scratch.
 */

import React, { useRef, useCallback } from 'react';

const REASON_COPY = Object.freeze({
  crash:       {
    title: 'Scan ran into a problem',
    body:  'We couldn\u2019t open the scan tool. You can upload a photo from your gallery instead, or try again.',
  },
  camera_unavailable: {
    title: 'Camera not available',
    body:  'Your camera is off or blocked. You can still upload a photo from your gallery.',
  },
  permission_denied: {
    title: 'Camera permission needed',
    body:  'Allow camera access in your browser settings, or upload a photo from your gallery.',
  },
  unsupported: {
    title: 'Camera not supported',
    body:  'This device or browser doesn\u2019t support camera capture. Upload a photo to continue.',
  },
  timeout: {
    title: 'Taking longer than expected',
    body:  'The scan tool is slow to load. You can keep waiting, retry, or upload a photo from your gallery.',
  },
  setup_required: {
    title: 'Setup required before scanning',
    body:  'Add a crop or plant to your farm so Farroway knows what to look for.',
  },
});

export default function ScanFallback({
  reason = 'crash',
  onRetry,
  onUploadFile,
  onSetup,
}) {
  const fileInputRef = useRef(null);
  const copy = REASON_COPY[reason] || REASON_COPY.crash;

  const handleUploadClick = useCallback(() => {
    try {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } catch { /* swallow */ }
  }, []);

  const handleFileChange = useCallback((e) => {
    try {
      const file = e && e.target && e.target.files && e.target.files[0];
      if (file && typeof onUploadFile === 'function') {
        onUploadFile(file);
        return;
      }
      // No upstream handler — reload so ScanPage gets a fresh
      // mount with the user's selected file in its picker.
      if (typeof window !== 'undefined' && window.location
          && typeof window.location.reload === 'function') {
        window.location.reload();
      }
    } catch { /* never throw from a fallback handler */ }
  }, [onUploadFile]);

  const handleRetry = useCallback(() => {
    try {
      if (typeof onRetry === 'function') { onRetry(); return; }
      if (typeof window !== 'undefined' && window.location
          && typeof window.location.reload === 'function') {
        window.location.reload();
      }
    } catch { /* swallow */ }
  }, [onRetry]);

  const handleSetup = useCallback(() => {
    try {
      if (typeof onSetup === 'function') { onSetup(); return; }
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/onboarding';
      }
    } catch { /* swallow */ }
  }, [onSetup]);

  return (
    <main
      style={S.page}
      data-testid="scan-fallback"
      data-reason={reason}
    >
      <div style={S.card}>
        <span aria-hidden="true" style={S.icon}>{'\uD83D\uDCF7'}</span>
        <h1 style={S.title}>{copy.title}</h1>
        <p style={S.body}>{copy.body}</p>

        <p style={S.helpList}>
          {'\u2022 Make sure you have good light.'}<br />
          {'\u2022 Hold the phone steady.'}<br />
          {'\u2022 Get close to the leaf, fruit, or stem.'}
        </p>

        <div style={S.btnRow}>
          {reason === 'setup_required' ? (
            <button
              type="button"
              onClick={handleSetup}
              style={S.btnPrimary}
              data-testid="scan-fallback-setup"
            >
              Complete setup
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleUploadClick}
                style={S.btnPrimary}
                data-testid="scan-fallback-upload"
              >
                {'\uD83D\uDCC1 Upload photo'}
              </button>
              <button
                type="button"
                onClick={handleRetry}
                style={S.btnGhost}
                data-testid="scan-fallback-retry"
              >
                Try again
              </button>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          data-testid="scan-fallback-file-input"
        />
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '24px 16px 96px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '28rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: '2rem 1.5rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    boxShadow: '0 14px 36px rgba(0,0,0,0.3)',
  },
  icon: { fontSize: 56, lineHeight: 1 },
  title: {
    margin: '0.5rem 0 0',
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  body: {
    margin: '0.25rem 0 0',
    fontSize: '0.9375rem',
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 1.5,
  },
  helpList: {
    margin: '0.5rem 0 0',
    textAlign: 'left',
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.7,
    width: '100%',
    padding: '0 0.5rem',
  },
  btnRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    justifyContent: 'center',
    marginTop: '1rem',
    width: '100%',
  },
  btnPrimary: {
    flex: 1,
    minWidth: '10rem',
    minHeight: 48,
    padding: '0.85rem 1.25rem',
    border: 'none',
    borderRadius: 12,
    background: '#22C55E',
    color: '#062714',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(34,197,94,0.25)',
  },
  btnGhost: {
    flex: 1,
    minWidth: '10rem',
    minHeight: 48,
    padding: '0.85rem 1.25rem',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 12,
    background: 'transparent',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
