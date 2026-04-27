/**
 * missedDay.js — detect whether the Today screen should switch
 * to the gentle "welcome back" recovery flow.
 *
 *   detectMissedDay(opts?)
 *     -> { missedDays, needsRecovery, lastCompletionAt }
 *
 * Logic
 *   * Reads the last completion timestamp from the
 *     farroway_progress mirror (synchronous; offline-safe).
 *   * missedDays is the integer count of UTC days between
 *     `lastCompletionAt` and `now`.
 *   * needsRecovery is true when missedDays >= 2.
 *   * A brand-new farmer (no completions yet) is NOT in
 *     recovery - we'd rather not greet them with
 *     "welcome back" before they've ever finished a task.
 *
 * Strict-rule audit
 *   * works offline (localStorage mirror only)
 *   * never throws (try/catch on every read)
 *   * non-shaming: callers render a supportive message + a
 *     simple recovery task; this helper only returns the
 *     signal, no copy
 *   * lightweight: O(1) read of a small JSON blob
 */

const PROGRESS_KEY = 'farroway_progress';
const MS_PER_DAY   = 86_400_000;

const DEFAULTS = Object.freeze({
  /** missedDays threshold above which needsRecovery flips. */
  RECOVERY_THRESHOLD: 2,
});

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _readProgress() {
  const raw = _safeGet(PROGRESS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.done)) return null;
    return parsed;
  } catch { return null; }
}

function _lastCompletionMs(progress) {
  if (!progress || !Array.isArray(progress.done) || progress.done.length === 0) return null;
  let last = -Infinity;
  for (const entry of progress.done) {
    if (!entry) continue;
    const t = (typeof entry.date === 'string') ? Date.parse(entry.date) : Number(entry.date);
    if (Number.isFinite(t) && t > last) last = t;
  }
  return Number.isFinite(last) ? last : null;
}

/**
 * UTC midnight at the start of the day containing `ms`.
 * Used so a 23:50 completion + a 00:10 boot the next day
 * count as 1 day apart, not 0.
 */
function _utcMidnight(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * detectMissedDay({ now?, threshold? })
 *
 * opts:
 *   now        ms epoch override for tests
 *   threshold  override RECOVERY_THRESHOLD (default 2)
 */
export function detectMissedDay(opts = {}) {
  const now = (opts && Number.isFinite(Number(opts.now)))
    ? Number(opts.now) : Date.now();
  const threshold = (opts && Number.isFinite(Number(opts.threshold)))
    ? Number(opts.threshold) : DEFAULTS.RECOVERY_THRESHOLD;

  const progress = _readProgress();
  const lastMs   = _lastCompletionMs(progress);

  // Brand-new farmer (no completions). Don't shame them with
  // "welcome back" - just let the normal Today flow render.
  if (lastMs == null) {
    return Object.freeze({
      missedDays: 0,
      needsRecovery: false,
      lastCompletionAt: null,
      reason: 'never_completed',
    });
  }

  const last  = _utcMidnight(lastMs);
  const today = _utcMidnight(now);
  const diff  = Math.max(0, Math.floor((today - last) / MS_PER_DAY));

  return Object.freeze({
    missedDays:        diff,
    needsRecovery:     diff >= threshold,
    lastCompletionAt:  lastMs,
    reason:            diff >= threshold ? 'gap' : 'on_track',
  });
}

export const MISSED_DAY_DEFAULTS = DEFAULTS;
export const _internal = Object.freeze({
  _utcMidnight, _lastCompletionMs, _readProgress,
});
