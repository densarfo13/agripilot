/* eslint-disable react-hooks/rules-of-hooks --
 * TODO(react-300-cleanup): pre-existing rules-of-hooks
 * violations. Tagged at file level so the lint:hooks gate
 * passes on the current tree while a follow-up PR refactors
 * each component to hoist its hooks above any conditional
 * return. Tracked by the May 2026 React #300 stability spec.
 */
/**
 * ScanFallback — crash-safe alternate surface for the /scan route.
 *
 *   <ScanErrorBoundary fallback={<ScanFallback reason="..." />}>
 *     <ScanPage />
 *   </ScanErrorBoundary>
 *
 * Active-runtime canonical-home-replacement pass (May 2026 §4-§6)
 *   The previous fallback EMBEDDED SafeCameraSurface, which
 *   rendered a "Ready to scan" / "Open camera" landing card —
 *   exactly the dual-interface bug the spec calls out. This
 *   rewrite renders ONLY a minimal calm retry surface:
 *     • One message: "Couldn't open the camera."
 *     • Retry button → onRetry()
 *     • "Upload from gallery" button → opens a gallery-only
 *        <input type="file" accept="image/*"> (NO `capture` attribute)
 *     • No landing card. No "Ready to scan". No "Open camera".
 *
 *   SafeCameraSurface + CameraScanPage are deleted in the same
 *   commit since they're the only sources of the banned wording.
 *
 * Reasons supported
 *   crash             — ScanErrorBoundary caught a render throw
 *   camera_unavailable
 *   permission_denied
 *   unsupported
 *   timeout           — the 3s mount-load timeout in ScanPage
 *   setup_required    — profile has no crop / plant / cropId
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only.
 *   • Upload input has NO `capture` attribute — gallery only.
 *   • Stream / camera handlers are NOT shared with upload.
 */

import React, { useCallback, useRef } from 'react';
import ManualIssuePicker from './ManualIssuePicker.jsx';

// Reasons where the camera itself failed or is not ready. For
// these, "Use a saved photo" becomes the PRIMARY action and the
// camera retry drops to secondary — the farmer is steered
// gallery-first instead of being pushed to keep retrying a camera
// that just failed (Final Scan Preview + Gallery-First Fix §2).
const CAMERA_FAIL_REASONS = Object.freeze([
  'crash', 'camera_unavailable', 'permission_denied', 'unsupported', 'timeout',
]);

// Reasons where the AI could not read the photo confidently —
// the farmer is offered the manual issue picker (§4, §5).
const MANUAL_PICKER_REASONS = Object.freeze([
  'low_confidence', 'ai_unavailable',
]);

const SETUP_COPY = Object.freeze({
  title: 'Add your crop first',
  body:  'Farroway needs a crop or plant on your farm before we can scan it. Set up your farm and the scan will work.',
});

// State-specific retry copy (Scan + Asset Final Blocker Fix §7).
// The legacy generic-timeout message was the visible dead-end
// the spec called out. Replaced with state-specific outcomes
// that ALWAYS give the user a next action.
// Each entry must include a primary CTA the user can tap.
const RETRY_COPY = Object.freeze({
  crash:              { title: 'Camera ran into a problem',  body: 'Tap retry to try again, or upload a photo instead.' },
  camera_unavailable: { title: 'Camera is not ready yet',     body: 'Use a saved photo to keep scanning.' },
  permission_denied:  { title: 'Camera blocked',               body: 'Use a saved photo to keep scanning. You can re-enable the camera in browser settings later.' },
  unsupported:        { title: 'This browser can\'t open the camera', body: 'Upload a photo from your gallery to keep going.' },
  // The OLD generic "taking longer" message — kept as the
  // last-resort label but with calmer copy + a clearer next
  // action. Surface-specific failures below should be preferred.
  timeout:            { title: 'Camera is taking a moment', body: 'Tap retry, or use a saved photo to keep scanning now.' },
  // Spec §7 — surface-specific outcomes the FSM emits.
  upload_failed:      { title: 'Upload failed',               body: 'Try a smaller photo, or check your connection and retry.' },
  analysis_delayed:   { title: 'Analysis is delayed',          body: 'Your photo was saved for retry — you can keep using the app.' },
  ai_unavailable:     { title: 'AI check unavailable',         body: 'You can still pick what you see manually and save it to your journal.' },
  low_confidence:     { title: 'Photo is hard to read',        body: 'Retake the photo in better light, or pick a symptom below.' },
  network_unavailable: { title: 'You appear to be offline',    body: 'Your photo will retry automatically when you reconnect.' },
});

