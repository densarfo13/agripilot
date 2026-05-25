/**
 * recommendationPriorityEngine.js — single-truth ranker that picks
 * the ONE primary recommendation from a candidate pool.
 *
 *   import { rankRecommendations, PRIORITY }
 *     from 'src/core/intelligence/recommendationPriorityEngine.js';
 *
 *   const ranked = rankRecommendations([
 *     { type: 'watering', urgency: 'normal', ... },
 *     { type: 'disease',  urgency: 'high',   ... },
 *     { type: 'market',   urgency: 'low',    ... },
 *   ]);
 *   // ranked[0] = the disease one — the ONLY recommendation Home should render
 *
 * Priority order (spec §4, top wins):
 *   1. Critical disease risk
 *   2. Weather damage prevention
 *   3. Water stress
 *   4. Lifecycle-critical task
 *   5. Harvest timing
 *   6. Marketplace opportunity
 *   7. Supplier recommendation
 *   8. NGO / funding suggestion
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure ranker. Takes a flat array of candidates from the
 *   intelligence sub-engines and returns the same list re-sorted
 *   with the ONE-best at index 0 + the suppressed remainder
 *   labelled with WHY they lost.
 *
 *   It is NOT a generator (engines produce candidates), NOT a
 *   suppressor of duplicates (`recommendationSuppression.js` runs
 *   first), and NOT a confidence calculator (each candidate
 *   carries its own).
 *
 * Strict-rule audit
 *   • Pure. Never throws.
 */

export const PRIORITY = Object.freeze({
  CRITICAL_DISEASE:    'critical_disease',
  WEATHER_DAMAGE:      'weather_damage_prevention',
  WATER_STRESS:        'water_stress',
  LIFECYCLE_CRITICAL:  'lifecycle_critical',
  HARVEST_TIMING:      'harvest_timing',
  MARKETPLACE:         'marketplace_opportunity',
  SUPPLIER:            'supplier_recommendation',
  NGO_FUNDING:         'ngo_funding_suggestion',
});

// Lower number = higher priority. Unknown types sink to the bottom.
const _TIER = Object.freeze({
  [PRIORITY.CRITICAL_DISEASE]:   1,
  [PRIORITY.WEATHER_DAMAGE]:     2,
  [PRIORITY.WATER_STRESS]:       3,
  [PRIORITY.LIFECYCLE_CRITICAL]: 4,
  [PRIORITY.HARVEST_TIMING]:     5,
  [PRIORITY.MARKETPLACE]:        6,
  [PRIORITY.SUPPLIER]:           7,
  [PRIORITY.NGO_FUNDING]:        8,
});

// Map common engine `type` values to priority buckets so callers
// can use either form.
const _TYPE_TO_PRIORITY = Object.freeze({
  disease:                 PRIORITY.CRITICAL_DISEASE,
  fungal_risk:             PRIORITY.CRITICAL_DISEASE,
  pest_damage:             PRIORITY.CRITICAL_DISEASE,
  scan_followup:           PRIORITY.CRITICAL_DISEASE,
  urgent_scan_followup:    PRIORITY.CRITICAL_DISEASE,
  weather:                 PRIORITY.WEATHER_DAMAGE,
  weather_warning:         PRIORITY.WEATHER_DAMAGE,
  frost_protection:        PRIORITY.WEATHER_DAMAGE,
  watering:                PRIORITY.WATER_STRESS,
  water_stress:            PRIORITY.WATER_STRESS,
  crop_stage_task:         PRIORITY.LIFECYCLE_CRITICAL,
  lifecycle:               PRIORITY.LIFECYCLE_CRITICAL,
  fertilising:             PRIORITY.LIFECYCLE_CRITICAL,
  harvest_readiness:       PRIORITY.HARVEST_TIMING,
  harvest:                 PRIORITY.HARVEST_TIMING,
  ready_to_sell:           PRIORITY.MARKETPLACE,
  marketplace:             PRIORITY.MARKETPLACE,
  market:                  PRIORITY.MARKETPLACE,
  supplier:                PRIORITY.SUPPLIER,
  supplier_suggestion:     PRIORITY.SUPPLIER,
  ngo:                     PRIORITY.NGO_FUNDING,
  funding:                 PRIORITY.NGO_FUNDING,
  funding_opportunity:     PRIORITY.NGO_FUNDING,
});

const _URGENCY_RANK = Object.freeze({ high: 0, normal: 1, low: 2 });

function _priorityOf(rec) {
  if (!rec || typeof rec !== 'object') return Infinity;
  // Explicit priority wins.
  if (rec.priority && _TIER[rec.priority] != null) return _TIER[rec.priority];
  // Otherwise infer from type.
  const inferred = _TYPE_TO_PRIORITY[String(rec.type || '').toLowerCase()];
  if (inferred && _TIER[inferred] != null) return _TIER[inferred];
  return Infinity;
}

function _urgencyOf(rec) {
  const u = rec && rec.urgency ? String(rec.urgency).toLowerCase() : 'normal';
  return _URGENCY_RANK[u] != null ? _URGENCY_RANK[u] : _URGENCY_RANK.normal;
}

/**
 * Rank a candidate pool. Returns:
 *   {
 *     primary: <best>,             // or null when pool is empty
 *     suppressed: [{ rec, reason }],
 *     ordered: [...]               // full pool sorted highest-first
 *   }
 *
 * Tie-break inside the same tier: HIGH urgency wins → then NORMAL
 * → then LOW. Within an urgency band, the input order wins (stable
 * sort).
 */
export function rankRecommendations(candidates) {
  try {
    const arr = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    if (arr.length === 0) {
      return { primary: null, suppressed: [], ordered: [] };
    }
    const decorated = arr.map((rec, idx) => ({
      rec, idx,
      tier:    _priorityOf(rec),
      urgency: _urgencyOf(rec),
    }));
    decorated.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.urgency !== b.urgency) return a.urgency - b.urgency;
      return a.idx - b.idx;
    });
    const ordered = decorated.map((d) => d.rec);
    const primary = ordered[0] || null;
    const suppressed = ordered.slice(1).map((rec) => ({
      rec,
      reason: 'lower_priority',
    }));
    return { primary, suppressed, ordered };
  } catch {
    return { primary: null, suppressed: [], ordered: [] };
  }
}

const _module = { PRIORITY, rankRecommendations };
export default _module;
