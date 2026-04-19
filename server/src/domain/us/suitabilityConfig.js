/**
 * suitabilityConfig.js — weights, thresholds, and guardrails for the
 * explicit weighted crop-suitability scorer. Everything lives as
 * plain data so ops can tune without re-reading the engine.
 *
 * Spec formula:
 *   score = climateFit*0.30 + regionFit*0.20 + seasonFit*0.20
 *         + farmTypeFit*0.10 + beginnerFit*0.05
 *         + marketFit*0.10 + growingStyleFit*0.05
 *
 * Fit bands:
 *   80-100 → high     60-79 → medium     0-59 → low
 *
 * Guardrails cap the score regardless of the weighted total when
 * the crop is clearly wrong for the context.
 */

export const WEIGHTS = Object.freeze({
  climateFit:      0.30,
  regionFit:       0.20,
  seasonFit:       0.20,
  farmTypeFit:     0.10,
  beginnerFit:     0.05,
  marketFit:       0.10,
  growingStyleFit: 0.05,
});

export const FIT_BANDS = Object.freeze({
  high:   80,
  medium: 60,
});

export const PLANTING_STATUS = Object.freeze({
  PLANT_NOW:   'plant_now',
  PLANT_SOON:  'plant_soon',
  WAIT:        'wait',
  AVOID:       'avoid',
});

/**
 * Hard guardrails — score caps + plantingStatus overrides applied
 * after the weighted sum. Each entry has a `when(ctx, info)`
 * predicate and a `cap` score; if the predicate fires, the final
 * score is `min(score, cap)` and plantingStatus may be overridden.
 */
export const GUARDRAILS = Object.freeze([
  {
    id: 'cassava_outside_tropics',
    when: ({ crop, stateCode, country, climateSubregion }) => {
      if (crop !== 'cassava') return false;
      const cc = String(country || '').toUpperCase();
      const isUs = cc === 'US' || cc === 'USA';
      if (!isUs) return false;
      return stateCode !== 'HI'
        && stateCode !== 'FL'
        && climateSubregion !== 'HAWAII_TROPICAL'
        && climateSubregion !== 'FLORIDA_SUBTROPICAL';
    },
    cap: 35,
    statusOverride: PLANTING_STATUS.AVOID,
    reason: 'Cassava needs a consistently tropical climate.',
  },
  {
    id: 'commercial_only_in_container_backyard',
    when: ({ crop, farmType, growingStyle }) =>
      farmType === 'backyard'
      && growingStyle === 'container'
      && ['corn', 'sweet_corn', 'sorghum', 'cotton', 'rice', 'sugarcane'].includes(crop),
    cap: 30,
    statusOverride: PLANTING_STATUS.AVOID,
    reason: "This crop needs more space than a backyard container.",
  },
  {
    id: 'season_hard_miss',
    when: (_ctx, info) => info.seasonFit != null && info.seasonFit < 15,
    cap: 50,
    statusOverride: PLANTING_STATUS.WAIT,
    reason: 'Out of the usual planting window for this crop.',
  },
  {
    id: 'climate_mismatch',
    when: (_ctx, info) => info.climateFit != null && info.climateFit < 20,
    cap: 55,
    reason: "Your climate isn't a strong match for this crop.",
  },
]);

export const DEFAULTS = Object.freeze({
  plantSoonMonths: 1,    // how many months before window open counts as "plant_soon"
});
