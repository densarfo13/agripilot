/**
 * riskAggregationEngine.js — region-level rollup of farmer-level
 * risks so NGO admins see hotspots, not individuals.
 *
 *   import { aggregateRegionalRisks, REGIONAL_RISK_LEVEL }
 *     from 'src/core/ngo/riskAggregationEngine.js';
 *
 *   const r = aggregateRegionalRisks({ farmers: [...], nowMs: Date.now() });
 *   // r.regions = [{ region, hotspotLevel, riskCounts, sampleSize }, ...]
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Aggregates the per-farmer risk lists (already produced by
 *   the existing riskEngine) into region-level counts. Returns
 *   hotspots ranked by severity — never names individual
 *   farmers in the public-facing output.
 *
 *   It is NOT a tracking tool. It is NOT used to single out a
 *   farmer to anyone outside the operator's RBAC scope. PII
 *   never leaves the engine.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

export const REGIONAL_RISK_LEVEL = Object.freeze({
  CALM:     'calm',
  WATCH:    'watch',
  ELEVATED: 'elevated',
  HOTSPOT:  'hotspot',
});

function _hotspotLevel(highCount, sampleSize) {
  if (sampleSize <= 0) return REGIONAL_RISK_LEVEL.CALM;
  const pct = highCount / sampleSize;
  if (pct >= 0.30) return REGIONAL_RISK_LEVEL.HOTSPOT;
  if (pct >= 0.15) return REGIONAL_RISK_LEVEL.ELEVATED;
  if (pct >= 0.05) return REGIONAL_RISK_LEVEL.WATCH;
  return REGIONAL_RISK_LEVEL.CALM;
}

/**
 * @param {object} ctx
 * @returns {object}
 */
export function aggregateRegionalRisks(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();
    const farmers = Array.isArray(c.farmers) ? c.farmers : [];

    // region → { sampleSize, riskCounts: { type: { high, medium, low } }, highCount }
    const byRegion = new Map();

    for (const f of farmers) {
      if (!f || typeof f !== 'object') continue;
      const region = f.region || 'unknown';
      if (!byRegion.has(region)) {
        byRegion.set(region, { region, sampleSize: 0, riskCounts: {}, highCount: 0 });
      }
      const slot = byRegion.get(region);
      slot.sampleSize += 1;
      const risks = Array.isArray(f.recentRisks) ? f.recentRisks : [];
      for (const r of risks) {
        if (!r || typeof r !== 'object' || !r.type) continue;
        const sev = r.severity === 'high' || r.severity === 'medium' || r.severity === 'low' ? r.severity : 'low';
        if (!slot.riskCounts[r.type]) slot.riskCounts[r.type] = { high: 0, medium: 0, low: 0 };
        slot.riskCounts[r.type][sev] += 1;
        if (sev === 'high') slot.highCount += 1;
      }
    }

    const regions = Array.from(byRegion.values()).map((slot) => ({
      region:        slot.region,
      sampleSize:    slot.sampleSize,
      riskCounts:    slot.riskCounts,
      highCount:     slot.highCount,
      hotspotLevel:  _hotspotLevel(slot.highCount, slot.sampleSize),
    }));

    // Rank hotspots first
    const _rank = (r) =>
        r.hotspotLevel === REGIONAL_RISK_LEVEL.HOTSPOT  ? 0
      : r.hotspotLevel === REGIONAL_RISK_LEVEL.ELEVATED ? 1
      : r.hotspotLevel === REGIONAL_RISK_LEVEL.WATCH    ? 2 : 3;
    regions.sort((a, b) => _rank(a) - _rank(b) || b.sampleSize - a.sampleSize);

    return {
      ok:          true,
      regions,
      generatedAt: nowMs,
      disclaimer:  { key: 'ngo.regionalRisk.disclaimer',
                     fallback: 'Risk aggregation is an estimate from the last cohort snapshot. No PII included.' },
    };
  } catch {
    return { ok: false, regions: [], generatedAt: Date.now(),
             disclaimer: { key: 'ngo.regionalRisk.disclaimer',
                           fallback: 'Regional risk unavailable.' } };
  }
}

const _module = { REGIONAL_RISK_LEVEL, aggregateRegionalRisks };
export default _module;
