/**
 * recommendationContext.js — pure mapper that projects a farm
 * record into the context object the recommendation engine
 * expects.
 *
 * §6 contract:
 *
 *   getCropRecommendationsForFarm({
 *     farmId, cropId, countryCode, stateCode,
 *     farmSize, stage, regionBucket?, weatherContext?
 *   }) → [ { cropId, score, reasonKey, params, isCurrentCrop } ]
 *
 * This module builds ONLY the input; callers feed it to whatever
 * recommendation engine the app uses. That keeps this layer
 * testable and free of network/react concerns.
 */

/**
 * buildRecommendationContext — project a farm into the engine
 * input shape. Accepts either the v2 "profile" shape or the
 * legacy "farm" shape; everything else is normalized out.
 *
 * weatherContext is opt-in — callers pass the context from
 * WeatherContext if they already have it. Engines should treat
 * it as optional.
 */
export function buildRecommendationContext(farm = {}, extras = {}) {
  const f = (farm && typeof farm === 'object') ? farm : {};
  const countryCode = (f.countryCode || f.country || '').toString().trim() || null;
  const stateCode   = (f.stateCode   || f.state   || '').toString().trim() || null;
  const cropId      = (f.cropId      || f.cropType || f.crop || '').toString().trim().toLowerCase() || null;
  const stage       = (f.stage       || f.cropStage || '').toString().trim() || null;
  const farmSize    = f.size != null ? Number(f.size) : (f.farmSize != null ? Number(f.farmSize) : null);

  const ctx = {
    farmId:      f.id || f.farmId || null,
    cropId,
    countryCode,
    stateCode,
    farmSize:    Number.isFinite(farmSize) ? farmSize : null,
    farmSizeUnit:f.sizeUnit || f.farmSizeUnit || null,
    stage,
  };

  if (extras && typeof extras === 'object') {
    if (extras.regionBucket)   ctx.regionBucket   = String(extras.regionBucket);
    if (extras.weatherContext) ctx.weatherContext = extras.weatherContext;
  }

  return Object.freeze(ctx);
}

/**
 * normalizeRecommendationResult — pure validator for what the
 * engine RETURNS. Guarantees every entry has a usable shape;
 * drops unusable entries silently.
 *
 * Each item expected:
 *   { cropId, score, reasonKey, params?, isCurrentCrop? }
 */
export function normalizeRecommendationResult(items, currentCropId = null) {
  if (!Array.isArray(items)) return [];
  const current = (currentCropId || '').toString().trim().toLowerCase();
  return items
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const cropId = String(x.cropId || x.crop || '').toLowerCase().trim();
      if (!cropId) return null;
      const score = Number.isFinite(Number(x.score)) ? Number(x.score) : null;
      const reasonKey = typeof x.reasonKey === 'string' && x.reasonKey
        ? x.reasonKey : 'recommendation.no_reason';
      const params = x.params && typeof x.params === 'object' ? x.params : {};
      const isCurrentCrop = !!x.isCurrentCrop || (current !== '' && cropId === current);
      return Object.freeze({ cropId, score, reasonKey, params, isCurrentCrop });
    })
    .filter(Boolean);
}

/**
 * rankRecommendations — stable sort by score descending with
 * current crop pinned second place when tied so the user sees
 * "a better option first, your current crop still good" ordering.
 */
export function rankRecommendations(items) {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const sa = a.score == null ? -Infinity : a.score;
    const sb = b.score == null ? -Infinity : b.score;
    if (sa !== sb) return sb - sa;
    // Tie-break: non-current first so we spotlight alternatives.
    if (!a.isCurrentCrop && b.isCurrentCrop) return -1;
    if (a.isCurrentCrop && !b.isCurrentCrop) return 1;
    return 0;
  });
}
