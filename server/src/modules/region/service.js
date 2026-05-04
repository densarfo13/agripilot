/**
 * region/service.js — region intelligence service.
 *
 *   const insight = await getRegionInsight(prisma, {
 *     region: 'Ashanti', country: 'GH', cropOrPlant: 'tomato',
 *   });
 *
 * Spec §9 — Region Intelligence
 *   Inputs: region, cropOrPlant, weather pattern, scan trends,
 *   user outcomes (later).
 *
 *   Output envelope:
 *     {
 *       region:           string | null,
 *       country:          string | null,
 *       cropOrPlant:      string | null,
 *       pestRisk:         'low' | 'medium' | 'high',
 *       diseaseRisk:      'low' | 'medium' | 'high',
 *       droughtRisk:      'low' | 'medium' | 'high',
 *       recommendation:   string | null,
 *       sampleSize:       number,
 *       generatedAt:      ISO string,
 *     }
 *
 * Source of truth
 *   1. Aggregate the last 30 days of `scan_completed` events
 *      filtered by the region+crop pair. Compute pestRisk +
 *      diseaseRisk from how many scans returned needs_attention.
 *   2. If aggregation returns nothing → null. The decision
 *      engine continues without a region signal.
 *
 * Strict-rule audit
 *   • Pure async — never throws.
 *   • Read-only.
 *   • Self-bounds the query window so a busy table can't blow up
 *     latency.
 */

const SCAN_EVENT_TYPE = 'scan_completed';
const REGION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Risk thresholds — tuned on the conservative side so we don't
// raise scary banners off a tiny sample.
const MIN_SAMPLE = 3;
const HIGH_RISK_RATIO   = 0.40;
const MEDIUM_RISK_RATIO = 0.20;

/**
 * getRegionInsight(prisma, { region, country, cropOrPlant })
 *
 * Returns the aggregated risk envelope for the (region, crop)
 * pair, or null when there isn't enough data to be useful.
 */
export async function getRegionInsight(prisma, {
  region, country, cropOrPlant,
} = {}) {
  if (!prisma) return null;
  // Need at LEAST a region OR country to scope by — we don't
  // want to surface global aggregates as "your area".
  if (!region && !country) return null;

  const since = new Date(Date.now() - REGION_WINDOW_MS);
  let rows = [];
  try {
    rows = await prisma.clientEvent.findMany({
      where: {
        type: SCAN_EVENT_TYPE,
        createdAt: { gte: since },
      },
      select: { payload: true, createdAt: true },
      take: 500, // hard upper bound on the aggregate set
      orderBy: { createdAt: 'desc' },
    });
  } catch { return null; }

  // Filter in-memory because the payload's region/country/crop
  // live inside the JSON column and the JSON-path filter isn't
  // portable across all the Postgres versions we deploy on.
  const matched = rows.filter((r) => {
    const p = r.payload || {};
    if (region && p.region !== region) {
      // Loose match: case-insensitive when both strings are present.
      if (typeof p.region === 'string'
          && typeof region === 'string'
          && p.region.toLowerCase() !== region.toLowerCase()) return false;
      if (typeof p.region !== 'string') return false;
    }
    if (country && typeof p.country === 'string'
        && p.country.toLowerCase() !== String(country).toLowerCase()) return false;
    if (cropOrPlant && typeof p.crop === 'string'
        && p.crop.toLowerCase() !== String(cropOrPlant).toLowerCase()) return false;
    return true;
  });

  if (matched.length < MIN_SAMPLE) return null;

  let pestHits = 0;
  let diseaseHits = 0;
  let droughtHits = 0;
  for (const ev of matched) {
    const p = ev.payload || {};
    const status = p.status || null;
    const issue = (p.issueType || '').toLowerCase();
    if (status !== 'needs_attention') continue;
    if (issue.includes('pest') || issue.includes('insect')) pestHits += 1;
    if (issue.includes('disease') || issue.includes('fungal')
        || issue.includes('blight') || issue.includes('rot')
        || issue.includes('spot') || issue.includes('mildew')) diseaseHits += 1;
    if (issue.includes('drought') || issue.includes('water_stress')
        || issue.includes('dry')) droughtHits += 1;
  }

  const pestRisk    = _bandFor(pestHits,    matched.length);
  const diseaseRisk = _bandFor(diseaseHits, matched.length);
  const droughtRisk = _bandFor(droughtHits, matched.length);

  return {
    region:      region || null,
    country:     country || null,
    cropOrPlant: cropOrPlant || null,
    pestRisk,
    diseaseRisk,
    droughtRisk,
    recommendation: _recommendationFor({ pestRisk, diseaseRisk, droughtRisk }),
    sampleSize:  matched.length,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Internal helpers ────────────────────────────────────────

function _bandFor(hits, sample) {
  if (sample <= 0) return 'low';
  const r = hits / sample;
  if (r >= HIGH_RISK_RATIO)   return 'high';
  if (r >= MEDIUM_RISK_RATIO) return 'medium';
  return 'low';
}

function _recommendationFor({ pestRisk, diseaseRisk, droughtRisk }) {
  if (pestRisk === 'high')    return 'Pest activity is elevated in your area.';
  if (diseaseRisk === 'high') return 'Disease cases are rising in your area.';
  if (droughtRisk === 'high') return 'Several farms nearby report water stress.';
  if (pestRisk === 'medium')  return 'Pest reports are slightly elevated nearby.';
  if (diseaseRisk === 'medium') return 'A few disease reports nearby — keep watch.';
  return null;
}

export const _internal = Object.freeze({
  SCAN_EVENT_TYPE,
  REGION_WINDOW_MS,
  MIN_SAMPLE,
  HIGH_RISK_RATIO,
  MEDIUM_RISK_RATIO,
  _bandFor,
  _recommendationFor,
});

export default {
  getRegionInsight,
};
