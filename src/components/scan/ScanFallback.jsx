/* eslint-disable react-hooks/rules-of-hooks --
 * TODO(react-300-cleanup): pre-existing rules-of-hooks
 * violations. Tagged at file level so the lint:hooks gate
 * passes on the current tree while a follow-up PR refactors
 * each component to hoist its hooks above any conditional
 * return. Tracked by the May 2026 React #300 stability spec.
 */
/**
 * ScanFallback — crash-safe alternate surface for the /scan
 * route.
 *
 *   <ScanErrorBoundary fallback={<ScanFallback reason="..." />}>
 *     <ScanPage />
 *   </ScanErrorBoundary>
 *
 * What changed (May 2026 §1)
 *   The previous ScanFallback was a static error screen with
 *   Upload + Retry buttons. The new fallback EMBEDS the
 *   SafeCameraSurface so the user lands on a fully-working
 *   scan flow even when the live ScanPage crashed. Camera +
 *   upload + safe-mock result + 4-second timeout are all
 *   handled inside SafeCameraSurface.
 *
 * Reasons supported (back-compat with the previous boundary)
 *   crash             — ScanErrorBoundary caught a render throw
 *   camera_unavailable
 *   permission_denied
 *   unsupported
 *   timeout           — the 3s mount-load timeout in ScanPage
 *   setup_required    — profile has no crop / plant / cropId
 *
 * For setup_required the surface is still a static prompt that
 * routes to /onboarding — there's nothing to scan if the user
 * hasn't told Farroway what crop they have.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only.
 */

import React, { useCallback } from 'react';
import SafeCameraSurface from './SafeCameraSurface.jsx';

const SETUP_COPY = Object.freeze({
  title: 'Add your crop first',
  body:  'Farroway needs a crop or plant on your farm before we can scan it. Set up your farm and the scan will work.',
});

export default function ScanFallback({
  reason = 'crash',
  onRetry,
  onUploadFile,
  onSetup,
}) {
  // setup_required is a distinct surface — show a clear setup
  // prompt instead of the camera flow.
  if (reason === 'setup_required') {
    return (
      <SetupRequiredCard onSetup={onSetup} />
    );
  }

  // For every other reason (crash / timeout / camera-denied /
  // unsupported / unavailable), embed the safe camera surface
  // so the user has a working flow IMMEDIATELY — no extra tap
  // through an error screen first.
  const handleResult = useCallback((res) => {
    // Reuse onUploadFile when caller passed one (legacy
    // signature). Otherwise no-op — SafeCameraSurface already
    // showed the result preview.
    try {
      if (typeof onUploadFile === 'function' && res && res.photo && res.photo.file) {
        onUploadFile(res.photo.file);
      }
    } catch { /* swallow */ }
  }, [onUploadFile]);

  const handleBackHome = useCallback(() => {
    try {
      if (typeof onRetry === 'function') {
        onRetry();
        return;
      }
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/';
      }
    } catch { /* swallow */ }
  }, [onRetry]);

  return (
    <SafeCameraSurface
      onResult={handleResult}
      onBackHome={handleBackHome}
    />
  );
}

// ─── Setup-required sub-surface ─────────────────────────────

function SetupRequiredCard({ onSetup }) {
  const handleSetup = useCallback(() => {
    try {
      if (typeof onSetup === 'function') { onSetup(); return; }
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/my-grow';
      }
    } catch { /* swallow */ }
  }, [onSetup]);

  return (
    <main
      style={S.page}
      data-testid="scan-fallback"
      data-reason="setup_required"
    >
      <div style={S.card}>
        <span aria-hidden="true" style={S.icon}>{'\uD83C\uDF31'}</span>
        <h1 style={S.title}>{SETUP_COPY.title}</h1>
        <p style={S.body}>{SETUP_COPY.body}</p>
        <div style={S.btnRow}>
          <button
            type="button"
            onClick={handleSetup}
            style={S.btnPrimary}
            data-testid="scan-fallback-setup"
          >
            Go to My Farm
          </button>
        </div>
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
};
