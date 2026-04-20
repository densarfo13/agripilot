/**
 * selectBestCrop.js — pure helper behind the high-conversion
 * CropFit page. Given some (possibly minimal) signal about the
 * user's location / newness, return ONE best crop + a short list
 * of alternatives.
 *
 * Rules the UI depends on:
 *   • always returns a non-empty result (safety §5: "never empty
 *     screen, always fallback crop")
 *   • each entry has { code, name, score, risk, reasonKey, reasonFallback }
 *   • alternatives are never longer than `maxAlternatives` (default 2)
 *   • deterministic given the same inputs (easy to test)
 *
 * This is a pragmatic mapping on top of the existing recommendation
 * engine — when we have a farm profile we defer to it, otherwise
 * we fall back to a built-in starter list of beginner-safe crops.
 * No ML, no network.
 */

/**
 * STARTER_CROPS — hand-curated fallback list when we have zero
 * farm context beyond "new user". Pre-ranked so the first element
 * is always the safest beginner choice.
 */
const STARTER_CROPS = Object.freeze([
  Object.freeze({
    code: 'cassava', name: 'Cassava',
    score: 88, risk: 'low',
    reasonKey: 'cropFit.reason.cassava_hardy',
    reasonFallback: 'Hardy and drought-tolerant — forgiving to beginners.',
  }),
  Object.freeze({
    code: 'maize', name: 'Maize',
    score: 72, risk: 'medium',
    reasonKey: 'cropFit.reason.maize_reliable',
    reasonFallback: 'Reliable across most regions; needs steady rainfall.',
  }),
  Object.freeze({
    code: 'beans', name: 'Beans',
    score: 68, risk: 'low',
    reasonKey: 'cropFit.reason.beans_short_cycle',
    reasonFallback: 'Short cycle and low input — quick first harvest.',
  }),
  Object.freeze({
    code: 'rice', name: 'Rice',
    score: 65, risk: 'medium',
    reasonKey: 'cropFit.reason.rice_water',
    reasonFallback: 'Good when water access is strong; poor in dry plots.',
  }),
  Object.freeze({
    code: 'sorghum', name: 'Sorghum',
    score: 60, risk: 'low',
    reasonKey: 'cropFit.reason.sorghum_dry',
    reasonFallback: 'Drought-tolerant grain; common in dry-savanna belts.',
  }),
]);

/**
 * clampLat — rough equatorial-band heuristic so the starter ranking
 * isn't completely location-blind.
 *
 *   |lat| < 15 → tropical belt:      cassava/beans favoured
 *   15..35    → subtropical:          maize/sorghum favoured
 *   > 35      → temperate:            maize/rice reordered up
 */
function biasForLatitude(lat) {
  if (!Number.isFinite(lat)) return STARTER_CROPS;
  const abs = Math.abs(lat);
  if (abs < 15)  return STARTER_CROPS;  // already tuned for tropics
  if (abs < 35) {
    return Object.freeze([
      STARTER_CROPS[1], // maize up
      STARTER_CROPS[4], // sorghum up
      STARTER_CROPS[0], STARTER_CROPS[2], STARTER_CROPS[3],
    ]);
  }
  return Object.freeze([
    STARTER_CROPS[1], STARTER_CROPS[3], // maize + rice top
    STARTER_CROPS[0], STARTER_CROPS[2], STARTER_CROPS[4],
  ]);
}

/**
 * selectBestCrop — main export.
 *
 *   selectBestCrop({
 *     profile?,      // optional farm profile (same shape as ProfileContext's profile)
 *     onboarding?,   // optional { isNewFarmer, location }
 *     maxAlternatives? = 2,
 *   }) → { best, alternatives, source }
 *
 * `source` is one of:
 *   'profile_crop' — profile already has a crop, used as "best"
 *   'lat_biased'   — ranked from latitude heuristic
 *   'fallback'     — starter list unchanged (true first-time path)
 */
export function selectBestCrop({
  profile       = null,
  onboarding    = null,
  maxAlternatives = 2,
} = {}) {
  const alt = Math.max(0, Math.min(4, Number(maxAlternatives) || 2));

  // 1) Existing-user shortcut — if the profile already names a crop,
  //    treat it as "best" and show the starter list as alternatives.
  const profileCrop = profile && (profile.cropType || profile.crop);
  if (profileCrop) {
    const code = String(profileCrop).toLowerCase();
    const match = STARTER_CROPS.find((c) => c.code === code);
    const best = match || Object.freeze({
      code, name: code.charAt(0).toUpperCase() + code.slice(1),
      score: 80, risk: 'medium',
      reasonKey: 'cropFit.reason.current_crop_still_good',
      reasonFallback: 'Continuing with your current crop keeps momentum.',
    });
    const alternatives = STARTER_CROPS
      .filter((c) => c.code !== code)
      .slice(0, alt);
    return Object.freeze({ best, alternatives, source: 'profile_crop' });
  }

  // 2) Latitude-biased ranking when we have a geolocation.
  const lat = onboarding && onboarding.location && onboarding.location.lat;
  if (Number.isFinite(lat)) {
    const ranked = biasForLatitude(lat);
    return Object.freeze({
      best:         ranked[0],
      alternatives: Object.freeze(ranked.slice(1, 1 + alt)),
      source:       'lat_biased',
    });
  }

  // 3) Safe fallback — spec §5: default trio is cassava / maize / rice.
  const byCode = (code) => STARTER_CROPS.find((c) => c.code === code);
  const fallbackPicks = [byCode('cassava'), byCode('maize'), byCode('rice')]
    .filter(Boolean);
  return Object.freeze({
    best:         fallbackPicks[0] || STARTER_CROPS[0],
    alternatives: Object.freeze(fallbackPicks.slice(1, 1 + alt)),
    source:       'fallback',
  });
}

/**
 * resolveCropDecisionDestination — where "Use This Crop" should
 * send the user.
 *
 *   profile with id  → /edit-farm?farmId=X   (apply to current farm)
 *   no profile/id    → /farm/new             (create farm with this crop)
 */
export function resolveCropDecisionDestination({ profile = null } = {}) {
  const farmId = profile && profile.id;
  if (farmId) return `/edit-farm?farmId=${encodeURIComponent(farmId)}`;
  return '/farm/new';
}

/**
 * persistSelectedCrop — write the user's decision to localStorage
 * so the next screen can seed itself without re-asking. Pure and
 * safe when localStorage is unavailable.
 */
export function persistSelectedCrop(cropCode) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  if (!cropCode || typeof cropCode !== 'string') return false;
  try {
    window.localStorage.setItem('selected_crop', String(cropCode));
    return true;
  } catch { return false; }
}

export function readSelectedCrop() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try { return window.localStorage.getItem('selected_crop') || null; }
  catch { return null; }
}

export const _internal = { STARTER_CROPS, biasForLatitude };
