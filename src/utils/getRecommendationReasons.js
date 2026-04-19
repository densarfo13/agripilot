/**
 * getRecommendationReasons({ crop, region, season, farmSize,
 *                            beginnerLevel, farmType }, t) → string[]
 *
 * Builds 2–3 human-readable, farmer-facing reason strings for a
 * recommendation card. Takes the scored crop plus the farmer's
 * onboarding context and generates sentences like:
 *   "Good for small farms in your region"
 *   "Beginner-friendly"
 *   "Planting window is currently open"
 *
 * Every string routes through `t()` so reasons localize cleanly.
 * The helper caps output at 3 so cards stay scannable.
 */

const MAX_REASONS = 3;

const BEGINNER_FRIENDLY = new Set([
  'tomato', 'pepper', 'lettuce', 'beans', 'bush_beans',
  'herbs', 'cucumber', 'radish', 'carrot', 'kale', 'zucchini',
  'green_onion', 'collards', 'swiss_chard',
]);

/**
 * @param {Object} args
 * @param {Object} args.crop            scored-crop payload from /suitability
 * @param {Object} [args.region]        { stateLabel, regionLabel, country }
 * @param {Object} [args.season]        { currentMonth, plantingStatus }
 * @param {string} [args.farmSize]      'small' | 'medium' | 'large'
 * @param {string} [args.beginnerLevel] 'beginner' | 'intermediate' | 'advanced'
 * @param {string} [args.farmType]      'backyard' | 'small_farm' | 'commercial'
 * @param {Function} t                  bound translator
 */
export function getRecommendationReasons(args = {}, t) {
  const reasons = [];
  const crop = args.crop || {};
  const regionLabel = args.region?.regionLabel || crop.regionLabel;

  // 1. Fit-driven reason — highest priority.
  if (crop.fitLevel === 'high') {
    reasons.push(
      regionLabel
        ? t('recReason.highFitInRegion', { region: regionLabel })
        : t('recReason.highFit'),
    );
  } else if (crop.fitLevel === 'medium') {
    reasons.push(t('recReason.mediumFit'));
  }

  // 2. Planting status — time-sensitive, farmer-actionable.
  const status = args.season?.plantingStatus || crop.plantingStatus;
  if (status === 'plant_now') reasons.push(t('recReason.plantNow'));
  else if (status === 'plant_soon') reasons.push(t('recReason.plantSoon'));

  // 3. Beginner-friendly — only surface when the farmer said they're new.
  if (args.beginnerLevel === 'beginner' && BEGINNER_FRIENDLY.has(String(crop.crop || '').toLowerCase())) {
    reasons.push(t('recReason.beginnerFriendly'));
  }

  // 4. Farm-size match — adds trust for small-farm / commercial paths.
  if (args.farmSize === 'small' || args.farmType === 'backyard') {
    if (BEGINNER_FRIENDLY.has(String(crop.crop || '').toLowerCase())) {
      reasons.push(t('recReason.goodForSmallFarms'));
    }
  }
  if (args.farmType === 'commercial' && crop.explain?.components?.marketFit >= 80) {
    reasons.push(t('recReason.strongMarket'));
  }

  // 5. Component-driven fallbacks — only if we don't already have 2.
  if (reasons.length < 2) {
    if (crop.explain?.components?.climateFit >= 80) reasons.push(t('recReason.climateFit'));
    if (reasons.length < 2 && crop.explain?.components?.seasonFit === 100) {
      reasons.push(t('recReason.seasonFit'));
    }
  }

  // 6. Server-provided reasons as a last fallback — keep them if the
  //    above generated less than 2 reasons and the server supplied any.
  if (reasons.length < 2 && Array.isArray(crop.reasons)) {
    for (const r of crop.reasons) {
      if (reasons.length >= MAX_REASONS) break;
      if (typeof r === 'string' && !reasons.includes(r)) reasons.push(r);
    }
  }

  // Deduplicate + cap.
  const seen = new Set();
  return reasons.filter((r) => {
    if (!r || seen.has(r)) return false;
    seen.add(r);
    return true;
  }).slice(0, MAX_REASONS);
}
