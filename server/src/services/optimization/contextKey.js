/**
 * contextKey.js — composite-key builder for the optimization
 * loop. Every signal the loop ingests gets bucketed by a context
 * key so we can compute per-context adjustments without mixing
 * (say) Ghana maize outcomes with India rice outcomes.
 *
 * Canonical key order:
 *   crop | country | state | mode | month
 *
 * Empty segments are preserved as empty strings so the key stays
 * positional. Callers pick the AXIS they want to group on by
 * zeroing out segments they don't care about.
 *
 *   buildContextKey({ crop: 'maize', country: 'GH', mode: 'farm' })
 *     → 'maize|gh||farm|'
 *
 *   parseContextKey('maize|gh||farm|')
 *     → { crop: 'maize', country: 'gh', state: '', mode: 'farm', month: '' }
 *
 * Why not an object map? Because the optimization engine reduces
 * millions of events into a small map-by-key — a string key is
 * both cheaper in Maps and easier to log/debug.
 */

const AXES = Object.freeze(['crop', 'country', 'state', 'mode', 'month']);
const SEP  = '|';

function norm(v) {
  if (v == null) return '';
  return String(v).trim().toLowerCase();
}

export function buildContextKey({
  crop = '', country = '', state = '', mode = '', month = '',
} = {}) {
  return [crop, country, state, mode, month].map(norm).join(SEP);
}

export function parseContextKey(key) {
  const parts = String(key || '').split(SEP);
  const out = {};
  for (let i = 0; i < AXES.length; i++) {
    out[AXES[i]] = (parts[i] ?? '').toLowerCase();
  }
  return out;
}

/**
 * buildContextKeyFromEvent — derive the canonical key from a raw
 * event's top-level and meta fields. The event schema is the same
 * the analytics layer uses (type, timestamp, mode, country,
 * stateCode, meta).
 *
 * Month is derived from `event.timestamp` when present. Callers
 * can pass `fallbackMonth` for synthesized events (tests, replays).
 */
export function buildContextKeyFromEvent(event = {}, opts = {}) {
  const meta = event.meta || {};
  const crop = meta.crop;
  const country = event.country || meta.country;
  const stateCode = event.stateCode || meta.stateCode;
  const mode = event.mode || meta.mode;
  const month = monthFromTimestamp(event.timestamp) || opts.fallbackMonth || '';
  return buildContextKey({
    crop, country, state: stateCode, mode, month,
  });
}

function monthFromTimestamp(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return '';
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return '';
  // 1..12 as string. We keep it compact so the key stays short.
  return String(d.getUTCMonth() + 1);
}

/**
 * groupByContext — helper for callers that want the default
 * (crop|country) bucketing for recommendation-side adjustments.
 * Mode and month are optional additional grouping axes.
 */
export function buildRecommendationContextKey({ crop, country, mode = '', month = '' } = {}) {
  return buildContextKey({ crop, country, state: '', mode, month });
}

/**
 * buildRegionContextKey — state-level rollup for listing-quality
 * adjustments, which are more about regional buyer behavior than
 * per-crop patterns.
 */
export function buildRegionContextKey({ country, state = '', mode = '' } = {}) {
  return buildContextKey({ crop: '', country, state, mode, month: '' });
}

export const _internal = { AXES, SEP, norm, monthFromTimestamp };
