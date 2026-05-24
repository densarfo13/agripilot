/**
 * ngoMetricsEngine.js — calm program-health metrics for NGO
 * dashboards.
 *
 *   import { computeNgoMetrics } from 'src/core/ngo/ngoMetricsEngine.js';
 *
 *   const m = computeNgoMetrics({
 *     farmers: [{ id, lastActiveAt, crop, ... }, ...],
 *     nowMs:   Date.now(),
 *   });
 *   // m.activePct / m.inactivePct / m.cropDistribution / ...
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure aggregator over the operator-supplied farmer cohort.
 *   Returns calm, export-friendly numbers with no PII (only
 *   counts, percentages, distribution maps).
 *
 *   It is NOT a learning system. It does NOT contact farmers.
 *   It does NOT predict outcomes. It just summarises the
 *   cohort that already exists.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

const _DAY = 86400000;

function _pct(part, whole) {
  if (!Number.isFinite(whole) || whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * @param {object} ctx
 * @returns {object}
 */
export function computeNgoMetrics(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();
    const inactiveDays = Number.isFinite(c.inactiveDaysThreshold) ? c.inactiveDaysThreshold : 14;
    const farmers = Array.isArray(c.farmers) ? c.farmers : [];

    const cutoff = nowMs - inactiveDays * _DAY;
    let active = 0;
    let inactive = 0;
    const cropDistribution = {};
    let withScans = 0;
    let withLifecycle = 0;

    for (const f of farmers) {
      if (!f || typeof f !== 'object') continue;
      const lastActive = Number(f.lastActiveAt);
      if (Number.isFinite(lastActive) && lastActive >= cutoff) active += 1;
      else inactive += 1;

      const crop = f.crop || f.primaryCrop || 'unknown';
      cropDistribution[crop] = (cropDistribution[crop] || 0) + 1;
      if (f.lastScanAt) withScans += 1;
      if (f.currentLifecycleStage) withLifecycle += 1;
    }

    const total = farmers.length;
    return {
      ok:                true,
      total,
      active,
      inactive,
      activePct:         _pct(active, total),
      inactivePct:       _pct(inactive, total),
      cropDistribution,
      scanAdoptionPct:   _pct(withScans, total),
      lifecycleStartedPct: _pct(withLifecycle, total),
      generatedAt:       nowMs,
      isEstimate:        true,
      disclaimer:        { key: 'ngo.metrics.disclaimer',
                           fallback: 'Metrics reflect last 14-day cohort activity. PII is never included.' },
    };
  } catch {
    return {
      ok: false, total: 0, active: 0, inactive: 0,
      activePct: 0, inactivePct: 0, cropDistribution: {},
      scanAdoptionPct: 0, lifecycleStartedPct: 0,
      generatedAt: Date.now(), isEstimate: true,
      disclaimer: { key: 'ngo.metrics.disclaimer',
                    fallback: 'Metrics unavailable for this cohort.' },
    };
  }
}

const _module = { computeNgoMetrics };
export default _module;
