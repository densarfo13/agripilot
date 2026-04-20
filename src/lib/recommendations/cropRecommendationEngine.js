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

  const { rules, source, isGeneral } = pickSourceRules({ country, state });

  // Convert + rank. Stable order: fit weight desc, then input order.
  const decorated = rules.map((rule, i) => ({
    crop:           rule.crop,
    label:          getCropLabel(rule.crop) || rule.crop,
    confidence:     rule.fit || 'medium',
    fit:            mapConfidenceToScore(rule.fit),
    reason:         rule.why || '',
    plantingWindow: rule.plantingWindow || null,
    note:           rule.note || null,
    source,
    farmerTypeHint: farmerType,
    _order:         i,
  }));
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
    crop:           i.crop,
    label:          i.label,
    reason:         i.reason,
    confidence:     i.confidence,
    fit:            i.fit,
    plantingWindow: i.plantingWindow,
    note:           i.note,
    source:         i.source,
    isGeneral:      r.isGeneral,
  }));
}

export { SUPPORTED_COUNTRIES };
export const _internal = Object.freeze({ pickSourceRules, mapConfidenceToScore });
