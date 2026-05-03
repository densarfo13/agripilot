/**
 * Insights service — privacy-safe global aggregates.
 *
 * Two operations:
 *   • upsertBatch(rawEntries) — accept up to N normalised
 *     deltas, upsert by the unique key, increment the four
 *     counter columns. Returns counts of accepted / rejected.
 *   • query(filter) — return rows matching region / crop /
 *     setup / condition with derived rates + a simple score
 *     and confidence band.
 *
 * NO per-user data flows through here. Every input record is
 * stripped to coarse buckets by `insightNormalize.js` before
 * the SQL upsert; PII matches drop the whole record.
 */

import prisma from '../../config/database.js';
import { normalizeInsightInput } from '../../utils/insightNormalize.js';

const MAX_BATCH = 100;

// Score weights (spec §4):
//   score = 0.6 * successRate + 0.3 * completionRate + 0.1 * recencyBoost
const W_SUCCESS    = 0.6;
const W_COMPLETION = 0.3;
const W_RECENCY    = 0.1;

// Confidence thresholds (spec §4).
const CONF_MED  = 20;
const CONF_HIGH = 100;

/**
 * Upsert a batch of insight deltas. Each entry is normalised
 * before the upsert; PII / shapeless entries are dropped silently
 * (their `rejected` count is returned so the client can warn in
 * dev). Counters are incremented additively — the same key can
 * receive multiple batches across the session.
 *
 * @param {Array<object>} rawEntries
 * @returns {Promise<{accepted: number, rejected: number}>}
 */
export async function upsertBatch(rawEntries) {
  if (!Array.isArray(rawEntries)) return { accepted: 0, rejected: 0 };
  // Hard cap per call — spec §3. Anything beyond the cap is
  // rejected, not silently dropped, so the client can tell.
  const trimmed = rawEntries.slice(0, MAX_BATCH);
  const overflow = Math.max(0, rawEntries.length - trimmed.length);

  let accepted = 0;
  let rejected = overflow;

  for (const raw of trimmed) {
    const norm = normalizeInsightInput(raw);
    if (!norm) { rejected += 1; continue; }
    if (norm.shown === 0 && norm.completed === 0
        && norm.success === 0 && norm.failure === 0) {
      // Nothing to add — skip the round-trip.
      rejected += 1;
      continue;
    }
    try {
      await prisma.insightAggregate.upsert({
        where: {
          region_cropOrPlant_setup_condition: {
            region:      norm.region,
            cropOrPlant: norm.cropOrPlant,
            setup:       norm.setup,
            condition:   norm.condition,
          },
        },
        create: {
          region:      norm.region,
          cropOrPlant: norm.cropOrPlant,
          setup:       norm.setup,
          condition:   norm.condition,
          shown:       norm.shown,
          completed:   norm.completed,
          success:     norm.success,
          failure:     norm.failure,
        },
        update: {
          shown:     { increment: norm.shown },
          completed: { increment: norm.completed },
          success:   { increment: norm.success },
          failure:   { increment: norm.failure },
        },
      });
      accepted += 1;
    } catch (err) {
      // Per-row isolation: a single failed upsert (e.g. a
      // schema-edge constraint) doesn't poison the rest of
      // the batch.
      rejected += 1;
      try { console.warn('[insights upsert failed]', err && err.message); }
      catch { /* never propagate */ }
    }
  }

  return { accepted, rejected };
}

/**
 * Return scored insight rows matching the filter. The "top N"
 * shape is opinionated:
 *   1. Apply the requested filter (any of region / crop / setup /
 *      condition; missing filters are wildcarded)
 *   2. Compute completionRate, successRate, recencyBoost
 *   3. score = 0.6 * successRate + 0.3 * completionRate + 0.1 * recencyBoost
 *   4. Sort descending; cap to `limit` rows
 *   5. Attach a `confidence` band based on `shown`
 *
 * `recommendation` is a deliberately bland string — the spec
 * says insights MUST NOT generate unsafe treatment recs, so we
 * return a generic "growers in your area report better results"
 * line that the caller renders as a hint, not as a directive.
 *
 * @param {{region?:string, cropOrPlant?:string, setup?:string, condition?:string, limit?:number}} filter
 */
export async function query(filter = {}) {
  const where = {};
  if (filter.region)      where.region      = String(filter.region).toLowerCase();
  if (filter.cropOrPlant) where.cropOrPlant = String(filter.cropOrPlant).toLowerCase();
  if (filter.setup)       where.setup       = String(filter.setup).toLowerCase();
  if (filter.condition)   where.condition   = String(filter.condition).toLowerCase();

  const limit = Number.isFinite(Number(filter.limit))
    ? Math.max(1, Math.min(50, Number(filter.limit)))
    : 10;

  const rows = await prisma.insightAggregate.findMany({
    where,
    orderBy: { lastUpdated: 'desc' },
    take: 200,
  });

  const now = Date.now();
  const insights = rows.map((r) => {
    const completionRate = r.shown > 0 ? r.completed / r.shown : 0;
    const successDenom   = r.success + r.failure;
    const successRate    = successDenom > 0 ? r.success / successDenom : 0;

    // Recency boost — 1.0 when updated today, decays linearly
    // to 0 across 30 days. Rows older than 30 days contribute
    // no recency bump.
    const ageDays = Math.max(0, (now - r.lastUpdated.getTime()) / 86_400_000);
    const recencyBoost = ageDays >= 30 ? 0 : 1 - (ageDays / 30);

    const score =
      (W_SUCCESS    * successRate)
      + (W_COMPLETION * completionRate)
      + (W_RECENCY    * recencyBoost);

    let confidence = 'low';
    if (r.shown >= CONF_HIGH) confidence = 'high';
    else if (r.shown >= CONF_MED) confidence = 'medium';

    // Bland, safety-bounded recommendation. The client decides
    // whether to render it; the dailyPlanEngine never lets it
    // become a treatment instruction.
    const recommendation = _safeRecommendation({
      cropOrPlant: r.cropOrPlant,
      condition:   r.condition,
      successRate,
      confidence,
    });

    return {
      region:         r.region,
      cropOrPlant:    r.cropOrPlant,
      setup:          r.setup,
      condition:      r.condition,
      shown:          r.shown,
      completed:      r.completed,
      success:        r.success,
      failure:        r.failure,
      completionRate: round(completionRate, 3),
      successRate:    round(successRate,    3),
      recencyBoost:   round(recencyBoost,   3),
      score:          round(score,          3),
      confidence,
      recommendation,
      lastUpdated:    r.lastUpdated.toISOString(),
    };
  });

  insights.sort((a, b) => b.score - a.score);
  return insights.slice(0, limit);
}

function round(n, digits) {
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function _safeRecommendation({ cropOrPlant, condition, successRate, confidence }) {
  // Never produce a treatment / dosage / chemical-application
  // recommendation here. Only a behaviour hint phrased as a
  // peer signal ("growers report").
  if (confidence === 'low') return null;
  if (successRate < 0.2)    return null;
  // Generic phrasing — the dailyPlanEngine reorder hook adds
  // its own localised wording. We just return a coarse tag the
  // engine maps to a translated string.
  if (condition === 'humid') return 'tag:checkLeavesEarlyHumid';
  if (condition === 'rainy') return 'tag:protectFromRain';
  if (condition === 'hot')   return 'tag:waterDeepEvening';
  return 'tag:keepRoutine';
}

export const _internal = Object.freeze({
  MAX_BATCH,
  W_SUCCESS, W_COMPLETION, W_RECENCY,
  CONF_MED, CONF_HIGH,
});
