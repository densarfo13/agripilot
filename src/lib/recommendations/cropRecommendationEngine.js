/**
 * cropRecommendationEngine.js — v1 rule-based recommender.
 *
 *   recommendCrops({ country, state?, farmerType?, limit? })
 *     → [
 *         {
 *           crop:           'maize',
 *           label:          'Maize',
 *           confidence:     'high' | 'medium' | 'low',
 *           fit:            0..1,
 *           reason:         'Widely grown across California\'s Central Valley.',
 *           plantingWindow: 'Feb–Apr',
 *           note:           string | null,
 *           source:         'state' | 'country' | 'global',
 *           farmerTypeHint: 'new' | 'existing' | null,
 *         },
 *         ...
 *       ]
 *
 * Selection order (spec §2):
 *   1. State rules for that country, if present.
 *   2. Country-level defaults.
 *   3. Global safe fallback (marks result `isGeneral: true`).
 *
 * Pure + deterministic. All strings come from the rules config so
 * tests and UI read the same values.
 */

import {
  RULES, GLOBAL_FALLBACK, SUPPORTED_COUNTRIES, FIT_WEIGHT,
} from '../../config/cropRecommendationRules.js';
import { getCropLabel } from '../../config/crops.js';
import {
  matchCropRiskPatterns,
  getCropSeasonalGuidance,
  normalizeCropKey,
} from '../../config/crops/index.js';

// ─── Month → season inference ─────────────────────────────────────
// Coarse mapping. The risk/season trigger system operates on
// 'wet' | 'dry' | 'summer' | 'winter' | 'spring' | 'fall'. For
// the tropical countries Farroway cares about most (GH, NG, KE, IN),
// month → wet/dry is the useful split; temperate (US) maps to the
// four meteorological seasons.
const TROPICAL_COUNTRIES = new Set(['GH', 'NG', 'KE', 'IN']);
function inferSeason({ country, month }) {
  const m = Number.isFinite(month) ? month : null;
  if (m == null) return null;
  if (country && TROPICAL_COUNTRIES.has(country)) {
    // Very coarse: northern hemisphere tropics treat Apr–Oct as main
    // rainy stretch. Works for Ghana/Nigeria/India; East Africa (KE)
    // has two short windows (Mar–May, Oct–Dec) — we call those wet.
    if (country === 'KE') {
      return ([3, 4, 5, 10, 11, 12].includes(m)) ? 'wet' : 'dry';
    }
    return (m >= 4 && m <= 10) ? 'wet' : 'dry';
  }
  // Temperate (default): Northern-hemisphere seasons.
  if ([12, 1, 2].includes(m)) return 'winter';
  if ([3, 4, 5].includes(m))  return 'spring';
  if ([6, 7, 8].includes(m))  return 'summer';
  return 'fall';
}

function inferClimate({ country }) {
  if (!country) return null;
  if (TROPICAL_COUNTRIES.has(country)) return 'tropical';
  if (country === 'US') return 'temperate';
  return null;
}

const DEFAULT_LIMIT = 5;
const MIN_LIMIT = 3;

/**
 * pickSourceRules — returns `{ rules, source, isGeneral }` based on
 * which layer produced the recommendations.
 */
function pickSourceRules({ country, state }) {
  const c = country ? String(country).toUpperCase() : null;
  const s = state ? String(state).toUpperCase() : null;
  if (c && RULES[c]) {
    if (s && RULES[c].states && RULES[c].states[s] && RULES[c].states[s].length > 0) {
      return { rules: RULES[c].states[s], source: 'state', isGeneral: false };
    }
    return { rules: RULES[c].defaults, source: 'country', isGeneral: false };
  }
  return { rules: GLOBAL_FALLBACK, source: 'global', isGeneral: true };
}

function mapConfidenceToScore(fit) {
  const w = FIT_WEIGHT[fit];
  return Number.isFinite(w) ? w : FIT_WEIGHT.medium;
}

/**
 * recommendCrops — pure recommender; returns the top `limit` crops
 * for the supplied context.
 *
 *   ctx:
 *     country?:    ISO-2 uppercase
 *     state?:      subdivision code (US: state abbr; IN: PB/MH/etc.)
 *     farmerType?: 'new' | 'existing' | null — affects the UI hint
 *                  string, never the ranking
 *     limit?:      3..5; default 5
 */