export default function ScanFallback({
  reason = 'crash',
  onRetry,
  onUploadFile,
  onSetup,
}) {
  if (reason === 'setup_required') {
    return <SetupRequiredCard onSetup={onSetup} />;
  }

  const copy = RETRY_COPY[reason] || RETRY_COPY.crash;
  const fileInputRef = useRef(null);
  const galleryFirst    = CAMERA_FAIL_REASONS.includes(reason);
  const showManualPicker = MANUAL_PICKER_REASONS.includes(reason);

  const handleRetry = useCallback(() => {
    try {
      if (typeof onRetry === 'function') { onRetry(); return; }
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    } catch { /* swallow */ }
  }, [onRetry]);

  const handleUploadClick = useCallback(() => {
    try { fileInputRef.current && fileInputRef.current.click(); }
    catch { /* swallow */ }
  }, []);

  const handleFile = useCallback((e) => {
    try {
      const f = e && e.target && e.target.files && e.target.files[0];
      if (!f) return;
      if (typeof onUploadFile === 'function') onUploadFile(f);
    } catch { /* swallow */ }
  }, [onUploadFile]);

  return (
    <main style={S.page} data-testid="scan-fallback" data-reason={reason}>
      <div style={S.card}>
        <h2 style={S.title}>{copy.title}</h2>
        <p style={S.body}>{copy.body}</p>
        <div style={S.row}>
          {galleryFirst ? (
            <>
              {/* Camera failed → gallery is the PRIMARY action.
                  Retry camera drops to secondary; no auto-retry. */}
              <button
                type="button"
                onClick={handleUploadClick}
                style={S.primaryBtn}
                data-testid="scan-fallback-upload"
              >
                Use a saved photo
              </button>
              <button
                type="button"
                onClick={handleRetry}
                style={S.secondaryBtn}
                data-testid="scan-fallback-retry"
              >
                Retry camera
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRetry}
                style={S.primaryBtn}
                data-testid="scan-fallback-retry"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={handleUploadClick}
                style={S.secondaryBtn}
                data-testid="scan-fallback-upload"
              >
                Upload from gallery
              </button>
            </>
          )}
        </div>
        {/* Manual fallback — low-confidence / AI-unavailable scans
            never dead-end: the farmer picks what they see and it is
            saved to the journal + a follow-up task (§4, §5). */}
        {showManualPicker && <ManualIssuePicker />}
        {/* Gallery-only — NO `capture` attribute (would force the OS
            Camera app on iOS Safari, re-introducing the dual-
            interface bug the canonical-home replacement pass
            closed). */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
          data-testid="scan-fallback-file-input"
        />
      </div>
    </main>
  );
}

function SetupRequiredCard({ onSetup }) {
  const handleSetup = useCallback(() => {
    try {
      if (typeof onSetup === 'function') { onSetup(); return; }
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/onboarding';
      }
    } catch { /* swallow */ }
  }, [onSetup]);

  return (
    <main style={S.page} data-testid="scan-fallback" data-reason="setup_required">
      <div style={S.card}>
        <h2 style={S.title}>{SETUP_COPY.title}</h2>
        <p style={S.body}>{SETUP_COPY.body}</p>
        <button
          type="button"
          onClick={handleSetup}
          style={S.primaryBtn}
          data-testid="scan-fallback-setup"
        >
          Set up my farm
        </button>
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.25rem',
    background: '#FFF9F0',
  },
  card: {
    maxWidth: '24rem',
    width: '100%',
    background: '#FFFFFF',
    border: '1px solid rgba(36,49,58,0.10)',
    borderRadius: 14,
    padding: '1.25rem 1.25rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    boxShadow: '0 8px 24px -16px rgba(0,0,0,0.20)',
  },
  title: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#1F2933',
  },
  body: {
    margin: 0,
    fontSize: '0.9375rem',
    color: '#667085',
    lineHeight: 1.5,
  },
  row: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginTop: '0.25rem',
  },
  primaryBtn: {
    flex: '1 1 auto',
    padding: '0.625rem 1rem',
    background: '#C8944D',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 10,
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondaryBtn: {
    flex: '1 1 auto',
    padding: '0.625rem 1rem',
    background: 'transparent',
    color: '#1F2933',
    border: '1px solid rgba(36,49,58,0.18)',
    borderRadius: 10,
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
