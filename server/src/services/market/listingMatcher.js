/**
 * listingMatcher.js — pure helpers that turn a buyer's search
 * criteria into ranked CropListing rows.
 *
 *   scoreBuyerListingMatch(listing, criteria) → 0..100
 *     Simple additive score:
 *       crop match          +45 (exact crop key)
 *       country match       +15
 *       same state          +15   (bonus if city matches: +5)
 *       quantity fits       +10
 *       quality fits        +10
 *     Listings that don't match the crop score 0 and are filtered out
 *     by getMatchingListings.
 *
 *   getMatchingListings(listings, criteria) → sorted array
 *     Filters to status='active', applies the crop filter, sorts by
 *     score (desc), then createdAt (desc) as tiebreak.
 *
 *   TRUST_BADGES(listing) → string[] (i18n keys)
 *     Simple rule-based trust indicators the buyer UI can render as
 *     chips: verified_harvest, recent_activity, quality_reported,
 *     guidance_full, location_verified. Honest, no inflation.
 */

const QUALITY_RANK = { high: 3, medium: 2, low: 1 };

export function scoreBuyerListingMatch(listing = {}, criteria = {}) {
  if (!listing?.cropKey) return 0;
  const crop = String(criteria.crop || '').toLowerCase();
  const listingCrop = String(listing.cropKey || '').toLowerCase();
  if (crop && crop !== listingCrop) return 0;

  let score = 0;
  score += 45; // crop match (implicit — we've filtered to this crop)

  if (criteria.country) {
    if (String(criteria.country).toUpperCase() === String(listing.country || '').toUpperCase()) {
      score += 15;
    }
  }
  if (criteria.stateCode) {
    if (String(criteria.stateCode).toUpperCase() === String(listing.stateCode || '').toUpperCase()) {
      score += 15;
      if (criteria.city && criteria.city.toLowerCase() === String(listing.city || '').toLowerCase()) {
        score += 5;
      }
    }
  }

  // Quantity fit: listing has at least the quantity the buyer wants.
  // No penalty for excess — the buyer can request a subset.
  const q = Number(criteria.quantity);
  if (Number.isFinite(q) && q > 0 && Number.isFinite(listing.quantity) && listing.quantity >= q) {
    score += 10;
  }

  // Quality fit: listing quality ≥ buyer's minimum.
  if (criteria.minQuality) {
    const need = QUALITY_RANK[String(criteria.minQuality).toLowerCase()] || 0;
    const have = QUALITY_RANK[String(listing.quality || '').toLowerCase()] || 0;
    if (need && have >= need) score += 10;
  } else {
    // No quality criterion → don't reward or penalize
  }

  // Delivery fit: 'either' always matches; specific modes must align.
  if (criteria.deliveryMode && listing.deliveryMode
      && criteria.deliveryMode !== 'either' && listing.deliveryMode !== 'either'
      && criteria.deliveryMode !== listing.deliveryMode) {
    score = Math.max(0, score - 10);
  }

  return Math.max(0, Math.min(100, score));
}

export function getMatchingListings(listings = [], criteria = {}) {
  const crop = String(criteria.crop || '').toLowerCase();
  const rows = (listings || []).filter((l) => {
    if (l.status !== 'active') return false;
    if (!crop) return true;
    return String(l.cropKey || '').toLowerCase() === crop;
  });
  const scored = rows.map((l) => ({ listing: l, score: scoreBuyerListingMatch(l, criteria) }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const at = new Date(a.listing.createdAt || 0).getTime();
    const bt = new Date(b.listing.createdAt || 0).getTime();
    return bt - at;
  });
  return scored;
}

/**
 * TRUST_BADGES(listing) — i18n-key chips for the buyer UI. Pure
 * function over the listing row; we never invent badges the data
 * doesn't support.
 */
export function getTrustBadges(listing = {}) {
  const out = [];
  if (listing.cropCycleId) out.push('market.trust.verifiedHarvest');
  if (listing.supportConfidence === 'high') out.push('market.trust.guidanceFull');
  else if (listing.supportConfidence === 'medium') out.push('market.trust.guidancePartial');
  if (listing.quality) out.push('market.trust.qualityReported');
  if (listing.stateCode) out.push('market.trust.locationVerified');
  const createdAt = listing.createdAt ? new Date(listing.createdAt).getTime() : null;
  if (createdAt && (Date.now() - createdAt) < 7 * 86_400_000) {
    out.push('market.trust.recentActivity');
  }
  return out.slice(0, 5);
}

// ─── status machine ──────────────────────────────────────
const LISTING_TRANSITIONS = Object.freeze({
  draft:    new Set(['active', 'closed']),
  active:   new Set(['reserved', 'sold', 'closed', 'draft']),
  reserved: new Set(['active', 'sold', 'closed']),
  sold:     new Set(['closed']),
  closed:   new Set([]),
});

export function canTransitionListing(from, to) {
  return LISTING_TRANSITIONS[from]?.has(to) === true;
}

const INTEREST_TRANSITIONS = Object.freeze({
  pending:  new Set(['accepted', 'declined', 'expired']),
  accepted: new Set(['expired']),
  declined: new Set([]),
  expired:  new Set([]),
});

export function canTransitionInterest(from, to) {
  return INTEREST_TRANSITIONS[from]?.has(to) === true;
}

export const _internal = { QUALITY_RANK, LISTING_TRANSITIONS, INTEREST_TRANSITIONS };
