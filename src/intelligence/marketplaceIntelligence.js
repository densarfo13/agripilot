/**
 * marketplaceIntelligence.js — Phase 3 stub.
 *
 * STATUS: STUB ARCHITECTURE-READY. NOT imported anywhere. NOT a
 * replacement for the existing FarmerMarketTab / SellReadinessInput
 * flow — this is the future intelligence layer that those UI
 * surfaces will read from once a real demand signal exists.
 *
 * Output shape:
 *
 *   {
 *     buyerDemand:        'low'|'medium'|'high'|null,
 *     bestSellingWindow:  { startISO, endISO } | null,
 *     suggestedPriceRange: { min, max, currency, unit } | null,
 *     readinessStatus:    'not_ready'|'preparing'|'ready'|'expired'|null,
 *     confidence:         number,
 *   }
 */

export function buildMarketplaceIntelligence(input = {}) {
  return Object.freeze({
    buyerDemand:         null,
    bestSellingWindow:   null,
    suggestedPriceRange: null,
    readinessStatus:     null,
    confidence:          0,
    _input:              input,
    _version:            MARKETPLACE_INTELLIGENCE_VERSION,
  });
}

export const MARKETPLACE_INTELLIGENCE_VERSION = '0.1.0-stub';
