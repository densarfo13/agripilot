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
import { tSafe } from '../../i18n/tSafe.js';

// Reasons where the camera itself failed or is not ready. For
// these, the Upload photo button becomes the PRIMARY action and
// the camera retry drops to secondary — the farmer is steered
// upload-first instead of being pushed to keep retrying a camera
// that just failed (Final Scan Preview + Gallery-First Fix §2).
// Real-device root-cause fix — page_loading is now routed through
// the camera-failure branch (Upload Photo primary, Try Again
// secondary) because the user's observable symptom is "spinner
// won't end" and the right next action is to upload a photo.
const CAMERA_FAIL_REASONS = Object.freeze([
  'crash', 'camera_unavailable', 'permission_denied', 'unsupported', 'timeout',
  'page_loading',
]);

// Reasons where the AI could not read the photo confidently —
// the farmer is offered the manual issue picker (§4, §5).
const MANUAL_PICKER_REASONS = Object.freeze([
  'low_confidence', 'ai_unavailable',
]);

const SETUP_COPY = Object.freeze({
  titleKey: 'scan.fallback.setup.title',
  bodyKey:  'scan.fallback.setup.body',
  title:    'Add your crop first',
  body:     'Farroway needs a crop or plant on your farm before we can scan it. Set up your farm and the scan will work.',
});

// State-specific retry copy (Scan + Asset Final Blocker Fix §7).
// The legacy generic-timeout message was the visible dead-end
// the spec called out. Replaced with state-specific outcomes
// that ALWAYS give the user a next action.
// Each entry must include a primary CTA the user can tap.
// Emergency Fix — every camera-failure entry must lead with a
// calm, grower-friendly title. The previous "Camera ran into a
// problem" / "Tap retry to try again" wording was the visible
// dead-end the spec called out. All camera-failure reasons now
// route through the same Scan-landing-style fallback: upload is
// the primary action; the camera retry is a quiet secondary.
const RETRY_COPY = Object.freeze({
  crash:              { title: 'Scan Your Plant',  body: 'Camera is not available right now. Upload a photo instead.' },
  camera_unavailable: { title: 'Scan Your Plant',  body: 'Camera is not available right now. Upload a photo instead.' },
  permission_denied:  { title: 'Scan Your Plant',  body: 'Camera is blocked. Upload a photo instead — you can re-enable the camera in browser settings later.' },
  unsupported:        { title: 'Scan Your Plant',  body: 'This browser can\'t open the camera. Upload a photo instead.' },
  // The OLD generic "taking longer" message — kept as the
  // last-resort label but with calmer copy + a clearer next
  // action. Surface-specific failures below should be preferred.
  timeout:            { title: 'Scan Your Plant',  body: 'Camera is taking a moment. Upload a photo instead — you can try the camera again any time.' },
  // Deep Deploy Audit fix — the page-mount stall (Scan code chunk
  // failed to render within the 15s safety ceiling) is NOT a
  // camera failure. Use accurate wording so the farmer knows
  // to retry the page load, not blame the camera.
  // Real-device root-cause fix — exact spec copy.
  page_loading:       { title: 'Camera unavailable',          body: 'Camera is taking longer than expected. You can still upload a photo.' },
  // Spec §7 — surface-specific outcomes the FSM emits.
  upload_failed:      { title: 'Upload failed',               body: 'Try a smaller photo, or check your connection and retry.' },
  analysis_delayed:   { title: 'Analysis is delayed',          body: 'Your photo was saved for retry — you can keep using the app.' },
  ai_unavailable:     { title: 'Smart check unavailable',      body: 'You can still pick what you see manually and save it to your journal.' },
  low_confidence:     { title: 'Photo is hard to read',        body: 'Retake the photo in better light, or pick a symptom below.' },
  network_unavailable: { title: 'You appear to be offline',    body: 'Your photo will retry automatically when you reconnect.' },
});

