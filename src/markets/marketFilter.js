/**
 * marketFilter.js — partition listings + interests by market.
 *
 * Spec coverage (Multi-market expansion §4)
 *   • Separate markets — no cross-region mixing.
 *
 * Strategy
 *   A listing/interest belongs to a market when:
 *     • `marketId` is set on the record AND matches; OR
 *     • `location.country` matches the target market's country
 *       (legacy records without `marketId` still partition
 *       correctly).
 *
 *   Records with neither are considered "unscoped" and are
 *   visible to every market (we don't quietly hide farmer data
 *   that never recorded a country — better to surface than to
 *   suppress).
 *
 * Strict-rule audit
 *   • Pure functions; never throw.
 *   • Stable order: filtered output preserves input order.
 */

import { getMarket } from './marketCatalog.js';

function _norm(s) {
  return String(s || '').trim().toLowerCase();
}

function _belongsToMarket(record, marketId) {
  if (!record) return false;
  const target = String(marketId || '').toUpperCase();
  if (!target) return true;            // no target → everything passes
  // Direct id match.
  if (String(record.marketId || '').toUpperCase() === target) return true;
  // Country fallback for legacy records.
  const market = getMarket(target);
  if (!market) return false;
  const country =
    record.location?.country
    || record.country
    || '';
  if (!country) return true;           // unscoped — visible everywhere
  return _norm(country) === _norm(market.country);
}

export function filterListingsByMarket(listings, marketId) {
  if (!Array.isArray(listings)) return [];
  return listings.filter((l) => _belongsToMarket(l, marketId));
}

export function filterInterestsByMarket(interests, marketId) {
  if (!Array.isArray(interests)) return [];
  return interests.filter((i) => _belongsToMarket(i, marketId));
}

/** Convenience: True if a single record belongs to the market. */
export function recordBelongsToMarket(record, marketId) {
  return _belongsToMarket(record, marketId);
}

export default {
  filterListingsByMarket,
  filterInterestsByMarket,
  recordBelongsToMarket,
};
