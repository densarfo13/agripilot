/**
 * locationFlowState.js — pure view-state for the Home location flow.
 *
 * The "Use my location" button used to fire an async handler with NO visible
 * loading state and NO fallback when permission was denied/unavailable — a farmer
 * who denied location could get stuck with the same prompt and no forward path.
 * This maps the flow status to what the UI should show, so the farmer always has a
 * loading signal and, on failure, a guaranteed way forward.
 *
 * Pure, total, never throws. No DOM, no I/O — trivially testable.
 */
export const LOCATION_STATUS = Object.freeze({
  IDLE: 'idle',            // nothing in progress
  DETECTING: 'detecting',  // GPS request in flight → show loading
  DENIED: 'denied',        // permission denied / position unavailable → show fallback
  DISMISSED: 'dismissed',  // farmer chose "continue with general guidance" → hide
});

/**
 * @param {string} status one of LOCATION_STATUS (or any string).
 * @returns {{ mode:'hidden'|'loading'|'fallback', showLoading:boolean, showFallback:boolean }}
 */
export function locationFlowView(status) {
  const s = String(status == null ? '' : status).toLowerCase();
  if (s === LOCATION_STATUS.DETECTING) {
    return Object.freeze({ mode: 'loading', showLoading: true, showFallback: false });
  }
  if (s === LOCATION_STATUS.DENIED || s === 'unavailable' || s === 'error') {
    return Object.freeze({ mode: 'fallback', showLoading: false, showFallback: true });
  }
  // idle, dismissed, success, unknown → nothing to show.
  return Object.freeze({ mode: 'hidden', showLoading: false, showFallback: false });
}

/** Whether a fresh "Use my location" tap should be ignored (already detecting). */
export function shouldIgnoreLocationTap(status) {
  return String(status || '').toLowerCase() === LOCATION_STATUS.DETECTING;
}
