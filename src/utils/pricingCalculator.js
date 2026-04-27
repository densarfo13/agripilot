/**
 * pricingCalculator.js — pure billing math for the NGO tier.
 *
 * Strict-rules audit:
 *   * never crashes on bad input (negative, non-number, NaN)
 *   * pure: no I/O, no localStorage read
 *   * one place to change the formula - the Pricing screen, the
 *     billing email blurb, and any future Stripe handoff all read
 *     from this function
 */

import { PRICING } from '../config/pricing.js';

function _toCount(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.floor(v);
}

/**
 * calculateNGOCost(farmerCount)
 *   returns the monthly USD billing for a given roster size,
 *   honouring the per-farmer rate and the minimum-contract floor.
 */
export function calculateNGOCost(farmerCount) {
  const count = _toCount(farmerCount);
  const cost  = count * PRICING.NGO.perFarmer;
  return Math.max(cost, PRICING.NGO.minContract);
}

/**
 * priceBreakdown(farmerCount)
 *   richer detail for the Pricing UI: shows the underlying linear
 *   cost and whether the floor kicked in. Useful for an NGO sales
 *   conversation: "yes, you only have 200 farmers today, but the
 *   programme floor is $500/mo".
 */
export function priceBreakdown(farmerCount) {
  const count = _toCount(farmerCount);
  const linear = count * PRICING.NGO.perFarmer;
  const billed = Math.max(linear, PRICING.NGO.minContract);
  return Object.freeze({
    farmers:           count,
    perFarmer:         PRICING.NGO.perFarmer,
    linearCost:        linear,
    minContract:       PRICING.NGO.minContract,
    flooredAtMin:      billed > linear,
    monthlyCost:       billed,
    annualCost:        billed * 12,
  });
}
