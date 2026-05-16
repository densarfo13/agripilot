/**
 * entitlements.js — Phase 9 billing entitlement seam.
 *
 *   import { hasEntitlement, getSubscriptionStatus, FREE_FOREVER }
 *     from 'src/core/billing/entitlements.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A placeholder feature-access guard. While FEATURE_BILLING is
 *   OFF (the default — see featureFlags.js), EVERYTHING is
 *   entitled: there is no paywall, no payment UI, nothing is
 *   charged, no ads. This module is purely the architectural
 *   SEAM so paid tiers can be added LATER, behind flags, once
 *   retention data justifies them.
 *
 * Trust rules (spec §15) — encoded here, not optional:
 *   • FREE_FOREVER capabilities (basic scan results, safety
 *     guidance, basic tasks / weather / journal, the manual
 *     fallback) are NEVER gated — not even when billing is on.
 *     Critical safety guidance is never monetized.
 *   • An unknown capability id is treated as entitled — the guard
 *     never accidentally paywalls a feature.
 *
 * Strict-rule audit
 *   • Pure (modulo a localStorage plan read). Never throws.
 *   • SSR-safe. No payment SDK, no network.
 */

import { isFeatureEnabled } from '../../utils/featureFlags.js';

// Capabilities that are FREE FOREVER — never behind any paywall.
export const FREE_FOREVER = Object.freeze([
  'scan_result', 'scan_basic', 'safety_guidance', 'basic_tasks',
  'weather_basic', 'journal_basic', 'crop_localization', 'manual_fallback',
]);

// Capabilities a future premium tier MAY gate (once billing is on).
export const PREMIUM_CAPABILITIES = Object.freeze([
  'premium_predictive_alerts', 'advanced_scan_history',
  'advanced_market_timing', 'advanced_copilot', 'priority_support',
]);

export const PLAN = Object.freeze({ FREE: 'free', PREMIUM: 'premium' });

function _billingOn() {
  try { return isFeatureEnabled('FEATURE_BILLING'); }
  catch { return false; }
}

/** The device's current plan — placeholder read; no billing yet. */
export function getPlan() {
  try {
    if (typeof localStorage === 'undefined') return PLAN.FREE;
    return localStorage.getItem('farroway_billing_plan') === PLAN.PREMIUM
      ? PLAN.PREMIUM
      : PLAN.FREE;
  } catch {
    return PLAN.FREE;
  }
}

/**
 * Subscription status placeholder (spec §14). No real billing
 * system exists — status is always 'none' until FEATURE_BILLING
 * and a real provider are wired.
 *
 * @returns {{ billingEnabled: boolean, plan: string, status: string }}
 */
export function getSubscriptionStatus() {
  return Object.freeze({
    billingEnabled: _billingOn(),
    plan:           getPlan(),
    status:         'none',
  });
}

/**
 * Whether a capability is accessible to this user.
 *
 *   • FREE_FOREVER capability        → always true (trust rule §15)
 *   • billing OFF (default)          → true for everything
 *   • billing ON + premium capability→ requires the premium plan
 *   • unknown capability             → true (never accidentally gate)
 *
 * Never throws. Defaults to ENTITLED on any error — a billing
 * placeholder must never lock a farmer out of a working feature.
 *
 * @param {string} featureId
 * @param {object} [opts]  { plan } — inject the plan for tests
 * @returns {boolean}
 */
export function hasEntitlement(featureId, opts) {
  try {
    const id = String(featureId || '');
    if (!id) return true;
    if (FREE_FOREVER.includes(id)) return true;
    if (!_billingOn()) return true;
    if (PREMIUM_CAPABILITIES.includes(id)) {
      const plan = (opts && opts.plan) || getPlan();
      return plan === PLAN.PREMIUM;
    }
    return true;
  } catch {
    return true;
  }
}

const _module = {
  FREE_FOREVER,
  PREMIUM_CAPABILITIES,
  PLAN,
  getPlan,
  getSubscriptionStatus,
  hasEntitlement,
};
export default _module;
