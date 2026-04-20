/**
 * marketplaceMatch.js — pure buyer/seller listing matcher.
 *
 *   isMatch(listing, request) → boolean
 *   rankMatches(listings, request) → sortedListings[]
 *
 * Rules (from spec §7):
 *   • same crop  (case-insensitive)
 *   • listing.quantity >= request.quantity
 *   • listing.location === request.location OR
 *     listing.region === request.region  (region match is weaker)
 *
 * Returns richer `scoreMatch` for ranking so the UI can say
 * "strong match" vs "nearby region" vs "exact".
 */

function norm(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

function cropEq(listing, request) {
  return norm(listing.crop) === norm(request.crop) && norm(listing.crop) !== '';
}

function quantityOk(listing, request) {
  const l = Number(listing?.quantity);
  const r = Number(request?.quantity);
  if (!Number.isFinite(r) || r <= 0) return Number.isFinite(l) && l > 0;
  if (!Number.isFinite(l)) return false;
  return l >= r;
}

function locationOk(listing, request) {
  if (!listing || !request) return false;
  if (norm(listing.location) && norm(listing.location) === norm(request.location)) return 'exact';
  if (norm(listing.region)   && norm(listing.region)   === norm(request.region))   return 'region';
  return false;
}

function isMatch(listing, request) {
  if (!listing || !request) return false;
  if (!cropEq(listing, request))   return false;
  if (!quantityOk(listing, request)) return false;
  if (!locationOk(listing, request)) return false;
  return true;
}

/**
 * scoreMatch — richer match signal. Higher is better.
 *   100 = exact-location match with quantity fully covered
 *   60  = region-only match
 *   0   = no match at all
 */
function scoreMatch(listing, request) {
  if (!isMatch(listing, request)) return 0;
  const locKind = locationOk(listing, request);
  let score = locKind === 'exact' ? 100 : 60;
  // Over-supply beyond the ask gets a tiny bonus up to +10.
  const l = Number(listing?.quantity) || 0;
  const r = Number(request?.quantity) || 0;
  if (r > 0 && l > r) {
    const ratio = Math.min(2, l / r);
    score += Math.round((ratio - 1) * 10);
  }
  return score;
}

/**
 * rankMatches — returns only matching listings, sorted best first.
 */
function rankMatches(listings, request) {
  if (!Array.isArray(listings)) return [];
  return listings
    .filter((l) => isMatch(l, request))
    .map((l) => ({ listing: l, score: scoreMatch(l, request) }))
    .sort((a, b) => b.score - a.score)
    .map((m) => m.listing);
}

export { isMatch, scoreMatch, rankMatches };
export default { isMatch, scoreMatch, rankMatches };
