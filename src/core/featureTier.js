/**
 * featureTier.js — central registry mapping every monetised
 * feature to its required tier. Source of truth for the
 * Premium Feature Roadmap spec.
 *
 *   import {
 *     TIERS, FEATURES,
 *     getCurrentTier,
 *     hasFeatureAccess,
 *     requiresTier,
 *     listFeaturesByTier,
 *   } from '../core/featureTier.js';
 *
 *   if (hasFeatureAccess('unlimited_scan')) {
 *     // render unlimited-scan affordance
 *   } else {
 *     // surface paywall
 *   }
 *
 * Why a registry rather than scattered isPro() checks
 * ───────────────────────────────────────────────────
 *   Before this module, "is this feature paid?" was decided at
 *   the call site via direct `isPro()` checks. That made the
 *   roadmap implicit (you had to grep the codebase to enumerate
 *   what's gated). The registry inverts the relationship: the
 *   feature roadmap is now a single readable table, and call
 *   sites just ask "do I have access?".
 *
 * Tier semantics
 *   FREE     — every signed-in user
 *   PRO      — $7/month or active 7-day trial
 *   PRO_PLUS — future tier (predictions, exports, analytics);
 *              the flag exists so call sites can gate on it
 *              today, but isProPlus() returns false until the
 *              billing layer ships the paid SKU
 *
 * Strict-rule audit
 *   • Pure derivation — never writes, never throws.
 *   • Never throws — `isPro()` is wrapped, unknown feature
 *     names default to FREE so a missed registry entry can
 *     never accidentally lock a free user out.
 *   • SSR-safe (no browser globals at module load).
 */

import { isPro } from './paywall.js';

/** Tier ordering — used for "do I have AT LEAST tier X" checks. */
export const TIERS = Object.freeze({
  FREE:     'free',
  PRO:      'pro',
  PRO_PLUS: 'pro_plus',
});

const TIER_RANK = Object.freeze({
  free:     0,
  pro:      1,
  pro_plus: 2,
});

/**
 * The Premium Feature Roadmap, executable.
 *
 * Each entry maps a stable feature name (used by call sites in
 * `hasFeatureAccess('xxx')`) to the minimum tier required to
 * use it. Adding a new gated feature is a one-line change here
 * + one line at the call site — no scattered isPro() audits.
 *
 * Spec §1 Free features:
 *   daily_actions, limited_scan, basic_explanation, simple_progress
 *
 * Spec §2 Pro features:
 *   unlimited_scan, detailed_diagnosis, smart_recommendations,
 *   why_insights, history_trends, alerts
 *
 * Spec §3 Pro+ features (later — stub today):
 *   predictions, exports, analytics
 */
export const FEATURES = Object.freeze({
  // ── §1 FREE ─────────────────────────────────────────────
  daily_actions:        TIERS.FREE,
  limited_scan:         TIERS.FREE,
  basic_explanation:    TIERS.FREE,
  simple_progress:      TIERS.FREE,

  // ── §2 PRO ──────────────────────────────────────────────
  unlimited_scan:       TIERS.PRO,
  detailed_diagnosis:   TIERS.PRO,
  smart_recommendations: TIERS.PRO,
  why_insights:         TIERS.PRO,
  history_trends:       TIERS.PRO,
  alerts:               TIERS.PRO,

  // ── §3 PRO+ (future — gated today, will be live when billing ships) ──
  predictions:          TIERS.PRO_PLUS,
  exports:              TIERS.PRO_PLUS,
  advanced_analytics:   TIERS.PRO_PLUS,
});

/**
 * Pro+ is the future tier. The billing layer hasn't shipped a
 * Pro+ SKU yet, so this returns false today — but every Pro+
 * feature gate already lives in FEATURES so the moment Pro+
 * lands, the flip is one isProPlus()-returning-true away.
 *
 * When Pro+ ships, swap the body to read a `farroway_pro_plus_status`
 * localStorage flag (parallel to isPro's `farroway_pro_status`)
 * or a server-side billing check. Every consumer of
 * hasFeatureAccess() picks up the change automatically.
 */
export function isProPlus() {
  return false;
}

/**
 * getCurrentTier() — returns the user's current tier as a
 * string. Pure read; never writes.
 */
export function getCurrentTier() {
  try {
    if (isProPlus()) return TIERS.PRO_PLUS;
  } catch { /* ignore */ }
  try {
    if (isPro()) return TIERS.PRO;
  } catch { /* ignore */ }
  return TIERS.FREE;
}

/**
 * requiresTier(featureName) — looks up the minimum tier the
 * feature needs. Returns FREE when the name is unknown so a
 * missed registry entry never accidentally locks a free user
 * out of something that should have been free.
 */
export function requiresTier(featureName) {
  if (!featureName) return TIERS.FREE;
  return FEATURES[featureName] || TIERS.FREE;
}

/**
 * hasFeatureAccess(featureName) — main entry. Returns true
 * when the user's current tier is at or above the feature's
 * minimum tier requirement.
 *
 * Pattern at call sites:
 *
 *   if (hasFeatureAccess('unlimited_scan')) {
 *     // render the affordance
 *   } else {
 *     // surface paywall (with the right trigger)
 *   }
 */
export function hasFeatureAccess(featureName) {
  const required = requiresTier(featureName);
  const current  = getCurrentTier();
  const reqRank  = TIER_RANK[required] ?? 0;
  const curRank  = TIER_RANK[current]  ?? 0;
  return curRank >= reqRank;
}

/**
 * listFeaturesByTier() — utility for the paywall UI / docs.
 * Returns:
 *   {
 *     free:     ['daily_actions', 'limited_scan', ...],
 *     pro:      ['unlimited_scan', ...],
 *     pro_plus: ['predictions', ...],
 *   }
 *
 * Used by the paywall's benefit list (in a future iteration)
 * and by the launch-readiness audit to verify the roadmap
 * matches the spec.
 */
export function listFeaturesByTier() {
  const out = { free: [], pro: [], pro_plus: [] };
  for (const [name, tier] of Object.entries(FEATURES)) {
    if (out[tier]) out[tier].push(name);
  }
  // Sort each tier alphabetically so the output is stable
  // across runs (caller can rely on identical ordering).
  for (const k of Object.keys(out)) out[k].sort();
  return Object.freeze({
    free:     Object.freeze(out.free),
    pro:      Object.freeze(out.pro),
    pro_plus: Object.freeze(out.pro_plus),
  });
}

export const _internal = Object.freeze({
  TIER_RANK,
});

export default {
  TIERS, FEATURES,
  isProPlus, getCurrentTier, requiresTier,
  hasFeatureAccess, listFeaturesByTier,
};