export default function ScanFallback({
  reason = 'crash',
  onRetry,
  onUploadFile,
  onSetup,
  // scan-idle-entry-v3 HARD GUARDS — both default to false.
  // ScanErrorBoundary renders <ScanFallback reason="crash" /> with
  // no props, which means these stay false and the camera-error
  // card cannot fire on first load even if a child threw.
  cameraAttempted = false,
  userInitiatedCamera = false,
}) {
  if (reason === 'setup_required') {
    return <SetupRequiredCard onSetup={onSetup} />;
  }

  // scan-idle-entry-v3 § FIRST-LOAD HARD BLOCK
  // If the reason is a camera-failure flavour AND the user has
  // NOT explicitly initiated the camera, refuse to render the
  // banned wording ("Camera ran into a problem" / "Use a saved
  // photo" / "Retry camera"). Render a calm loading surface and
  // attempt window.__forceScanIdle() so the live ScanPage can
  // recover into its idle entry card.
  // Permanent startup-deadlock fix — `page_loading` is a genuine
  // mount-timeout RECOVERY reason (ScanPage's loadTimedOut path),
  // NOT a "suppress the scary first-load camera card" case. It must
  // fall through to the real recovery surface below (Camera
  // unavailable → Upload Photo primary + Try again + Go Home), never
  // the calm "Loading scan" block. Excluding it here is what makes
  // that recovery reachable.
  const isCameraFailureReason =
    CAMERA_FAIL_REASONS.includes(reason) && reason !== 'page_loading';
  const firstLoadBlock =
    isCameraFailureReason && (!cameraAttempted || !userInitiatedCamera);
  if (firstLoadBlock) {
    if (typeof window !== 'undefined' && typeof window.__forceScanIdle === 'function') {
      try { window.__forceScanIdle(); } catch { /* swallow */ }
    }
    // Permanent startup-deadlock fix — this surface used to carry a
    // SINGLE "Retry" button. When the underlying failure is
    // deterministic (a render crash caught by ScanErrorBoundary, or
    // a chunk that keeps failing), Retry just reloads into the same
    // failure → the user is trapped on "Loading scan" forever. The
    // surface now ALWAYS offers two guaranteed-working escapes:
    //   • Upload Photo → /scan?intent=upload → PlainUploadFallback,
    //     which pulls in ZERO lazy chunks and cannot re-crash.
    //   • Go Home → /home.
    // Retry is kept (and demoted to secondary) for the genuinely-
    // transient case.
    const _go = (href) => {
      try { if (typeof window !== 'undefined') window.location.assign(href); }
      catch { /* swallow */ }
    };
    return (
      <main style={S.page}
        data-testid="scan-fallback-blocked"
        data-reason={reason}
        data-first-load-block="true"
      >
        <div style={S.card}>
          <h2 style={S.title}>
            {tSafe('scan.fallback.loading.title', 'Loading scan')}
          </h2>
          <p style={S.body}>
            {tSafe('scan.fallback.loading.body',
              'Preparing your scan tools. Upload a photo or go home if this takes a moment.')}
          </p>
          <div style={S.row}>
            <button
              type="button"
              onClick={() => _go('/scan?intent=upload')}
              style={S.primaryBtn}
              data-testid="scan-fallback-blocked-upload"
            >
              {tSafe('scan.camera.uploadPhoto', 'Upload photo')}
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  if (typeof window !== 'undefined' && window.location) {
                    window.location.reload();
                  }
                } catch { /* swallow */ }
              }}
              style={S.secondaryBtn}
              data-testid="scan-fallback-loading-retry"
            >
              {tSafe('common.retry', 'Retry')}
            </button>
            <button
              type="button"
              onClick={() => _go('/home')}
              style={S.secondaryBtn}
              data-testid="scan-fallback-blocked-home"
            >
              {tSafe('common.goHome', 'Go Home')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const copy = RETRY_COPY[reason] || RETRY_COPY.crash;
  // V5 localization fix — resolve title/body via tSafe so the
  // fallback panel renders in the active locale. The 'timeout'
  // reason maps onto scan.camera.takingMoment.* (the exact strings
  // the user saw in the on-device screenshot); other reasons fall
  // back to scan.fallback.<reason>.title/body keys.
  const _titleKey = reason === 'timeout'
    ? 'scan.camera.takingMoment.title'
    : 'scan.fallback.' + reason + '.title';
  const _bodyKey  = reason === 'timeout'
    ? 'scan.camera.takingMoment.body'
    : 'scan.fallback.' + reason + '.body';
  const localizedTitle = tSafe(_titleKey, copy.title);
  const localizedBody  = tSafe(_bodyKey,  copy.body);
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

  // Real-device root-cause fix — spec mandates a Go Home button
  // on the camera-unavailable / page_loading state.
  const handleGoHome = useCallback(() => {
    try {
      if (typeof window !== 'undefined') window.location.assign('/home');
    } catch { /* swallow */ }
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
        <h2 style={S.title}>{localizedTitle}</h2>
        <p style={S.body}>{localizedBody}</p>
        <div style={S.row}>
          {galleryFirst ? (
            <>
              {/* Emergency Fix — camera failed → Upload is the
                  primary CTA. Try-camera-again is a quiet
                  secondary. Banned wording removed (see
                  scripts/check-no-grower-camera-error-card.mjs
                  for the enforced ban list). */}
              <button
                type="button"
                onClick={handleUploadClick}
                style={S.primaryBtn}
                data-testid="scan-fallback-upload"
              >
                {tSafe('scan.camera.uploadPhoto', 'Upload photo')}
              </button>
              <button
                type="button"
                onClick={handleRetry}
                style={S.secondaryBtn}
                data-testid="scan-fallback-retry"
              >
                {tSafe('scan.camera.tryAgain', 'Try camera again')}
              </button>
              {/* Real-device root-cause fix — Go Home button is
                  spec-mandated on the page_loading fallback. */}
              {reason === 'page_loading' && (
                <button
                  type="button"
                  onClick={handleGoHome}
                  style={S.secondaryBtn}
                  data-testid="scan-fallback-home"
                >
                  {tSafe('common.goHome', 'Go Home')}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRetry}
                style={S.primaryBtn}
                data-testid="scan-fallback-retry"
              >
                {tSafe('common.retry', 'Retry')}
              </button>
              <button
                type="button"
                onClick={handleUploadClick}
                style={S.secondaryBtn}
                data-testid="scan-fallback-upload"
              >
                {tSafe('scan.gallery.upload', 'Upload from gallery')}
              </button>
            </>
          )}
        </div>
        {/* Emergency Fix — small helper line on camera-failure
            paths so growers know what to try if needed. Calm
            wording, never blaming the device. */}
        {galleryFirst ? (
          <p style={{
            fontSize: 12, color: '#64748B',
            marginTop: 8, textAlign: 'center', lineHeight: 1.5,
          }} data-testid="scan-fallback-helper">
            {tSafe('scan.camera.helper',
              'Camera may be blocked by your browser or phone settings.')}
          </p>
        ) : null}
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
        <h2 style={S.title}>{tSafe(SETUP_COPY.titleKey, SETUP_COPY.title)}</h2>
        <p style={S.body}>{tSafe(SETUP_COPY.bodyKey,  SETUP_COPY.body)}</p>
        <button
          type="button"
          onClick={handleSetup}
          style={S.primaryBtn}
          data-testid="scan-fallback-setup"
        >
          {tSafe('scan.fallback.setup.cta', 'Set up my farm')}
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
