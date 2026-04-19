/**
 * signalDecay.js — recency weighting. Old signals must lose
 * influence without being deleted, so we keep them around and
 * attach a time-decayed weight.
 *
 * Two complementary strategies:
 *
 *   • Exponential decay via half-life
 *       weight(age) = base * 0.5^(age / halfLife)
 *     This is the default — smooth, no cliff.
 *
 *   • Rolling window
 *       keep only samples newer than `windowDays`
 *     Use this when you want to hard-drop very old data (e.g.
 *     when regenerating a seasonal view).
 *
 * Both operate on the same `Signal` shape:
 *   { signalType, timestamp, direction?, weight?, ... }
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_HALF_LIFE_DAYS = 14;
const DEFAULT_WINDOW_DAYS    = 90;

/**
 * applySignalDecay — return a new signal with an added
 * `decayedWeight` field (original `weight` preserved). Never
 * mutates the input.
 */
export function applySignalDecay(signal, { halfLifeDays = DEFAULT_HALF_LIFE_DAYS, now = Date.now() } = {}) {
  if (!signal || typeof signal !== 'object') return signal;
  const ts = Number(signal.timestamp);
  if (!Number.isFinite(ts)) {
    return { ...signal, decayedWeight: 0, ageDays: null };
  }
  const ageDays = Math.max(0, (now - ts) / ONE_DAY_MS);
  const factor  = Math.pow(0.5, ageDays / Math.max(0.5, halfLifeDays));
  const base    = Number(signal.weight ?? 1);
  return {
    ...signal,
    decayedWeight: +(base * factor).toFixed(6),
    ageDays: +ageDays.toFixed(3),
  };
}

/** Just the decayed weight — for hot loops that don't need the whole shape. */
export function getDecayedSignalWeight({ timestamp, weight = 1, halfLifeDays = DEFAULT_HALF_LIFE_DAYS, now = Date.now() } = {}) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return 0;
  const ageDays = Math.max(0, (now - ts) / ONE_DAY_MS);
  return +(weight * Math.pow(0.5, ageDays / Math.max(0.5, halfLifeDays))).toFixed(6);
}

/**
 * getWindowedSignals — rolling-window filter. Drops anything
 * older than `windowDays` (default 90). Returns a new array.
 */
export function getWindowedSignals(signals = [], { windowDays = DEFAULT_WINDOW_DAYS, now = Date.now() } = {}) {
  if (!Array.isArray(signals)) return [];
  const cutoff = now - windowDays * ONE_DAY_MS;
  return signals.filter((s) => Number(s?.timestamp) >= cutoff);
}

/**
 * partitionByRecency — split signals into recent / middle / old
 * buckets using half-window thirds. Useful for "what's
 * trending this week vs last month" dashboards.
 */
export function partitionByRecency(signals = [], { windowDays = DEFAULT_WINDOW_DAYS, now = Date.now() } = {}) {
  const recentCutoff = now - (windowDays / 3) * ONE_DAY_MS;
  const midCutoff    = now - (2 * windowDays / 3) * ONE_DAY_MS;
  const out = { recent: [], middle: [], old: [] };
  for (const s of Array.isArray(signals) ? signals : []) {
    const ts = Number(s?.timestamp);
    if (!Number.isFinite(ts)) continue;
    if (ts >= recentCutoff)       out.recent.push(s);
    else if (ts >= midCutoff)     out.middle.push(s);
    else                          out.old.push(s);
  }
  return out;
}

/**
 * computeEffectiveSampleSize — treats decayed weights as a "soft
 * count" of samples. Useful for arbitration: a signal with 20
 * samples all from 6 months ago should not feel like 20 — its
 * effective sample size is much smaller.
 */
export function computeEffectiveSampleSize(signals = [], { halfLifeDays = DEFAULT_HALF_LIFE_DAYS, now = Date.now() } = {}) {
  let sum = 0;
  for (const s of Array.isArray(signals) ? signals : []) {
    sum += getDecayedSignalWeight({ timestamp: s?.timestamp, weight: s?.weight ?? 1, halfLifeDays, now });
  }
  return +sum.toFixed(4);
}

export const _internal = {
  ONE_DAY_MS,
  DEFAULT_HALF_LIFE_DAYS,
  DEFAULT_WINDOW_DAYS,
};
