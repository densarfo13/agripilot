/**
 * listingPriority.js — priority sort for the buyer-facing /buy
 * surface so listings matching the user's interest history come
 * first.
 *
 * Spec coverage (Marketplace scale §6)
 *   • Listing density: prioritize same-crop listings.
 *
 *   sortListingsByRelevance(listings, { buyerId, now? }) → Listing[]
 *
 *   Order (descending priority):
 *     1. Crop matches a recent interest from this buyer
 *     2. Crop appears in 2+ active listings (high-demand cluster)
 *     3. Newer createdAt
 *
 * Strict-rule audit
 *   • Pure function — never writes storage; never throws.
 *   • Stable sort: equal-priority listings keep input order.
 *   • Reads buyer interests directly from localStorage to stay
 *     decoupled from marketStore (avoids import cycles).
 */

const LOOKBACK_MS = 90 * 86_400_000;   // 90 days

function _safeReadJsonArray(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _norm(s) {
  return String(s || '').trim().toLowerCase();
}

function _myCrops(buyerId, now) {
  const id = String(buyerId || '').trim();
  if (!id) return new Set();
  const interests = _safeReadJsonArray('farroway_buyer_interests');
  const set = new Set();
  for (const i of interests) {
    if (!i || i.buyerId !== id) continue;
    const t = Date.parse(i.createdAt || '');
    if (Number.isFinite(t) && (now - t) > LOOKBACK_MS) continue;
    if (i.crop) set.add(_norm(i.crop));
  }
  return set;
}

function _cropDensity(listings) {
  const counts = new Map();
  for (const l of listings || []) {
    const c = _norm(l?.crop);
    if (!c) continue;
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  return counts;
}

function _topCropSet() {
  // Read top-selling crops directly to avoid an import cycle.
  // We intentionally compute this inline (a small read of the
  // listings + interests stores) so the priority sort stays a
  // single self-contained step.
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const lRaw = localStorage.getItem('farroway_market_listings');
    const iRaw = localStorage.getItem('farroway_buyer_interests');
    const listings  = lRaw ? JSON.parse(lRaw) : [];
    const interests = iRaw ? JSON.parse(iRaw) : [];
    if (!Array.isArray(listings) && !Array.isArray(interests)) return new Set();
    const cutoff = Date.now() - 90 * 86_400_000;
    const score = new Map();
    for (const l of (Array.isArray(listings) ? listings : [])) {
      if (!l || !l.crop) continue;
      const t = Date.parse(l.updatedAt || l.createdAt || 0);
      if (Number.isFinite(t) && t < cutoff) continue;
      if (String(l.status || '').toUpperCase() !== 'SOLD') continue;
      const c = _norm(l.crop);
      score.set(c, (score.get(c) || 0) + 5);
    }
    for (const i of (Array.isArray(interests) ? interests : [])) {
      if (!i || !i.crop) continue;
      const t = Date.parse(i.createdAt || 0);
      if (Number.isFinite(t) && t < cutoff) continue;
      const c = _norm(i.crop);
      score.set(c, (score.get(c) || 0) + 1);
    }
    // Top 5 by score.
    const sorted = Array.from(score.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return new Set(sorted.map(([k]) => k));
  } catch { return new Set(); }
}

function _boostedSet() {
  // Read the boost store directly to avoid an import cycle.
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem('farroway_boosted_listings');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const now = Date.now();
    return new Set(
      parsed
        .filter((r) => {
          if (!r || !r.listingId || !r.expiresAt) return false;
          const t = Date.parse(r.expiresAt);
          return Number.isFinite(t) && t > now;
        })
        .map((r) => r.listingId),
    );
  } catch { return new Set(); }
}

/**
 * @param {Array<object>} listings
 * @param {object}        opts
 * @param {string}        [opts.buyerId]
 * @param {number}        [opts.now]
 * @returns {Array<object>}
 */
export function sortListingsByRelevance(listings, { buyerId = '', now = Date.now() } = {}) {
  if (!Array.isArray(listings) || listings.length === 0) return [];

  const myCrops = _myCrops(buyerId, now);
  const density = _cropDensity(listings);
  const boosted = _boostedSet();
  const topCrops = _topCropSet();

  // Decorate-sort-undecorate so the score is computed once per
  // listing and the comparator stays cheap.
  //
  // Score weights (descending priority):
  //   1000 — boosted (paid placement, top of feed)
  //    100 — buyer has shown interest in this crop before
  //     50 — crop is in the top-selling cohort (revenue scale §1)
  //     10 — crop appears in 2+ active listings (dense cluster)
  const decorated = listings.map((l, idx) => {
    const crop = _norm(l?.crop);
    const isBoosted = l?.id && boosted.has(l.id) ? 1 : 0;
    const matchesHistory = crop && myCrops.has(crop) ? 1 : 0;
    const isTopSeller = crop && topCrops.has(crop) ? 1 : 0;
    const cluster = crop && (density.get(crop) || 0) >= 2 ? 1 : 0;
    const t = Date.parse(l?.createdAt || 0);
    return {
      l,
      idx,
      score: (isBoosted * 1000)
           + (matchesHistory * 100)
           + (isTopSeller * 50)
           + (cluster * 10),
      created: Number.isFinite(t) ? t : 0,
    };
  });

  decorated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.created !== a.created) return b.created - a.created;
    return a.idx - b.idx;            // stable
  });

  return decorated.map((d) => d.l);
}

/**
 * cropDensityCount — the number of active listings for a given
 * crop. Used by the seller side to show "N other farmers are
 * also listing this crop" (informational, not competitive).
 */
export function cropDensityCount(listings, crop) {
  const target = _norm(crop);
  if (!target) return 0;
  let n = 0;
  for (const l of listings || []) {
    if (_norm(l?.crop) === target) n += 1;
  }
  return n;
}

export default { sortListingsByRelevance, cropDensityCount };
