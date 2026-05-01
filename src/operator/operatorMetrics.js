/**
 * operatorMetrics.js — pure per-market aggregator for the
 * operator dashboard.
 *
 * Spec coverage (Aggressive scaling §4)
 *   • Track per region: listings, buyers, transactions
 *
 *   getOperatorStats(marketId) → {
 *     marketId,
 *     listingCount:     number,
 *     activeListings:   number,
 *     soldListings:     number,
 *     pendingInterests: number,   // status='interested'
 *     activeDeals:      number,   // status in [contacted, negotiating]
 *     dealsClosed:      number,   // status='sold'
 *     uniqueBuyers:     number,
 *     conversion:       number,   // 0..1; sold / total interests
 *     last7Days: { listingsCreated, interestsReceived, dealsClosed },
 *   }
 *
 *   getMarketRegistry() → Array of all known markets with stats
 *   pre-attached, used to render the operator-side market grid.
 *
 * Strict-rule audit
 *   • Pure read; never throws.
 *   • Reads `farroway_market_listings` + `farroway_buyer_interests`
 *     directly to stay decoupled from marketStore (avoids cycles).
 *   • Same `recordBelongsToMarket` predicate as the buyer feed,
 *     so operator and end-user views stay consistent.
 */

import { recordBelongsToMarket } from '../markets/marketFilter.js';
import { listMarkets } from '../markets/marketCatalog.js';

const SEVEN_DAYS_MS = 7 * 86_400_000;

function _safeReadJsonArray(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _within(iso, sinceMs) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) && t >= sinceMs;
}

export function getOperatorStats(marketId, { now = Date.now() } = {}) {
  const id = String(marketId || '').toUpperCase();
  if (!id) {
    return _emptyStats(id);
  }
  const allListings  = _safeReadJsonArray('farroway_market_listings');
  const allInterests = _safeReadJsonArray('farroway_buyer_interests');

  const listings  = allListings.filter((l) => recordBelongsToMarket(l, id));
  const listingIds = new Set(listings.map((l) => l && l.id).filter(Boolean));
  const interests = allInterests.filter((i) =>
    i && listingIds.has(i.listingId));

  const activeListings = listings.filter((l) =>
    String(l?.status || '').toUpperCase() === 'ACTIVE');
  const soldListings = listings.filter((l) =>
    String(l?.status || '').toUpperCase() === 'SOLD');

  const pendingInterests = interests.filter((i) =>
    (i.status || 'interested') === 'interested');
  const activeDeals = interests.filter((i) =>
    i.status === 'contacted' || i.status === 'negotiating');
  const dealsClosed = interests.filter((i) => i.status === 'sold');

  const uniqueBuyers = new Set(
    interests
      .map((i) => i && (i.buyerId || i.buyerName || ''))
      .filter(Boolean),
  );

  const cutoff = now - SEVEN_DAYS_MS;
  const last7Days = {
    listingsCreated:    listings.filter((l)  => _within(l?.createdAt,  cutoff)).length,
    interestsReceived:  interests.filter((i) => _within(i?.createdAt,  cutoff)).length,
    dealsClosed:        interests.filter((i) =>
      i.status === 'sold' && _within(i?.statusUpdatedAt || i?.createdAt, cutoff)).length,
  };

  const totalSignals = interests.length;
  const conversion = totalSignals > 0 ? dealsClosed.length / totalSignals : 0;

  return {
    marketId: id,
    listingCount:     listings.length,
    activeListings:   activeListings.length,
    soldListings:     soldListings.length,
    pendingInterests: pendingInterests.length,
    activeDeals:      activeDeals.length,
    dealsClosed:      dealsClosed.length,
    uniqueBuyers:     uniqueBuyers.size,
    conversion,
    last7Days,
  };
}

function _emptyStats(id) {
  return {
    marketId:         id || '',
    listingCount:     0,
    activeListings:   0,
    soldListings:     0,
    pendingInterests: 0,
    activeDeals:      0,
    dealsClosed:      0,
    uniqueBuyers:     0,
    conversion:       0,
    last7Days: { listingsCreated: 0, interestsReceived: 0, dealsClosed: 0 },
  };
}

/**
 * getMarketRegistry({ now? }) → Array<{
 *   ...market,           // catalog fields
 *   stats: ReturnType<getOperatorStats>,
 * }>
 */
export function getMarketRegistry({ now = Date.now() } = {}) {
  return listMarkets().map((m) => ({
    ...m,
    stats: getOperatorStats(m.id, { now }),
  }));
}

/**
 * getPendingInterestsForMarket(marketId) — flat list of
 * `{ interest, listing }` pairs for the operator queue.
 */
export function getPendingInterestsForMarket(marketId) {
  const id = String(marketId || '').toUpperCase();
  const listings  = _safeReadJsonArray('farroway_market_listings')
    .filter((l) => recordBelongsToMarket(l, id));
  const byId = new Map();
  for (const l of listings) {
    if (l && l.id) byId.set(l.id, l);
  }
  const interests = _safeReadJsonArray('farroway_buyer_interests');
  return interests
    .filter((i) => i && byId.has(i.listingId))
    .filter((i) => (i.status || 'interested') === 'interested')
    .map((i) => ({ interest: i, listing: byId.get(i.listingId) }))
    .sort((a, b) =>
      Date.parse(b.interest?.createdAt || 0) - Date.parse(a.interest?.createdAt || 0));
}

export default {
  getOperatorStats,
  getMarketRegistry,
  getPendingInterestsForMarket,
};
