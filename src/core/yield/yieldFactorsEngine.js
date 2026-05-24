/**
 * yieldFactorsEngine.js — explains WHAT is helping or hurting
 * the yield estimate, with calm hedged wording.
 *
 *   import { yieldFactorsFor, FACTOR_DIRECTION }
 *     from 'src/core/yield/yieldFactorsEngine.js';
 *
 *   const f = yieldFactorsFor({
 *     weather: { daysSinceRain: 10, temperatureC: 34 },
 *     scanHistory: [{ issueCategory: 'water_stress' }],
 *     taskCompletionRate: 0.4,
 *     lifecycle: { currentStage: 'flowering' },
 *   });
 *   // f.positives → [{ key, fallback, params }]
 *   // f.negatives → [{ key, fallback, params }]
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small explainer for the "Why?" panel on a yield card.
 *   Returns two parallel lists — what's helping vs what's
 *   hurting — each item carrying a localizable envelope.
 *
 *   It NEVER claims a treatment will improve yield by N %, and
 *   NEVER claims a missed task will reduce yield by N kg. The
 *   wording is hedged ("may help" / "could reduce") so the
 *   surface never implies false precision.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

export const FACTOR_DIRECTION = Object.freeze({
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
});

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}
function _num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} ctx
 * @returns {{ positives: Array, negatives: Array }}
 */
export function yieldFactorsFor(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const positives = [];
    const negatives = [];

    // ── Weather ──
    const w = (c.weather && typeof c.weather === 'object') ? c.weather : null;
    if (w) {
      const days = _num(w.daysSinceRain);
      const temp = _num(w.temperatureC);
      const rain = _num(w.rainProbability24hPct);
      if (days != null && days >= 10) {
        negatives.push(_msg('yield.factor.dry', 'Long dry spell may reduce yield potential.'));
      }
      if (temp != null && temp >= 35) {
        negatives.push(_msg('yield.factor.heat', 'High heat during sensitive stages can reduce fruit set.'));
      }
      if (days != null && days >= 2 && days <= 6 && (rain == null || rain < 70)) {
        positives.push(_msg('yield.factor.steadyWater', 'Steady rainfall pattern supports growth.'));
      }
    }

    // ── Scan history ──
    const scans = Array.isArray(c.scanHistory) ? c.scanHistory : [];
    const hasFungal = scans.some((s) => s && s.issueCategory === 'fungal_risk');
    const hasWater  = scans.some((s) => s && s.issueCategory === 'water_stress');
    const hasNutri  = scans.some((s) => s && s.issueCategory === 'nutrient_stress');
    const hasPest   = scans.some((s) => s && s.issueCategory === 'pest_damage');
    const hasHealthy= scans.some((s) => s && s.issueCategory === 'healthy');
    if (hasFungal) negatives.push(_msg('yield.factor.fungal', 'Fungal signs in recent scans may reduce yield if untreated.'));
    if (hasWater)  negatives.push(_msg('yield.factor.scanWater', 'Water-stress signs in recent scans suggest yield risk.'));
    if (hasNutri)  negatives.push(_msg('yield.factor.scanNutrient', 'Nutrient-stress signs in recent scans suggest yield risk.'));
    if (hasPest)   negatives.push(_msg('yield.factor.scanPest', 'Pest damage in recent scans may reduce yield.'));
    if (hasHealthy && !hasFungal && !hasWater && !hasNutri && !hasPest) {
      positives.push(_msg('yield.factor.scansHealthy', 'Recent scans look healthy.'));
    }

    // ── Task completion ──
    const tcr = _num(c.taskCompletionRate);
    if (tcr != null) {
      if (tcr >= 0.8)      positives.push(_msg('yield.factor.tasksGreat', 'Tasks well on track — care is consistent.'));
      else if (tcr <= 0.4) negatives.push(_msg('yield.factor.tasksLow',   'Many tasks missed — consistency may affect outcomes.'));
    }

    // ── Lifecycle stage ──
    const stage = c.lifecycle && c.lifecycle.currentStage ? String(c.lifecycle.currentStage) : '';
    if (stage === 'flowering' || stage === 'fruiting') {
      if (!w || _num(w.temperatureC) == null || Number(w.temperatureC) < 35) {
        positives.push(_msg('yield.factor.stageCritical', 'Crop is at a sensitive stage — steady care helps yield.'));
      }
    }

    return { positives, negatives };
  } catch { return { positives: [], negatives: [] }; }
}

const _module = { FACTOR_DIRECTION, yieldFactorsFor };
export default _module;
