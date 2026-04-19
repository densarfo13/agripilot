/**
 * featureGates.js — mode-aware feature visibility so screens /
 * nav / CTAs can check a single predicate instead of re-deriving
 * rules inline.
 *
 * Core rule from the dual-mode spec:
 *   - Backyard users don't sell. Marketplace / listings / buyer
 *     notifications are hidden by default.
 *   - Heavy farm analytics collapse to light summaries.
 *
 * None of these gates refuse data on the server — the server still
 * serves everything the user is authorized for. Gating is purely
 * presentational so upgrading a backyard profile to farm mode
 * instantly unlocks the hidden features without a server change.
 */

import { APP_MODE, getAppMode } from './getAppMode.js';

export function isMarketplaceEnabledForMode(source) {
  return getAppMode(source) === APP_MODE.FARM;
}

/** Should the post-harvest page show a "Sell this harvest?" CTA? */
export function shouldShowSellCta(source) {
  return isMarketplaceEnabledForMode(source);
}

/** Should the Today screen render the heavy farm-style analytics
 *  block (progress bar with overdue counts, weather-risk breakdown)?
 *  Backyard mode shows the lightweight status pill only. */
export function shouldShowFarmAnalytics(source) {
  return getAppMode(source) === APP_MODE.FARM;
}

/** Should the nav show buyer-side links? */
export function shouldShowBuyerNav(source) {
  return isMarketplaceEnabledForMode(source);
}

/**
 * getVisibleFeaturesForMode — single call the top-level shell /
 * nav can use to decide which surfaces to render. Returns booleans
 * so callers don't need to know the enum values.
 */
export function getVisibleFeaturesForMode(source) {
  const mode = getAppMode(source);
  return {
    mode,
    marketplace: mode === APP_MODE.FARM,
    buyerBrowse: mode === APP_MODE.FARM,
    sellCta:     mode === APP_MODE.FARM,
    heavyAnalytics: mode === APP_MODE.FARM,
    deepHarvestForm: mode === APP_MODE.FARM,
    commercialCrops: mode === APP_MODE.FARM,
  };
}
