/**
 * scarcityIndicators.js — pure helper that derives "scarcity"
 * flags for a listing.
 *
 * Spec coverage (Marketplace revenue scale §4)
 *   • Limited quantity
 *   • High demand
 *
 *   getScarcity(listing) → {
 *     limited:    boolean,
 *     highDemand: boolean,
 *     reason:     'unit' | 'count' | null,
 *     demandCount: number,
 *   }
 *
 * Buckets
 *   limited    : quantity <= 20 in kg-equivalent OR <=2 bags/crates
 *   highDemand : ≥3 active interests for the listing's crop in the
 *                last 30 days (via getDemandForCrop)
 *
 * Strict-rule audit
 *   • Pure function — no DOM access; never throws.
 *   • Reads no storage directly; demand comes from the existing
 *     marketDemand helper which already aggregates the buyer-
 *     interest store.
 *   • Conservative — when quantity is null ("Not sure yet"), we
 *     do NOT flag it as limited (a TBD quantity isn't scarcity).
 */

import { getDemandForCrop } from './marketDemand.js';

const KG_LIMIT          = 20;
const PACKAGED_LIMIT    = 2;
const HIGH_DEMAND_COUNT = 3;

function _isLimited(listing) {
  const qty = Number(listing?.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return { limited: false, reason: null };
  const unit = String(listing?.unit || '').trim().toLowerCase();
  if (unit === 'bags' || unit === 'crates') {
    return { limited: qty <= PACKAGED_LIMIT, reason: 'unit' };
  }
  // kg / generic
  return { limited: qty <= KG_LIMIT, reason: 'count' };
}

/**
 * @param {object} listing
 */
export function getScarcity(listing) {
  if (!listing) {
    return { limited: false, highDemand: false, reason: null, demandCount: 0 };
  }
  const lim = _isLimited(listing);
  let demand = { count: 0, level: 'low' };
  try {
    demand = getDemandForCrop({
      crop:    listing.crop,
      country: listing.location?.country || listing.country || '',
      region:  listing.location?.region  || listing.region  || '',
    }) || demand;
  } catch { /* swallow */ }
  const highDemand = (demand.count || 0) >= HIGH_DEMAND_COUNT;
  return {
    limited:     lim.limited,
    highDemand,
    reason:      lim.limited ? lim.reason : null,
    demandCount: demand.count || 0,
  };
}

export const _internal = Object.freeze({
  KG_LIMIT, PACKAGED_LIMIT, HIGH_DEMAND_COUNT,
});

export default { getScarcity };
