import { trackEvent } from './api.js';
import { recordTelemetryStep } from './scanTraceRecorder.js';

// Analytics calls must never block the UI, never throw, never wait
// on a hung server. The bare `trackEvent` import handles the
// non-blocking + never-throws halves via its own try/catch +
// auth-signal short-circuit. This wrapper adds the third leg —
// a hard timeout via Promise.race so a stuck network can't
// silently pin a promise chain. Network failures are swallowed.
const _TRACK_TIMEOUT_MS = 5_000;

function _timeoutPromise(ms) {
  return new Promise((resolve) => {
    try { setTimeout(() => resolve({ skipped: true, reason: 'timeout' }), ms); }
    catch { resolve({ skipped: true, reason: 'timeout_setup' }); }
  });
}

// Pilot telemetry canon (P3) — when an internal event fires, ALSO emit the spec-canonical
// name so pilot dashboards read the exact vocabulary. Emitted via trackEvent directly
// (not safeTrackEvent) so aliases never re-alias. Only real events alias — nothing synthetic.
const _CANONICAL_ALIAS = {
  scan_cta_clicked: 'scan_opened',
  camera_opened: 'camera_started',
  image_captured: 'photo_selected',
  upload_started: 'image_upload_started',
  upload_completed: 'image_upload_completed',
  scan_api_called: 'scan_provider_started',
  scan_analyzed: 'scan_provider_completed',
  scan_failure: 'scan_provider_failed',
  scan_complete: 'scan_result_success',
  scan_unclear: 'scan_result_low_confidence',
  scan_failed: 'scan_result_failed',
  scan_review_requested: 'scan_saved_for_review',
  scan_offline_queued: 'scan_queued_for_retry',
};

export function safeTrackEvent(event, metadata) {
  // Scan Debug Harness tap — mirror scan_* events into window.__scanTrace. Never throws,
  // never blocks; does not touch the scan engine.
  try { if (typeof event === 'string' && event.indexOf('scan') !== -1) recordTelemetryStep(event, metadata); }
  catch { /* diagnostic must never break analytics */ }
  try {
    const canonical = typeof event === 'string' ? _CANONICAL_ALIAS[event] : null;
    if (canonical && canonical !== event) {
      const p = trackEvent(canonical, metadata);
      if (p && typeof p.then === 'function') Promise.race([p, _timeoutPromise(_TRACK_TIMEOUT_MS)]).catch(() => {});
    }
  } catch { /* canonical alias must never break analytics */ }
  try {
    const p = trackEvent(event, metadata);
    // Guard against the underlying call returning a non-thenable
    // (e.g. on an env where the request module was mocked out).
    if (!p || typeof p.then !== 'function') return;
    Promise.race([p, _timeoutPromise(_TRACK_TIMEOUT_MS)])
      .catch(() => {});
  } catch {
    // Analytics should never block the UI
  }
}
