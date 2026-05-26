/**
 * scanSessionId.js — race-condition guard for the scan pipeline.
 *
 *   import {
 *     startScanSession, getActiveScanSessionId,
 *     isStaleScanSession, endScanSession,
 *   } from 'src/core/scan/scanSessionId.js';
 *
 *   // At the start of each scan attempt:
 *   const sessionId = startScanSession();
 *
 *   // Inside async callbacks BEFORE applying any result:
 *   if (isStaleScanSession(sessionId)) return;   // user moved on
 *   applyResult(result);
 *
 * What it is — and is NOT
 * ───────────────────────
 *   The single in-process counter that names the currently-active
 *   scan attempt. Every async result the scan flow produces
 *   (classifier output, journal write, follow-up creation) MUST
 *   carry the sessionId that started its attempt — and consumers
 *   MUST drop it if the active session has moved on.
 *
 *   Without this, fast retake / quick-switch flows leak stale
 *   diagnoses into the new attempt — the "I retook the photo but
 *   the old result still showed" symptom the field reports.
 *
 *   It is NOT a state machine (`scanStateMachine.js` does that),
 *   NOT a result store, NOT a UUID generator (uses monotonic
 *   counter — stable across renders, no entropy required).
 *
 * Strict-rule audit
 *   • Pure-runtime. Never throws. SSR-safe.
 *   • Tests can `_resetScanSessionForTests()` to start fresh.
 */

let _counter = 0;
let _activeSessionId = null;

/**
 * Start a fresh scan session and return its id. Any prior
 * session becomes "stale" from the perspective of
 * `isStaleScanSession()`.
 */
export function startScanSession() {
  _counter += 1;
  _activeSessionId = `scan-session-${_counter}`;
  return _activeSessionId;
}

/**
 * The currently-active session id, or null when no scan is in
 * flight. UI consumers read this to render the right session's
 * preview / spinner.
 */
export function getActiveScanSessionId() {
  return _activeSessionId;
}

/**
 * `true` when the supplied id is NOT the currently-active session.
 * Use INSIDE async callbacks just before applying a result —
 * always returning early (and never throwing) is the contract.
 *
 * @param {string} sessionId
 */
export function isStaleScanSession(sessionId) {
  try {
    if (!sessionId) return true;
    if (_activeSessionId == null) return true;
    return sessionId !== _activeSessionId;
  } catch { return true; }
}

/**
 * End the active session (e.g. on result_ready, or on the
 * surface unmount). Subsequent `isStaleScanSession()` calls
 * return true until the next `startScanSession()`.
 */
export function endScanSession() {
  _activeSessionId = null;
}

/** Test-only reset — back to a known-empty state. */
export function _resetScanSessionForTests() {
  _counter = 0;
  _activeSessionId = null;
}

const _module = {
  startScanSession,
  getActiveScanSessionId,
  isStaleScanSession,
  endScanSession,
  _resetScanSessionForTests,
};
export default _module;
