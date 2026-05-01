/**
 * sellerReputation.js — derives simple reputation badges for a
 * farmer from the existing listings + interests stores. No new
 * persistence — pure read.
 *
 * Spec coverage (Marketplace scale §4)
 *   • "Active seller" — has ≥2 listings OR a listing in the last 30 days
 *   • "Fast response" — average time from interest received to
 *     status='contacted' is under 12 hours, with ≥1 such transition
 *
 *   computeSellerReputation(farmerId, { now? }) → {
 *     badges:    Array<'active' | 'fast_response'>,
 *     stats:     {
 *       listingCount:     number,
 *       lastListingAt:    ISO | null,
 *       interestsHandled: number,
 *       avgResponseMs:    number | null,
 *     },
 *   }
 *
 * Strict-rule audit
 *   • Pure read; never throws.
 *   • Reads `farroway_market_listings` + `farroway_buyer_interests`
 *     directly to stay decoupled from marketStore (no import
 *     cycle when used inside marketplace components).
 *   • Conservative thresholds. Pilot can re-tune without API
 *     drift.
 */

const ACTIVE_LISTING_WINDOW_MS = 30 * 86_400_000;     // 30 days
const FAST_RESPONSE_THRESHOLD_MS = 12 * 60 * 60_000;  // 12 hours

function _safeReadJsonArray(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _activeBadge(listings, now) {
  if (!Array.isArray(listings) || listings.length === 0) return false;
  if (listings.length >= 2) return true;
  // Single listing within the last 30 days still counts.
  const last = listings[0];
  const t = Date.parse(last?.createdAt || '');
  if (!Number.isFinite(t)) return false;
  return (now - t) <= ACTIVE_LISTING_WINDOW_MS;
}

function _fastResponseStats(interests, listingIds) {
  if (!Array.isArray(interests) || interests.length === 0) {
    return { count: 0, avgMs: null };
  }
  const setIds = new Set(listingIds);
  let total = 0;
  let n = 0;
  for (const i of interests) {
    if (!i || !setIds.has(i.listingId)) continue;
    if ((i.status || 'interested') === 'interested') continue;  // not yet responded
    const created = Date.parse(i.createdAt || '');
    const updated = Date.parse(i.statusUpdatedAt || '');
    if (!Number.isFinite(created) || !Number.isFinite(updated)) continue;
    if (updated < created) continue;
    total += (updated - created);
    n += 1;
  }
  return {
    count: n,
    avgMs: n > 0 ? Math.round(total / n) : null,
  };
}

/**
 * @param {string} farmerId
 * @param {object} [opts]
 * @param {number} [opts.now]
 * @returns {{
 *   badges: Array<string>,
 *   stats: {
 *     listingCount: number,
 *     lastListingAt: string | null,
 *     interestsHandled: number,
 *     avgResponseMs: number | null,
 *   },
 * }}
 */
export function computeSellerReputation(farmerId, { now = Date.now() } = {}) {
  const id = String(farmerId || '').trim();
  if (!id) {
    return { badges: [], stats: { listingCount: 0, lastListingAt: null, interestsHandled: 0, avgResponseMs: null } };
  }
  const allListings = _safeReadJsonArray('farroway_market_listings');
  const myListings = allListings
    .filter((l) => l && String(l.farmerId || '') === id)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  const myListingIds = myListings.map((l) => l.id).filter(Boolean);

  const allInterests = _safeReadJsonArray('farroway_buyer_interests');
  const responseStats = _fastResponseStats(allInterests, myListingIds);

  const badges = [];
  if (_activeBadge(myListings, now)) badges.push('active');
  if (
    responseStats.count >= 1
    && Number.isFinite(responseStats.avgMs)
    && responseStats.avgMs <= FAST_RESPONSE_THRESHOLD_MS
  ) badges.push('fast_response');

  return {
    badges,
    stats: {
      listingCount:     myListings.length,
      lastListingAt:    myListings[0]?.createdAt || null,
      interestsHandled: responseStats.count,
      avgResponseMs:    responseStats.avgMs,
    },
  };
}

export const _internal = Object.freeze({
  ACTIVE_LISTING_WINDOW_MS,
  FAST_RESPONSE_THRESHOLD_MS,
});

export default { computeSellerReputation };
