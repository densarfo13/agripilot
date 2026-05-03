/**
 * onboardingTiming.js — measures `time_to_first_action_ms`.
 *
 * Stamps a single timestamp when the user starts the canonical
 * `FastOnboarding` flow, then consumes (and clears) it the first
 * time the user taps Done in `FirstActionGate`. The delta lands
 * on the `primary_action_completed` analytics payload as
 * `timeToFirstActionMs` so the team can measure activation
 * speed without needing a server-side join across events.
 *
 * Storage key: `farroway_onboarding_started_at` (ms-epoch number)
 *
 * Lifecycle
 * ─────────
 *   stampOnboardingStart()
 *     • Called from FastOnboarding mount.
 *     • Idempotent — if a stamp exists, do nothing (a returning
 *       user re-entering the flow shouldn't restart the clock).
 *
 *   consumeTimeToFirstAction()
 *     • Called from FirstActionGate's Done handler.
 *     • Reads the stamp, returns the delta in ms (or null when
 *       no stamp exists), and clears the stamp so subsequent
 *       Done taps don't keep firing the same metric.
 *     • Returns null on storage failure / corrupt value /
 *       no-stamp — caller simply omits the field on the payload.
 *
 * Privacy
 * ───────
 * The stamp itself is a millisecond timestamp; no PII. Cleared
 * on first consume, so even diagnostic exports never carry more
 * than one value at a time.
 *
 *   resetOnboardingTiming()
 *     • Test seam + privacy-clear hook (called by clearLocalActivityData).
 *
 * Never throws.
 */

const KEY = 'farroway_onboarding_started_at';

function _hasStorage() {
  try { return typeof localStorage !== 'undefined'; }
  catch { return false; }
}

/**
 * Stamp the start time on the first onboarding mount. Idempotent.
 */
export function stampOnboardingStart() {
  try {
    if (!_hasStorage()) return;
    if (localStorage.getItem(KEY)) return;       // already stamped
    localStorage.setItem(KEY, String(Date.now()));
  } catch { /* never propagate */ }
}

/**
 * Read + clear the stamp. Returns the time-to-first-action in
 * milliseconds, or null when no stamp exists / value is corrupt.
 */
export function consumeTimeToFirstAction() {
  try {
    if (!_hasStorage()) return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const startedAt = Number(raw);
    if (!Number.isFinite(startedAt) || startedAt <= 0) {
      localStorage.removeItem(KEY);
      return null;
    }
    const delta = Math.max(0, Date.now() - startedAt);
    localStorage.removeItem(KEY);
    return delta;
  } catch { return null; }
}

/**
 * Privacy / test reset — drops the stamp without consuming it.
 * Surface for `clearLocalActivityData()` to wire when a user
 * opts out of activity tracking.
 */
export function resetOnboardingTiming() {
  try {
    if (!_hasStorage()) return;
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({ KEY });
