/**
 * feedbackGate.js — usage counter + show-feedback gate for the
 * lightweight feedback widgets.
 *
 * Behaviour
 * ─────────
 *   • A counter increments on every "meaningful use" — typically
 *     a Today's Plan / Home page view. The counter persists across
 *     sessions in localStorage.
 *   • `shouldShowFeedback()` returns true when:
 *       - the counter is at least MIN_USES (default 2), AND
 *       - the widget hasn't been shown in the last 24 hours, AND
 *       - the call site has decided this is a meaningful surface.
 *   • `markFeedbackShown()` stamps "now" so subsequent gates
 *     refuse for 24h. Call AFTER deciding to render the widget;
 *     don't pre-stamp.
 *
 * Spec safety rules
 *   • Never blocks the user.
 *   • Never shows feedback on first app open (counter starts at 0;
 *     the calling page increments it AFTER mount, then checks).
 *   • Never shows more than once per 24h.
 *   • Never throws.
 *
 * Storage keys
 *   farroway_usage_counter
 *   farroway_feedback_last_shown    (ms-epoch string)
 */

const COUNTER_KEY    = 'farroway_usage_counter';
const LAST_SHOWN_KEY = 'farroway_feedback_last_shown';
const ONE_DAY_MS     = 24 * 60 * 60 * 1000;
const MIN_USES       = 2;

function _readNum(key) {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

function _writeNum(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value));
  } catch { /* quota / private mode */ }
}

/**
 * Bump the meaningful-use counter. Call once per "real" page
 * visit (e.g. a Today's Plan view), NOT on every component
 * mount.
 *
 * @returns {number}  the new counter value
 */
export function incrementUsageCounter() {
  const next = _readNum(COUNTER_KEY) + 1;
  _writeNum(COUNTER_KEY, next);
  return next;
}

/** Read the current counter without bumping. */
export function getUsageCounter() {
  return _readNum(COUNTER_KEY);
}

/**
 * @returns {boolean}  whether a feedback widget should render now.
 */
export function shouldShowFeedback() {
  const count = _readNum(COUNTER_KEY);
  if (count < MIN_USES) return false;
  const lastShown = _readNum(LAST_SHOWN_KEY);
  const now = Date.now();
  if (lastShown && now - lastShown < ONE_DAY_MS) return false;
  return true;
}

/** Stamp "shown at now" so the next 24h refuses. */
export function markFeedbackShown() {
  _writeNum(LAST_SHOWN_KEY, Date.now());
}

/**
 * Reset the gate — useful for tests / debug screens. Does NOT
 * touch the analytics store.
 */
export function resetFeedbackGate() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(COUNTER_KEY);
    localStorage.removeItem(LAST_SHOWN_KEY);
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({
  COUNTER_KEY, LAST_SHOWN_KEY, ONE_DAY_MS, MIN_USES,
});
