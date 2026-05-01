/**
 * marketSeeder.js — lazy seeds initial sample listings + buyer
 * interests for a market the first time the user enters it.
 *
 * Spec coverage (Multi-market expansion §3)
 *   • Seed each market with initial listings + initial buyers.
 *
 * Behaviour
 *   • Idempotent per-market via `farroway_market_seeded` (Set).
 *   • Listings written through `marketStore.saveListing` so they
 *     pass the canonical pipeline (analytics + buyer alerts +
 *     priority sort).
 *   • Sample listings carry `sample: true` and `marketId` so the
 *     filter helpers can identify them and any "Hide samples"
 *     toggle can drop them in one read.
 *   • Buyer interests carry `marketId` for cohort partitioning.
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Sync wrapper is fine — saveListing is sync.
 *   • Skips when localStorage unavailable.
 */

import { saveListing, saveBuyerInterest } from '../market/marketStore.js';
import { getMarket } from './marketCatalog.js';

export const SEED_STAMP_KEY = 'farroway_market_seeded';

function _readStampSet() {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(SEED_STAMP_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch { return new Set(); }
}

function _writeStampSet(set) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SEED_STAMP_KEY, JSON.stringify(Array.from(set)));
  } catch { /* swallow */ }
}

/**
 * seedMarketIfNeeded(marketId) → number
 *   Returns the count of listings + interests written. Returns 0
 *   when the market is unknown or already seeded.
 */
export function seedMarketIfNeeded(marketId) {
  const id = String(marketId || '').toUpperCase();
  const m = getMarket(id);
  if (!m) return 0;
  const seen = _readStampSet();
  if (seen.has(id)) return 0;

  let written = 0;
  // Listings
  for (const sample of (m.sampleListings || [])) {
    if (!sample || !sample.crop) continue;
    try {
      const stored = saveListing({
        farmerId:   `seed_${id}`,
        crop:       sample.crop,
        quantity:   Number(sample.quantity) || null,
        unit:       sample.unit || m.primaryUnit || 'kg',
        readyDate:  null,
        priceRange: sample.priceRange || null,
        location: {
          lat: null, lng: null,
          region:  sample.regionLabel || (m.regions?.[0] || ''),
          country: m.country,
        },
        status:     'ACTIVE',
        marketId:   id,
        sample:     true,
        synced:     false,
      });
      if (stored) written += 1;
    } catch { /* swallow */ }
  }

  // Buyer interests — point at the just-seeded listings so the
  // farmer interest panels in the seeded market show life.
  // We re-read listings to grab fresh ids since saveListing
  // generates them on first write.
  try {
    const fresh = (typeof localStorage !== 'undefined')
      ? JSON.parse(localStorage.getItem('farroway_market_listings') || '[]')
      : [];
    const seedListings = (Array.isArray(fresh) ? fresh : [])
      .filter((l) => l && l.farmerId === `seed_${id}` && l.sample === true)
      .slice(-((m.sampleListings || []).length));
    let i = 0;
    for (const buyer of (m.sampleBuyers || [])) {
      const target = seedListings[i] || seedListings[0];
      if (!target) break;
      i += 1;
      try {
        const stored = saveBuyerInterest({
          listingId: target.id,
          buyerId:   `seed_buyer_${id}_${i}`,
          buyerName: buyer.name,
          crop:      buyer.interestedIn || target.crop,
          message:   buyer.region ? `${buyer.region} \u00B7 sample buyer` : 'sample buyer',
        });
        if (stored) written += 1;
      } catch { /* swallow */ }
    }
  } catch { /* swallow */ }

  // Stamp regardless of partial success so a transient storage
  // hiccup doesn't reseed on next mount.
  seen.add(id);
  _writeStampSet(seen);
  return written;
}

/** Test/admin: clear all seed stamps so seeders re-run. */
export function _resetMarketSeeder() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SEED_STAMP_KEY);
    }
  } catch { /* swallow */ }
}

export default { seedMarketIfNeeded };