export function recommendCrops(ctx = {}) {
  const country = ctx.country ? String(ctx.country).toUpperCase() : null;
  const state   = ctx.state   ? String(ctx.state).toUpperCase()   : null;
  const farmerType = ctx.farmerType === 'existing' ? 'existing'
                   : ctx.farmerType === 'new'      ? 'new'
                   : null;
  const limit = Number.isFinite(ctx.limit)
    ? Math.max(MIN_LIMIT, Math.min(5, Math.floor(ctx.limit)))
    : DEFAULT_LIMIT;

  // ─── Crop Intelligence Layer enrichment inputs ────────────────
  // Callers can pass raw month/season/weather; the engine normalises
  // them into the { climate, season } shape used by the risk pattern
  // matcher. Unknown/missing inputs fall through gracefully.
  const month = Number.isFinite(ctx.month) ? Math.floor(ctx.month) : null;
  const season = ctx.season || inferSeason({ country, month });
  const climate = ctx.climate || inferClimate({ country });
  const weather = ctx.weather || null;

  const { rules, source, isGeneral } = pickSourceRules({ country, state });

  // Convert + rank. Stable order: fit weight desc, then input order.
  const decorated = rules.map((rule, i) => {
    const canonical = normalizeCropKey(rule.crop) || rule.crop;
    const riskNotes = matchCropRiskPatterns({
      canonicalKey: canonical,
      climate,
      season,
    }).map((p) => Object.freeze({
      severity:   p.severity,
      message:    p.message,
      messageKey: p.messageKey,
      why:        p.why,
      type:       p.type,
    }));
    const guidance = getCropSeasonalGuidance(canonical, country);

    return {
      crop:           rule.crop,
      label:          getCropLabel(rule.crop) || rule.crop,
      confidence:     rule.fit || 'medium',
      fit:            mapConfidenceToScore(rule.fit),
      reason:         rule.why || '',
      plantingWindow: rule.plantingWindow || null,
      note:           rule.note || null,
      source,
      farmerTypeHint: farmerType,
      // ─── Crop Intelligence Layer enrichments (additive) ────
      riskNotes:      Object.freeze(riskNotes),
      seasonalGuidance: guidance
        ? Object.freeze({
            plantingWindow: guidance.plantingWindow || null,
            avoidWindow:    guidance.avoidWindow || null,
            harvestCue:     guidance.harvestCue || null,
          })
        : null,
      _order:         i,
    };
  });
  decorated.sort((a, b) => (b.fit - a.fit) || (a._order - b._order));

  const top = decorated.slice(0, limit).map((r) => {
    const out = { ...r };
    delete out._order;
    return Object.freeze(out);
  });

  return Object.freeze({
    items:        Object.freeze(top),
    source,
    isGeneral,
    country,
    state,
    farmerType,
    supported:    !isGeneral,
    // Context the engine resolved (so callers can show the user
    // what the recommendation is based on).
    context:      Object.freeze({
      month, season, climate,
      weatherStatus: weather && weather.status ? weather.status : null,
    }),
  });
}

/**
 * recommendCropsForScreen — adapter that returns the array directly
 * in the shape CropRecommendationScreen already consumes:
 *   [{ crop, label, reason, confidence, plantingWindow, note }]
 *
 * Keeps the screen dumb and back-compatible with any older caller
 * that only looks at `crop` / `label` / `reason`.
 */
export function recommendCropsForScreen(ctx = {}) {
  const r = recommendCrops(ctx);
  return r.items.map((i) => Object.freeze({
    crop:             i.crop,
    label:            i.label,
    reason:           i.reason,
    confidence:       i.confidence,
    fit:              i.fit,
    plantingWindow:   i.plantingWindow,
    note:             i.note,
    source:           i.source,
    isGeneral:        r.isGeneral,
    // Crop Intelligence Layer enrichments (screen UI can render if
    // space permits; legacy consumers ignore):
    riskNotes:        i.riskNotes || Object.freeze([]),
    seasonalGuidance: i.seasonalGuidance || null,
  }));
}

export { SUPPORTED_COUNTRIES };
export const _internal = Object.freeze({
  pickSourceRules, mapConfidenceToScore,
  inferSeason, inferClimate,
});
