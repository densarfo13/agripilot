/**
 * recencyWeighting.js — applies a half-life decay to per-sample
 * signals so old behavior never dominates. Three shapes the
 * caller can reach for:
 *
 *   filterSignalsByWindow(samples, { windowDays })
 *     hard drop older than window
 *
 *   applyRecencyWeight(sample, { halfLifeDays })
 *     annotates a single sample with .weight
 *
 *   getWeightedSignalScore(samples, opts)
 *     sum of decayed weights — "soft count"
 *
 *   getWeightedCounts(samples, opts)
 *     per-signalType weighted count (used by the hardening
 *     adjustment engine in place of raw counts)
 *
 * Half-life default is 30 days — recent enough to reflect
 * changes, long enough that a single week of signals doesn't
 * swing the output.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_HALF_LIFE_DAYS = 30;
export const DEFAULT_WINDOW_DAYS    = 90;

function ageDays(ts, now) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return Infinity;
  return Math.max(0, (now - n) / DAY_MS);
}

/**
 * decayedWeight — exponential half-life:
 *   w(age) = baseWeight * 0.5^(ageDays / halfLifeDays)
 */
function decayedWeight(ts, { halfLifeDays = DEFAULT_HALF_LIFE_DAYS, now = Date.now(), baseWeight = 1 } = {}) {
  const age = ageDays(ts, now);
  if (!Number.isFinite(age)) return 0;
  return baseWeight * Math.pow(0.5, age / Math.max(0.5, halfLifeDays));
}

/**
 * filterSignalsByWindow — hard drop anything older than `windowDays`.
 * Returns a NEW array.
 */
export function filterSignalsByWindow(samples = [], { windowDays = DEFAULT_WINDOW_DAYS, now = Date.now() } = {}) {
  if (!Array.isArray(samples)) return [];
  const cutoff = now - windowDays * DAY_MS;
  return samples.filter((s) => Number(s?.timestamp) >= cutoff);
}

/**
 * applyRecencyWeight — returns a copy of the sample with a
 * `.weight` field added. Never mutates the input.
 */
export function applyRecencyWeight(sample, opts = {}) {
  if (!sample || typeof sample !== 'object') return sample;
  const weight = decayedWeight(sample.timestamp, opts);
  return { ...sample, weight };
}

/**
 * getWeightedSignalScore — single number representing the
 * effective "soft count" of a sample set. Used for confidence
 * estimates (more recent samples contribute more).
 */
export function getWeightedSignalScore(samples = [], opts = {}) {
  if (!Array.isArray(samples) || !samples.length) return 0;
  let sum = 0;
  for (const s of samples) {
    sum += decayedWeight(s?.timestamp, opts);
  }
  return +sum.toFixed(4);
}

/**
 * getWeightedCounts — per-signalType weighted count. Same shape
 * as the raw counts bucket, but each count is a decayed sum
 * rather than a raw integer. The hardened engine uses these for
 * the ratio math so old data contributes less.
 *
 *   samples: [{ type: 'rec_accepted', timestamp: ..., weight? }]
 *   returns: { rec_accepted: 4.73, rec_rejected: 1.22, ... }
 */
export function getWeightedCounts(samples = [], opts = {}) {
  const out = {};
  if (!Array.isArray(samples)) return out;
  for (const s of samples) {
    if (!s || !s.type) continue;
    const w = decayedWeight(s.timestamp, opts);
    out[s.type] = +(((out[s.type] || 0) + w)).toFixed(4);
  }
  return out;
}

/**
 * ageBreakdown — distribution of samples across recent / middle
 * / old thirds of a window. Handy for dashboards: if all signals
 * are old, we probably shouldn't act on them.
 */
export function ageBreakdown(samples = [], { windowDays = DEFAULT_WINDOW_DAYS, now = Date.now() } = {}) {
  const recentCut = now - (windowDays / 3) * DAY_MS;
  const midCut    = now - (2 * windowDays / 3) * DAY_MS;
  const out = { recent: 0, middle: 0, old: 0, beyondWindow: 0 };
  for (const s of samples || []) {
    const ts = Number(s?.timestamp);
    if (!Number.isFinite(ts)) { out.beyondWindow += 1; continue; }
    if (ts >= recentCut)      out.recent += 1;
    else if (ts >= midCut)    out.middle += 1;
    else if (ts >= now - windowDays * DAY_MS) out.old += 1;
    else                      out.beyondWindow += 1;
  }
  return out;
}

export const _internal = {
  DAY_MS, DEFAULT_HALF_LIFE_DAYS, DEFAULT_WINDOW_DAYS,
  ageDays, decayedWeight,
};
