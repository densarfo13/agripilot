/**
 * priceInsights.js — aggregate farmgate price signal from the
 * marketplace's own listings + a safe global fallback.
 *
 *   buildPriceInsight({ prisma, crop, country?, region?, windowDays? })
 *     → {
 *         crop, country, region,
 *         currency,                        // 'USD' when falling back
 *         window:       { days, from, to }, // ISO timestamps
 *         suggested:    { low, high, typical, median },  // per-kg
 *         sampleSize:   number,             // listings used
 *         confidence:   'low' | 'medium' | 'high',
 *         trend:        'up' | 'down' | 'stable' | null,
 *         trendPct:     number | null,      // e.g. 0.08 = +8%
 *         source:       'local' | 'country' | 'global' | 'fallback',
 *         lastUpdated:  ISO string | null,
 *       }
 *
 * Resolution order (spec §3 fallback):
 *   1. LOCAL   — listings for (crop, country, region) in the window
 *   2. COUNTRY — listings for (crop, country)        in the window
 *   3. GLOBAL  — static USD band from GLOBAL_USD     (confidence='low')
 *   4. FALLBACK — generic $0.20–$1.00/kg             (confidence='low')
 *
 * Deliberately simple. No ML. Every step is a pure function over
 * numbers and the fallback table is auditable in code.
 *
 * All aggregate helpers are exported so tests can exercise them
 * directly without Prisma.
 */

// ─── Tiny embedded global USD band (per kg) ───────────────────
// Mirrors src/config/cropPrices.js GLOBAL_USD for the priority
// crops. Kept here instead of importing across the server↔frontend
// boundary so this module stays independently testable and Vite-
// free. Update the two tables together when prices move.
const GLOBAL_USD = Object.freeze({
  maize:        { low: 0.15, high: 0.40, typical: 0.25 },
  rice:         { low: 0.40, high: 0.90, typical: 0.60 },
  wheat:        { low: 0.20, high: 0.50, typical: 0.30 },
  sorghum:      { low: 0.15, high: 0.35, typical: 0.22 },
  millet:       { low: 0.25, high: 0.55, typical: 0.35 },
  cassava:      { low: 0.12, high: 0.35, typical: 0.20 },
  yam:          { low: 0.40, high: 1.00, typical: 0.60 },
  potato:       { low: 0.30, high: 0.90, typical: 0.55 },
  sweet_potato: { low: 0.35, high: 0.95, typical: 0.55 },
  beans:        { low: 0.80, high: 2.00, typical: 1.20 },
  soybean:      { low: 0.35, high: 0.75, typical: 0.50 },
  groundnut:    { low: 0.60, high: 1.40, typical: 0.90 },
  tomato:       { low: 0.40, high: 1.40, typical: 0.80 },
  onion:        { low: 0.30, high: 1.00, typical: 0.55 },
  okra:         { low: 0.50, high: 1.50, typical: 0.85 },
  pepper:       { low: 0.80, high: 3.00, typical: 1.50 },
  banana:       { low: 0.20, high: 0.60, typical: 0.35 },
  plantain:     { low: 0.25, high: 0.80, typical: 0.45 },
  cocoa:        { low: 1.80, high: 3.20, typical: 2.40 },
  coffee:       { low: 1.50, high: 4.50, typical: 2.80 },
  cotton:       { low: 0.90, high: 1.70, typical: 1.20 },
  mango:        { low: 0.40, high: 1.20, typical: 0.70 },
  sugarcane:    { low: 0.02, high: 0.05, typical: 0.03 },
});
const GENERIC_USD = Object.freeze({ low: 0.20, high: 1.00, typical: 0.50 });

// ─── Confidence thresholds ────────────────────────────────────
const MIN_FOR_LOCAL   = 3;   // region-scoped sample must have ≥3 points
const MIN_FOR_COUNTRY = 3;   // country fallback still needs evidence
const HIGH_CONF_N     = 10;
const MED_CONF_N      = 4;

// Trend classification — ±5% of the previous-period median flips
// the label. Anything inside that band stays 'stable' so the UI
// arrow doesn't wobble on tiny sample noise.
const TREND_EPS = 0.05;

