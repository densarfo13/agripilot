/**
 * signalExtractors.js — turns the raw analytics event stream
 * into typed, per-context counts the optimization engine can
 * reason about.
 *
 * Output shape (per context key):
 *   {
 *     counts: {
 *       rec_accepted, rec_rejected,
 *       task_completed, task_skipped, task_repeat_skipped,
 *       harvest_good, harvest_bad,
 *       listing_interest, listing_sold, listing_expired_unsold,
 *     },
 *     samples: Event[],    // kept for recency-weighted scoring
 *     lastSignalAt: number | null,
 *   }
 *
 * Signals are filtered to the last MAX_SIGNAL_AGE_DAYS so the
 * optimization loop never drags in ancient behavior.
 */

import { DECISION_EVENT_TYPES } from '../analytics/decisionEventTypes.js';
import {
  buildRecommendationContextKey,
  buildRegionContextKey,
  buildContextKey,
  buildContextKeyFromEvent,
} from './contextKey.js';
import { MAX_SIGNAL_AGE_DAYS } from './optimizationThresholds.js';

const SIGNAL_TYPES = Object.freeze([
  'rec_accepted', 'rec_rejected',
  'task_completed', 'task_skipped', 'task_repeat_skipped',
  'harvest_good', 'harvest_bad',
  'listing_interest', 'listing_sold', 'listing_expired_unsold',
]);

function emptyBucket() {
  const counts = {};
  for (const k of SIGNAL_TYPES) counts[k] = 0;
  return { counts, samples: [], lastSignalAt: null };
}

/**
 * extractOptimizationSignals — scans events once, routes each to
 * the appropriate (signalType, contextKey) bucket, and returns
 * the full aggregation plus per-family totals for dashboards.
 *
 * @param {Event[]} events
 * @param {{ now?: number, maxAgeDays?: number }} [opts]
 */
export function extractOptimizationSignals(events = [], opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const maxAgeMs = (opts.maxAgeDays ?? MAX_SIGNAL_AGE_DAYS) * 24 * 60 * 60 * 1000;
  const cutoff = now - maxAgeMs;

  const byContext = new Map();      // contextKey → bucket
  const familyTotals = {
    recommendation: 0, task: 0, harvest: 0, listing: 0,
  };

  const get = (key) => {
    let b = byContext.get(key);
    if (!b) { b = emptyBucket(); byContext.set(key, b); }
    return b;
  };

  for (const ev of Array.isArray(events) ? events : []) {
    if (!ev || typeof ev !== 'object') continue;
    const ts = Number(ev.timestamp);
    if (!Number.isFinite(ts) || ts < cutoff) continue;

    const family = classify(ev.type);
    if (!family) continue;

    const ctxKey = keyForFamily(ev, family);
    const bucket = get(ctxKey);
    const signalType = toSignalType(ev);
    if (!signalType) continue;

    bucket.counts[signalType] = (bucket.counts[signalType] || 0) + 1;
    bucket.samples.push({
      type: signalType,
      timestamp: ts,
      meta: ev.meta || {},
    });
    bucket.lastSignalAt = Math.max(bucket.lastSignalAt || 0, ts);
    familyTotals[family] += 1;
  }

  return {
    byContext: mapToObject(byContext),
    familyTotals,
    totalEvents: (Array.isArray(events) ? events : []).length,
    cutoff,
  };
}

/**
 * extractSignalsByContextKey — convenience when the caller only
 * wants signals for a single crop/country combination.
 */
export function extractSignalsByContextKey(events = [], key, opts = {}) {
  const all = extractOptimizationSignals(events, opts);
  return all.byContext[key] || emptyBucket();
}

// ─── classification helpers ─────────────────────────────
function classify(type) {
  switch (type) {
    case DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED:
    case DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED:
      return 'recommendation';
    case DECISION_EVENT_TYPES.TASK_COMPLETED:
    case DECISION_EVENT_TYPES.TASK_SKIPPED:
    case DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED:
      return 'task';
    case DECISION_EVENT_TYPES.HARVEST_SUBMITTED:
      return 'harvest';
    case DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED:
    case DECISION_EVENT_TYPES.LISTING_SOLD:
    case DECISION_EVENT_TYPES.LISTING_EXPIRED:
      return 'listing';
    default:
      return null;
  }
}

function toSignalType(ev) {
  const t = ev.type;
  if (t === DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED) return 'rec_accepted';
  if (t === DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED) return 'rec_rejected';
  if (t === DECISION_EVENT_TYPES.TASK_COMPLETED)        return 'task_completed';
  if (t === DECISION_EVENT_TYPES.TASK_SKIPPED)          return 'task_skipped';
  if (t === DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED)   return 'task_repeat_skipped';
  if (t === DECISION_EVENT_TYPES.HARVEST_SUBMITTED) {
    const oc = String(ev.meta?.outcomeClass ?? ev.meta?.outcome ?? '').toLowerCase();
    if (oc.startsWith('good')) return 'harvest_good';
    if (oc.startsWith('bad'))  return 'harvest_bad';
    return null;  // 'mixed' doesn't move the needle in either direction
  }
  if (t === DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED) return 'listing_interest';
  if (t === DECISION_EVENT_TYPES.LISTING_SOLD)             return 'listing_sold';
  if (t === DECISION_EVENT_TYPES.LISTING_EXPIRED)          return 'listing_expired_unsold';
  return null;
}

function keyForFamily(ev, family) {
  // Recommendation + harvest bucket at crop|country (+state if known).
  // Task bucket at mode (behavior is usually mode-wide, not
  // crop-specific). Listing bucket at country|state (regional
  // buyer behavior).
  switch (family) {
    case 'recommendation':
    case 'harvest':
      return buildRecommendationContextKey({
        crop: ev.meta?.crop,
        country: ev.country || ev.meta?.country,
        mode: ev.mode || ev.meta?.mode,
      });
    case 'task':
      return buildContextKey({
        crop: '', country: '', state: '',
        mode: ev.mode || ev.meta?.mode || '',
        month: '',
      });
    case 'listing':
      return buildRegionContextKey({
        country: ev.country || ev.meta?.country,
        state:   ev.stateCode || ev.meta?.stateCode,
      });
    default:
      return buildContextKeyFromEvent(ev);
  }
}

function mapToObject(map) {
  const out = {};
  for (const [k, v] of map.entries()) out[k] = v;
  return out;
}

export const _internal = { SIGNAL_TYPES, classify, toSignalType, keyForFamily };
