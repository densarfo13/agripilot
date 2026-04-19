/**
 * buildOfflineFallbackTask — deterministic "something useful to do today"
 * task when we have no cache and no network.
 *
 * The rule: even when everything fails, the farmer should see ONE calm,
 * context-aware action they can take on their own land right now. The
 * task is derived purely from local context (countryCode, cropId, month,
 * landProfile) — no network, no randomness. Same inputs always produce
 * the same task so a farmer opening the app twice on the same day never
 * sees it flip-flop.
 *
 * Returned shape matches getFallbackTodayAction() so the Tasks screen
 * can render it through its existing fallback path.
 */

function monthOf(date) {
  const d = date instanceof Date ? date : new Date();
  return d.getMonth() + 1; // 1..12
}

/**
 * @param {Object} ctx
 * @param {string} [ctx.countryCode]  'GH' | 'NG' | 'IN' | 'US' | ...
 * @param {string} [ctx.cropId]       'maize' | 'rice' | 'cassava' | ...
 * @param {number} [ctx.month]        1..12, defaults to current month
 * @param {Object} [ctx.landProfile]  { state: 'fallow' | 'growing' | 'harvested' | ... }
 */
export function buildOfflineFallbackTask(ctx = {}) {
  const month = Number.isFinite(ctx.month) ? ctx.month : monthOf(new Date());
  const country = String(ctx.countryCode || '').toUpperCase();
  const crop = String(ctx.cropId || '').toLowerCase();
  const landState = String(ctx.landProfile?.state || '').toLowerCase();

  // 1. Land state takes priority — if the farmer told us the land is
  //    fallow/harvested/prepping, that's more reliable than crop calendar.
  if (landState === 'fallow' || landState === 'harvested') {
    return shape('offline_fallback_land_rest', 'offline.fallback.land_rest.title',
      'offline.fallback.land_rest.why', 'offline.fallback.land_rest.next');
  }
  if (landState === 'prepping' || landState === 'preparing') {
    return shape('offline_fallback_land_prep', 'offline.fallback.land_prep.title',
      'offline.fallback.land_prep.why', 'offline.fallback.land_prep.next');
  }

  // 2. Crop + month — very rough calendar buckets. We only use these
  //    when they point to a clearly farmer-actionable window. Anything
  //    ambiguous falls through to the generic "walk the field" action.
  if (crop === 'maize' || crop === 'corn') {
    if (isGrowingSeason(country, month)) {
      return shape('offline_fallback_maize_scout', 'offline.fallback.maize_scout.title',
        'offline.fallback.maize_scout.why', 'offline.fallback.maize_scout.next');
    }
  }
  if (crop === 'rice') {
    if (isMonsoon(country, month)) {
      return shape('offline_fallback_rice_water', 'offline.fallback.rice_water.title',
        'offline.fallback.rice_water.why', 'offline.fallback.rice_water.next');
    }
  }
  if (crop === 'cassava' || crop === 'yam') {
    return shape('offline_fallback_root_weed', 'offline.fallback.root_weed.title',
      'offline.fallback.root_weed.why', 'offline.fallback.root_weed.next');
  }

  // 3. Generic walk-the-field. Safe for every country, every crop,
  //    every month — "look at your land and note what looks off".
  return shape('offline_fallback_today', 'offline.fallback.title',
    'offline.fallback.why', 'offline.fallback.next');
}

function shape(id, titleKey, whyKey, nextKey) {
  return {
    id,
    titleKey,
    whyKey,
    nextKey,
    ctaKey: 'offline.tryAgain',
    icon: '\uD83C\uDF3E',
    source: 'fallback',
    _deterministic: true,
  };
}

function isGrowingSeason(country, month) {
  // Very conservative: only fire when we're confident.
  if (country === 'GH' || country === 'NG') {
    // West Africa main season: Apr–Jul
    return month >= 4 && month <= 7;
  }
  if (country === 'IN') {
    // Kharif: Jun–Oct
    return month >= 6 && month <= 10;
  }
  if (country === 'US') {
    // Corn belt: May–Aug
    return month >= 5 && month <= 8;
  }
  return false;
}

function isMonsoon(country, month) {
  if (country === 'IN') return month >= 6 && month <= 9;
  if (country === 'GH' || country === 'NG') return month >= 5 && month <= 9;
  return false;
}
