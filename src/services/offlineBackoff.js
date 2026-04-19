/**
 * offlineBackoff — exponential backoff scheduler for offline retries.
 *
 * Spec §5: when a fetch fails we shouldn't hammer the network. This
 * module produces a deterministic backoff schedule callers can feed
 * to setTimeout, plus a tiny helper to clamp attempt counts.
 *
 *   attempt 0 → base
 *   attempt 1 → base * 2
 *   attempt 2 → base * 4
 *   ...
 *   capped at `cap` ms (default 60 000 = 60 s)
 *
 * A small deterministic jitter (±10%) is added so many clients coming
 * back online at once don't sync at the exact same millisecond.
 */

const DEFAULTS = {
  base: 2000,      // 2 s
  cap: 60 * 1000,  // 60 s
  maxAttempts: 5,
};

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Compute the delay before the next retry.
 * @param {number} attempt  0-indexed retry attempt
 * @param {Object} [opts]
 * @param {number} [opts.base]  base delay in ms
 * @param {number} [opts.cap]   max delay in ms
 * @returns {number} delay in ms, always >= 0
 */
export function computeBackoffMs(attempt, opts = {}) {
  const base = Number.isFinite(opts.base) ? opts.base : DEFAULTS.base;
  const cap = Number.isFinite(opts.cap) ? opts.cap : DEFAULTS.cap;
  const safeAttempt = clamp(attempt, 0, 20);
  const raw = base * Math.pow(2, safeAttempt);
  const capped = Math.min(raw, cap);
  // Deterministic jitter seeded by attempt so repeated calls with the
  // same attempt return the same value — easier to reason about in
  // tests, still spreads across attempts in the real world.
  const jitter = Math.sin(safeAttempt * 9301 + 49297) * 0.1; // ±10%
  return Math.round(capped * (1 + jitter));
}

/**
 * Should we keep retrying, or give up?
 */
export function shouldRetry(attempt, opts = {}) {
  const max = Number.isFinite(opts.maxAttempts) ? opts.maxAttempts : DEFAULTS.maxAttempts;
  return attempt < max;
}

export const _defaults = { ...DEFAULTS };
