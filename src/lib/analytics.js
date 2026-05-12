import { trackEvent } from './api.js';

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

export function safeTrackEvent(event, metadata) {
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