// ─── Pure numerical helpers (exported for tests) ─────────────
export function median(sortedNumbers) {
  const n = sortedNumbers.length;
  if (n === 0) return null;
  if (n % 2 === 1) return sortedNumbers[(n - 1) >> 1];
  return (sortedNumbers[n / 2 - 1] + sortedNumbers[n / 2]) / 2;
}

export function percentile(sortedNumbers, p) {
  const n = sortedNumbers.length;
  if (n === 0) return null;
  if (n === 1) return sortedNumbers[0];
  const pos = (n - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedNumbers[lo];
  return sortedNumbers[lo] + (pos - lo) * (sortedNumbers[hi] - sortedNumbers[lo]);
}

export function mean(numbers) {
  if (numbers.length === 0) return null;
  let sum = 0;
  for (const n of numbers) sum += n;
  return sum / numbers.length;
}

/**
 * aggregatePriceInsight(listings, { now?, windowDays? })
 *   Pure. Filters to the window, pulls priceFdUnit, returns
 *   percentile-based range + trend (current half vs previous half
 *   of the window).
 */
export function aggregatePriceInsight(listings, { now = Date.now(), windowDays = 30 } = {}) {
  const ms = windowDays * 24 * 60 * 60 * 1000;
  const halfMs = ms / 2;
  const windowFrom = now - ms;
  const midpoint   = now - halfMs;

  const current = [];
  const previous = [];
  let latestTs = 0;

  for (const l of listings || []) {
    const ts = l && l.createdAt ? new Date(l.createdAt).getTime() : NaN;
    if (!Number.isFinite(ts) || ts < windowFrom || ts > now) continue;
    // priceFdUnit is a Prisma Decimal — coerce via Number. Accept
    // strings too in case the caller passed serialised rows.
    const raw = l.priceFdUnit ?? l.pricePerUnit ?? l.price;
    if (raw == null) continue;
    const price = typeof raw === 'object' && raw !== null && 'toNumber' in raw
      ? raw.toNumber()
      : Number(raw);
    if (!Number.isFinite(price) || price <= 0) continue;

    (ts >= midpoint ? current : previous).push(price);
    if (ts > latestTs) latestTs = ts;
  }

  const all = [...current, ...previous].sort((a, b) => a - b);
  const count = all.length;
  if (count === 0) {
    return {
      count: 0, median: null, low: null, high: null, avg: null,
      currentMedian: null, previousMedian: null, latestTs: null,
      trend: null, trendPct: null,
    };
  }

  const med  = median(all);
  const low  = count >= 4 ? percentile(all, 0.25) : all[0];
  const high = count >= 4 ? percentile(all, 0.75) : all[all.length - 1];
  const avg  = mean(all);

  const curSorted = current.slice().sort((a, b) => a - b);
  const prevSorted = previous.slice().sort((a, b) => a - b);
  const currentMedian  = median(curSorted);
  const previousMedian = median(prevSorted);

  let trend = null, trendPct = null;
  if (current.length >= 2 && previous.length >= 2
      && Number.isFinite(currentMedian) && Number.isFinite(previousMedian)
      && previousMedian > 0) {
    trendPct = (currentMedian - previousMedian) / previousMedian;
    trend = trendPct >= TREND_EPS  ? 'up'
          : trendPct <= -TREND_EPS ? 'down'
                                    : 'stable';
  }

  return {
    count, median: med, low, high, avg,
    currentMedian, previousMedian,
    latestTs: latestTs || null,
    trend, trendPct,
  };
}

// ─── Confidence scoring (exported for tests) ──────────────────
export function confidenceFromCount(count, source) {
  if (source === 'global' || source === 'fallback') return 'low';
  if (count >= HIGH_CONF_N) return 'high';
  if (count >= MED_CONF_N)  return 'medium';
  return 'low';
}

// ─── Normalise to canonical storage key ───────────────────────
function canonicalCropKey(crop) {
  if (!crop) return '';
  return String(crop).trim().toUpperCase();
}
function canonicalCropKeyLowerSnake(crop) {
  return String(crop || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

// ─── Assemble the final insight shape ─────────────────────────
function toInsight({
  crop, country, region, windowDays, now,
  agg, source, currency = 'USD',
}) {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const confidence = confidenceFromCount(agg.count, source);
  return Object.freeze({
    crop,
    country:  country || null,
    region:   region  || null,
    currency,
    window: Object.freeze({
      days: windowDays,
      from: new Date(now - windowMs).toISOString(),
      to:   new Date(now).toISOString(),
    }),
    suggested: Object.freeze({
      low:     round2(agg.low),
      high:    round2(agg.high),
      typical: round2(agg.avg != null ? agg.avg : agg.median),
      median:  round2(agg.median),
    }),
    sampleSize:  agg.count,
    confidence,
    trend:       agg.trend,
    trendPct:    agg.trendPct != null ? round3(agg.trendPct) : null,
    source,
    lastUpdated: agg.latestTs ? new Date(agg.latestTs).toISOString() : null,
  });
}

function round2(n) { return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; }
function round3(n) { return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null; }

// ─── Static-fallback helpers ──────────────────────────────────
function globalInsight({ crop, country, region, windowDays, now }) {
  const key = canonicalCropKeyLowerSnake(crop);
  const band = GLOBAL_USD[key];
  if (band) {
    return toInsight({
      crop: canonicalCropKey(crop), country, region, windowDays, now,
      agg: {
        count: 0,
        median:  band.typical,
        low:     band.low,
        high:    band.high,
        avg:     band.typical,
        currentMedian: null, previousMedian: null,
        latestTs: null,
        trend: null, trendPct: null,
      },
      source:   'global',
      currency: 'USD',
    });
  }
  return toInsight({
    crop: canonicalCropKey(crop), country, region, windowDays, now,
    agg: {
      count: 0,
      median:  GENERIC_USD.typical,
      low:     GENERIC_USD.low,
      high:    GENERIC_USD.high,
      avg:     GENERIC_USD.typical,
      currentMedian: null, previousMedian: null,
      latestTs: null,
      trend: null, trendPct: null,
    },
    source:   'fallback',
    currency: 'USD',
  });
}

// ─── DB-query wrapper ─────────────────────────────────────────
/**
 * buildPriceInsight(prisma, { crop, country?, region?, windowDays? })
 *   Pulls listings from Prisma and runs the aggregate + fallback
 *   ladder. Safe on missing Prisma (returns static fallback).
 */
export async function buildPriceInsight(prisma, {
  crop, country = null, region = null, windowDays = 30, now = Date.now(),
} = {}) {
  if (!crop) return null;
  const ms       = windowDays * 24 * 60 * 60 * 1000;
  const fromDate = new Date(now - ms);
  const cropKey  = canonicalCropKey(crop);

  if (!prisma?.produceListing?.findMany) {
    return globalInsight({ crop, country, region, windowDays, now });
  }

  const baseWhere = {
    crop: cropKey,
    priceFdUnit: { not: null },
    createdAt: { gte: fromDate },
  };

  // Layer 1 — local (crop + country + region)
  if (country && region) {
    const local = await prisma.produceListing.findMany({
      where: {
        ...baseWhere,
        region: { equals: region, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const agg = aggregatePriceInsight(local, { now, windowDays });
    if (agg.count >= MIN_FOR_LOCAL) {
      return toInsight({
        crop: cropKey, country, region, windowDays, now,
        agg, source: 'local',
      });
    }
  }

  // Layer 2 — country (crop + country)
  if (country) {
    const countryListings = await prisma.produceListing.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const agg = aggregatePriceInsight(countryListings, { now, windowDays });
    if (agg.count >= MIN_FOR_COUNTRY) {
      return toInsight({
        crop: cropKey, country, region, windowDays, now,
        agg, source: 'country',
      });
    }
  }

  // Layer 3/4 — global / generic
  return globalInsight({ crop: cropKey, country, region, windowDays, now });
}

export const _internal = Object.freeze({
  GLOBAL_USD, GENERIC_USD,
  MIN_FOR_LOCAL, MIN_FOR_COUNTRY, HIGH_CONF_N, MED_CONF_N, TREND_EPS,
  canonicalCropKey, canonicalCropKeyLowerSnake,
  toInsight, globalInsight,
});
