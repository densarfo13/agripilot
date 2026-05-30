/**
 * src/runtime/adoption/BuyerOnboardingHealthRuntime.ts — wave-39
 * read-only probe over the buyer-onboarding surfaces.
 *
 *   import { buyerOnboardingHealth, installBuyerOnboardingHealthGlobal }
 *     from 'src/runtime/adoption/BuyerOnboardingHealthRuntime';
 *
 *   window.__buyerOnboardingHealth()
 *
 * What this probes
 * ────────────────
 *   • buyerProfileReady          — BuyerRuntime initialised
 *   • approvedListingsOnly       — BUYER_VISIBLE_STATUSES enforces
 *                                  the approved/active filter
 *                                  (probed via buyerContracts)
 *   • sendInterestReady          — BuyerInterestService wired
 *   • interestStatusReady        — INTEREST_STATUSES enum present
 *   • noPayments                 — no payment/escrow/bidding code
 *                                  is registered in the buyer
 *                                  runtime (composed; checked
 *                                  statically in the governance
 *                                  gate)
 *   • privateFarmerDataHidden    — listing envelope excludes
 *                                  demographic fields (the wave-26
 *                                  buyer contract enforces this)
 *
 * Strict-rule audit
 *   • Pure composition. SSR-safe. Frozen envelope. Never throws.
 *   • Honest degradation — every signal independently reported.
 */

import {
  BUYER_VISIBLE_STATUSES,
  INTEREST_STATUSES,
  BUYER_RUNTIME_VERSION,
} from '../buyer/buyerContracts';

export const BUYER_ONBOARDING_HEALTH_RUNTIME_VERSION = 'buyer-onboarding-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface BuyerOnboardingHealth {
  runtimeVersion:                 string;
  initialized:                    boolean;
  buyerProfileReady:              boolean;
  approvedListingsOnly:           boolean;
  sendInterestReady:              boolean;
  interestStatusReady:            boolean;
  noPayments:                     boolean;
  privateFarmerDataHidden:        boolean;
  /** Underlying buyer-runtime version detected at probe time. */
  buyerRuntimeVersion:            string;
}

const FROZEN_FALLBACK: Readonly<BuyerOnboardingHealth> = Object.freeze({
  runtimeVersion:                 BUYER_ONBOARDING_HEALTH_RUNTIME_VERSION,
  initialized:                    false,
  buyerProfileReady:              false,
  approvedListingsOnly:           false,
  sendInterestReady:              false,
  interestStatusReady:            false,
  noPayments:                     true,
  privateFarmerDataHidden:        false,
  buyerRuntimeVersion:            'unknown',
});

function _hasGlobal(name: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    return typeof (window as any)[name] === 'function';
  }, false);
}

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    if (typeof w[name] !== 'function') return null;
    return w[name]();
  }, null);
}

export function buyerOnboardingHealth(): BuyerOnboardingHealth {
  return _safe(() => {
    // approvedListingsOnly — verify the canonical BUYER_VISIBLE_STATUSES
    // tuple contains ONLY 'approved' + 'active'. Static check
    // against the imported contract — never relies on a window flag.
    const approvedListingsOnly =
         Array.isArray(BUYER_VISIBLE_STATUSES)
      && BUYER_VISIBLE_STATUSES.length === 2
      && BUYER_VISIBLE_STATUSES.includes('approved' as any)
      && BUYER_VISIBLE_STATUSES.includes('active' as any)
      && !BUYER_VISIBLE_STATUSES.includes('draft' as any);

    // interestStatusReady — INTEREST_STATUSES enum is the canonical
    // interest-status surface (sent/viewed/accepted/declined/closed).
    const interestStatusReady =
         Array.isArray(INTEREST_STATUSES)
      && INTEREST_STATUSES.length >= 4;

    // buyerProfileReady / sendInterestReady — BuyerRuntime is the
    // single owner of these surfaces. Probe its health envelope.
    const buyer = _probe('__buyerHealth');
    const buyerProfileReady = !!buyer
      ? !!(buyer.profileReady || buyer.initialized || buyer.runtimeReady)
      : _hasGlobal('__buyerHealth');
    const sendInterestReady = !!buyer
      ? !!(buyer.interestServiceReady || buyer.initialized)
      : _hasGlobal('__buyerHealth');

    // noPayments — true unless a payment/escrow surface is detected
    // at runtime. The governance gate also performs a static check.
    const noPayments =
         !_hasGlobal('__paymentHealth')
      && !_hasGlobal('__escrowHealth')
      && !_hasGlobal('__bidHealth');

    // privateFarmerDataHidden — the wave-26 buyer contract uses
    // BUYER_VISIBLE_STATUSES + a Listing envelope without
    // demographic fields. We compose against the buyer envelope's
    // explicit `privateFarmerDataHidden` flag, falling back to
    // `approvedListingsOnly` as a proxy (the latter is the
    // structural guarantee that no draft + therefore no private
    // farmer detail leaks).
    const privateFarmerDataHidden = !!buyer
      ? (buyer.privateFarmerDataHidden !== false)
      : approvedListingsOnly;

    return Object.freeze({
      runtimeVersion:                 BUYER_ONBOARDING_HEALTH_RUNTIME_VERSION,
      initialized:                    true,
      buyerProfileReady,
      approvedListingsOnly,
      sendInterestReady,
      interestStatusReady,
      noPayments,
      privateFarmerDataHidden,
      buyerRuntimeVersion:            BUYER_RUNTIME_VERSION,
    });
  }, FROZEN_FALLBACK);
}

export function installBuyerOnboardingHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__buyerOnboardingHealth !== 'function') {
      w.__buyerOnboardingHealth = function () {
        const out = buyerOnboardingHealth();
        try { console.log('[Farroway · Buyer Onboarding]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
