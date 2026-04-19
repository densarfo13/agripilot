/**
 * reasonHistoryService.js — a richer alternative to "last 10
 * reasons[]" that lived in the feedback history. Each reason
 * snapshot captures WHY a decision moved, WHEN, and HOW CONFIDENT
 * the signal behind it was.
 *
 * ReasonSnapshot shape:
 *   {
 *     reason:      string,        // short tag, e.g. "harvest_bad"
 *     timestamp:   number,        // ms
 *     weight:      number,        // 0..1 — raw caller-provided weight
 *     signalType:  string,        // maps to SIGNAL_RELIABILITY
 *     contextKey:  string | null, // e.g. "gh:maize" or "user:u_42"
 *     direction:   'positive' | 'negative' | 'neutral',
 *     confidence:  number | null, // signal confidenceScore if known
 *   }
 *
 * The service stores snapshots as an array and provides:
 *   addReasonSnapshot(history, snap) → new history (capped)
 *   getWeightedReasonHistory(history, opts) → same with decay applied
 *   summarizeTopReasons(history, opts) → ranked summary
 *
 * Everything is immutable; callers pass in the current history
 * and get a new one back.
 */

import { getDecayedSignalWeight } from './signalDecay.js';
import { getSignalReliability } from './signalConfidence.js';

const HARD_CAP = 2000;              // global cap per history
const DEFAULT_HALF_LIFE_DAYS = 14;

/**
 * addReasonSnapshot — append, cap, return new history.
 * If `snap.reason` is missing we drop the record; silently
 * rejecting garbage is safer than throwing during an ingestion
 * pipeline.
 */
export function addReasonSnapshot(history = [], snap = {}) {
  const safe = Array.isArray(history) ? history : [];
  if (!snap || typeof snap !== 'object' || !snap.reason) return safe;
  const record = {
    reason:      String(snap.reason),
    timestamp:   Number(snap.timestamp) || Date.now(),
    weight:      clamp01(Number(snap.weight ?? 1)),
    signalType:  String(snap.signalType || 'unknown'),
    contextKey:  snap.contextKey ?? null,
    direction:   normalizeDirection(snap.direction),
    confidence:  snap.confidence == null ? null : clamp01(Number(snap.confidence)),
  };
  const next = safe.concat(record);
  while (next.length > HARD_CAP) next.shift();
  return next;
}

/**
 * getWeightedReasonHistory — annotate each snapshot with
 * `decayedWeight` and `ageDays`. Leaves caller-provided fields
 * untouched. Useful input for dashboards that want the raw list
 * plus decay.
 */
export function getWeightedReasonHistory(history = [], {
  now = Date.now(),
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
} = {}) {
  return (Array.isArray(history) ? history : []).map((s) => {
    const decayedWeight = getDecayedSignalWeight({
      timestamp: s.timestamp, weight: s.weight, halfLifeDays, now,
    });
    const ageDays = Math.max(0, (now - Number(s.timestamp || 0)) / (1000 * 60 * 60 * 24));
    return { ...s, decayedWeight, ageDays: +ageDays.toFixed(2) };
  });
}

/**
 * summarizeTopReasons — rank by
 *   combinedScore = Σ decayedWeight × reliability × (confidence ?? 1)
 *
 * Output: array of
 *   {
 *     reason, totalWeight, combinedScore, count, lastSeenAt,
 *     sources: string[],    // distinct signalTypes that emitted this
 *     contextKeys: string[],// distinct contexts
 *     avgConfidence: number | null,
 *     dominantDirection: 'positive' | 'negative' | 'neutral' | 'mixed',
 *   }
 */
export function summarizeTopReasons(history = [], {
  topN = 10,
  now = Date.now(),
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
} = {}) {
  const decayed = getWeightedReasonHistory(history, { now, halfLifeDays });
  const byReason = new Map();

  for (const s of decayed) {
    const reliability = getSignalReliability(s.signalType);
    const confMult = s.confidence == null ? 1 : s.confidence;
    const combined = s.decayedWeight * reliability * confMult;

    let curr = byReason.get(s.reason);
    if (!curr) {
      curr = {
        reason: s.reason,
        totalWeight: 0,
        combinedScore: 0,
        count: 0,
        lastSeenAt: 0,
        sources: new Set(),
        contextKeys: new Set(),
        confidenceSum: 0,
        confidenceCount: 0,
        positive: 0, negative: 0, neutral: 0,
      };
      byReason.set(s.reason, curr);
    }
    curr.totalWeight   += s.decayedWeight;
    curr.combinedScore += combined;
    curr.count         += 1;
    curr.lastSeenAt     = Math.max(curr.lastSeenAt, Number(s.timestamp) || 0);
    if (s.signalType) curr.sources.add(s.signalType);
    if (s.contextKey) curr.contextKeys.add(s.contextKey);
    if (s.confidence != null) { curr.confidenceSum += s.confidence; curr.confidenceCount += 1; }
    if (s.direction === 'positive') curr.positive += 1;
    else if (s.direction === 'negative') curr.negative += 1;
    else curr.neutral += 1;
  }

  return [...byReason.values()]
    .map((r) => ({
      reason: r.reason,
      totalWeight: +r.totalWeight.toFixed(4),
      combinedScore: +r.combinedScore.toFixed(4),
      count: r.count,
      lastSeenAt: r.lastSeenAt,
      sources: [...r.sources],
      contextKeys: [...r.contextKeys],
      avgConfidence: r.confidenceCount > 0 ? +(r.confidenceSum / r.confidenceCount).toFixed(4) : null,
      dominantDirection: dominantOf(r),
    }))
    .sort((a, b) => b.combinedScore - a.combinedScore || b.count - a.count)
    .slice(0, topN);
}

/**
 * getReasonFrequencyOverTime — returns
 *   { [bucket]: { [reason]: count } }
 * bucketed by `bucketDays`. Useful for "is this reason trending
 * up or down?" dashboards.
 */
export function getReasonFrequencyOverTime(history = [], {
  windowDays = 90,
  bucketDays = 7,
  now = Date.now(),
} = {}) {
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
  const buckets = {};
  for (const s of Array.isArray(history) ? history : []) {
    const ts = Number(s?.timestamp);
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    const daysAgo = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
    const bucket  = Math.floor(daysAgo / bucketDays);
    const key     = `d${bucket * bucketDays}`;
    buckets[key]  = buckets[key] || {};
    const reason  = s.reason || 'unknown';
    buckets[key][reason] = (buckets[key][reason] || 0) + 1;
  }
  return buckets;
}

// ─── internals ─────────────────────────────────────────────
function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

function normalizeDirection(d) {
  if (d === 'positive' || d === 'negative' || d === 'neutral') return d;
  if (typeof d === 'number') {
    if (d > 0) return 'positive';
    if (d < 0) return 'negative';
    return 'neutral';
  }
  return 'neutral';
}

function dominantOf(r) {
  const { positive, negative, neutral } = r;
  if (positive > negative && positive > neutral) return 'positive';
  if (negative > positive && negative > neutral) return 'negative';
  if (Math.abs(positive - negative) <= Math.min(2, 0.2 * (positive + negative + neutral))) {
    if (positive > 0 && negative > 0) return 'mixed';
  }
  return 'neutral';
}

export const _internal = { HARD_CAP, DEFAULT_HALF_LIFE_DAYS, normalizeDirection, dominantOf };
