/**
 * src/runtime/authStartup/authStartupState.js — shared, SSR-safe
 * record of the auth-bootstrap lifecycle.
 *
 * AuthContext.bootstrap() stamps start / settled / timed-out here so
 * the __authStartupHealth() diagnostic can report, on-device, whether
 * the auth gate opened and how long it took. This module holds NO
 * React state and imports nothing — both the (React) AuthContext and
 * the (plain) health runtime read the same source of truth.
 *
 * Timing rule
 *   • markAuthBootstrapStart() is idempotent (first call wins) so a
 *     StrictMode double-invoke or a re-bootstrap doesn't reset the clock.
 *   • markAuthBootstrapSettled() is idempotent (first settle wins).
 *   • The hard-stop path calls markAuthBootstrapTimedOut() THEN
 *     markAuthBootstrapSettled() so timedOut + settled are both true.
 *
 * Never throws. No window dependency.
 */

const _now = () => {
  try { return Date.now(); } catch { return 0; }
};

const _state = {
  started:    false,
  startedAt:  null,
  settled:    false,
  settledAt:  null,
  timedOut:   false,
  timeoutMs:  8000,
};

export function markAuthBootstrapStart(timeoutMs) {
  try {
    if (_state.started) return;
    _state.started   = true;
    _state.startedAt = _now();
    if (typeof timeoutMs === 'number' && timeoutMs > 0) _state.timeoutMs = timeoutMs;
  } catch { /* swallow */ }
}

export function markAuthBootstrapSettled() {
  try {
    if (_state.settled) return;
    _state.settled   = true;
    _state.settledAt = _now();
  } catch { /* swallow */ }
}

export function markAuthBootstrapTimedOut() {
  try { _state.timedOut = true; } catch { /* swallow */ }
}

/** Frozen snapshot with a derived elapsed-ms. */
export function getAuthStartupSnapshot() {
  try {
    const startedAt = _state.startedAt;
    const settledAt = _state.settledAt;
    let ms = null;
    if (startedAt != null) {
      ms = Math.max(0, (settledAt != null ? settledAt : _now()) - startedAt);
    }
    return Object.freeze({
      authBootstrapStarted: _state.started,
      authBootstrapSettled: _state.settled,
      authBootstrapMs:      ms,
      timeoutMs:            _state.timeoutMs,
      timedOut:             _state.timedOut,
    });
  } catch {
    return Object.freeze({
      authBootstrapStarted: false,
      authBootstrapSettled: false,
      authBootstrapMs:      null,
      timeoutMs:            8000,
      timedOut:             false,
    });
  }
}
