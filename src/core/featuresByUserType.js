/**
 * featuresByUserType.js — per-userType feature visibility map.
 *
 *   import { isFeatureVisible, getVisibleFeatures }
 *     from '../core/featuresByUserType.js';
 *
 *   if (isFeatureVisible('showCosts')) {
 *     // render cost-tracking UI
 *   }
 *
 * Why a sibling registry rather than extending featureTier.js
 * ────────────────────────────────────────────────────────────
 *   `featureTier.js` answers "does this user's TIER (FREE /
 *   PRO / PRO_PLUS) include this feature?" — a billing
 *   concern. THIS module answers "does this user's TYPE
 *   (backyard / farmer / ngo) see this feature in their UI?"
 *   — a UX concern. They compose:
 *     • showCosts visible to farmer + paid → render
 *     • showCosts visible to backyard      → render the free
 *                                             surface; gate
 *                                             paid sub-features
 *                                             via featureTier
 *
 *   A backyard user who upgrades to Pro doesn't suddenly
 *   want the cost-tracking UI — that's farmer-specific. A
 *   farmer who hasn't upgraded still sees the cost surface
 *   but the advanced sub-features gate via featureTier.
 *
 * Spec coverage (Build Full Frontend Architecture §5)
 *   backyard / farmer / ngo each get a visibility table.
 *   The TABLE itself is the source of truth; consumers ask
 *   `isFeatureVisible(key)` and never duplicate the rules.
 *
 * Strict-rule audit
 *   • Pure read — never writes, never throws.
 *   • Unknown feature names default to `false` (conservative
 *     hide-by-default; opting a new feature in is a single-
 *     line registry edit).
 *   • Unknown userType collapses to 'farmer' (full feature
 *     set; the conservative show-by-default).
 *   • SSR-safe.
 */

import { getUserType as _getUserType } from './userType.js';

/**
 * Visibility matrix. Each top-level key is a userType; each
 * inner key is a stable feature flag name. `true` means the
 * feature surface IS visible to that userType (with billing
 * gating still applying via featureTier where relevant).
 *
 * Adding a new feature is a one-line change here + the
 * `isFeatureVisible(key)` call at the consume site.
 */
export const FEATURE_VISIBILITY = Object.freeze({
  backyard: Object.freeze({
    showCosts:             false,
    showFunding:           false,
    showSell:              false,
    showAdvancedAnalytics: false,
    showScan:              true,
    showTasks:             true,
    showProgress:          true,
    showShare:             true,
    showDashboard:         false,
    showFarmerManagement:  false,
    showExports:           false,
  }),
  farmer: Object.freeze({
    showCosts:             true,
    showFunding:           true,
    showSell:              true,
    showAdvancedAnalytics: true,
    showScan:              true,
    showTasks:             true,
    showProgress:          true,
    showShare:             true,
    showDashboard:         false,
    showFarmerManagement:  false,
    showExports:           false,
  }),
  ngo: Object.freeze({
    showCosts:             true,
    showFunding:           true,
    showSell:              true,
    showAdvancedAnalytics: true,
    showScan:              true,
    showTasks:             true,
    showProgress:          true,
    showShare:             false,
    showDashboard:         true,
    showFarmerManagement:  true,
    showExports:           true,
  }),
});

const SUPPORTED_TYPES = Object.freeze(['backyard', 'farmer', 'ngo']);

/**
 * isFeatureVisible(featureKey, userType?) → boolean.
 *
 * Returns true when the supplied (or current) user type
 * should see the feature surface in their UI. Unknown keys
 * default to `false` (conservative hide); unknown userTypes
 * collapse to 'farmer' (conservative show — the full feature
 * set, never accidentally hide functionality on a stale
 * userType value).
 */
export function isFeatureVisible(featureKey, userType) {
  if (!featureKey) return false;
  let ut = userType;
  if (!ut) {
    try { ut = _getUserType(); }
    catch { ut = 'farmer'; }
  }
  if (!SUPPORTED_TYPES.includes(ut)) ut = 'farmer';
  const row = FEATURE_VISIBILITY[ut];
  return !!(row && row[featureKey] === true);
}

/**
 * getVisibleFeatures(userType?) → array of feature keys the
 * supplied user type can see. Useful for the launch-readiness
 * audit + the NGO dashboard's "what does this user see?"
 * tooling.
 */
export function getVisibleFeatures(userType) {
  let ut = userType;
  if (!ut) {
    try { ut = _getUserType(); }
    catch { ut = 'farmer'; }
  }
  if (!SUPPORTED_TYPES.includes(ut)) ut = 'farmer';
  const row = FEATURE_VISIBILITY[ut];
  if (!row) return [];
  return Object.keys(row).filter((k) => row[k] === true);
}

export const _internal = Object.freeze({ SUPPORTED_TYPES });

export default {
  FEATURE_VISIBILITY,
  isFeatureVisible,
  getVisibleFeatures,
};
