/**
 * farmToCropFitAnswers.js — project an existing farm record
 * into the answers shape the legacy cropFit engine expects
 * (location, landSize, waterAccess, budget, experience, goal,
 * preferredCrop, country).
 *
 * This lets "Find My Best Crop" work for existing users —
 * before this, the recommendations page required a wizard
 * state blob in location.state that direct navigation didn't
 * provide, so the button appeared to do nothing.
 *
 * Pure. Safe on partial / null input.
 */

/** Map numeric acres to the engine's three-bucket landSize. */
function sizeToLandBucket(size, unit) {
  if (size == null) return 'small';          // safe default
  const acres = unit === 'HECTARE' ? Number(size) * 2.471 : Number(size);
  if (!Number.isFinite(acres)) return 'small';
  if (acres < 2)    return 'small';
  if (acres <= 10)  return 'medium';
  return 'large';
}

/**
 * buildCropFitAnswersFromFarm — minimum-viable answers built
 * purely from farm state. Missing fields get conservative
 * defaults; engines should still produce sensible results.
 */
export function buildCropFitAnswersFromFarm(farm = {}) {
  const f = (farm && typeof farm === 'object') ? farm : {};
  const country = f.countryCode || f.country || '';
  const stateCode = f.stateCode || '';
  const location = stateCode
    ? `${stateCode}, ${country}`
    : (country || 'unknown');

  return Object.freeze({
    farmId:        f.id || null,
    location,
    landSize:      sizeToLandBucket(f.size, f.sizeUnit),
    waterAccess:   f.waterAccess || 'rain_only',
    budget:        f.budget       || 'low',
    experience:    f.experience   || 'some',
    goal:          f.goal         || 'home_food',
    preferredCrop: (f.cropType || f.crop || '').toString().toLowerCase() || null,
    country:       country.toUpperCase() || null,
    // Keep originals available for callers that want to render
    // "Current crop" badges or "Switch this farm" CTAs.
    _currentCrop:  (f.cropType || f.crop || '').toString().toLowerCase() || null,
  });
}

/**
 * hasEnoughForRecommendations — true when we have enough to
 * generate at least rough recommendations (country is the
 * minimum viable signal; everything else has sensible defaults).
 */
export function hasEnoughForRecommendations(farm) {
  if (!farm || typeof farm !== 'object') return false;
  const cc = farm.countryCode || farm.country;
  return !!(cc && String(cc).trim());
}
