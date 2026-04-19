/**
 * getListingConfidence.js — how trustworthy a marketplace listing
 * looks from a buyer's angle. Drives badges and sort order:
 *
 *   high   → "Fresh listing" badge, top of results
 *   medium → no badge
 *   low    → de-ranked, "May be out of date" hint
 *
 * Inputs (all optional):
 *   • createdAt         — ISO string or epoch ms
 *   • updatedAt         — last touched (optional, falls back to createdAt)
 *   • expiresAt         — listing expiry (optional)
 *   • quantityRemaining — number
 *   • completenessScore — 0..1 (photo present, price present, etc.)
 *   • sellerVerified    — boolean
 *   • reportCount       — user reports; drags confidence hard
 *
 * Explicit thresholds (so they can be tuned from dashboards later):
 *   FRESH_HOURS   = 48    — full freshness
 *   AGING_HOURS   = 24*7  — still relevant, small penalty
 *   STALE_HOURS   = 24*21 — hard penalty
 */

const FRESH_HOURS = 48;
const AGING_HOURS = 24 * 7;
const STALE_HOURS = 24 * 21;

const HIGH   = 75;
const MEDIUM = 45;

function toMs(x) {
  if (x == null) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  const n = Date.parse(x);
  return Number.isFinite(n) ? n : null;
}

export function getListingConfidence(listing = {}, now = Date.now()) {
  let score = 50;
  const reasons = [];

  const updatedMs = toMs(listing.updatedAt) ?? toMs(listing.createdAt);
  if (updatedMs != null) {
    const ageHours = Math.max(0, (now - updatedMs) / (1000 * 60 * 60));
    if (ageHours <= FRESH_HOURS)      { score += 20; reasons.push('listing_fresh'); }
    else if (ageHours <= AGING_HOURS) { score += 5;  reasons.push('listing_recent'); }
    else if (ageHours <= STALE_HOURS) { score -= 10; reasons.push('listing_aging'); }
    else                              { score -= 25; reasons.push('listing_stale'); }
  } else {
    score -= 10; reasons.push('listing_age_unknown');
  }

  const expiresMs = toMs(listing.expiresAt);
  if (expiresMs != null && expiresMs <= now) {
    score -= 35; reasons.push('listing_expired');
  }

  if (typeof listing.quantityRemaining === 'number') {
    if (listing.quantityRemaining <= 0) {
      score -= 40; reasons.push('listing_no_stock');
    } else if (listing.quantityRemaining < 5) {
      score -= 5;  reasons.push('listing_low_stock');
    }
  }

  const completeness = Number(listing.completenessScore);
  if (Number.isFinite(completeness)) {
    if (completeness >= 0.9)      { score += 10; reasons.push('listing_complete'); }
    else if (completeness >= 0.6) { /* neutral */ }
    else if (completeness >= 0.3) { score -= 10; reasons.push('listing_incomplete'); }
    else                          { score -= 20; reasons.push('listing_very_incomplete'); }
  }

  if (listing.sellerVerified === true) {
    score += 10; reasons.push('seller_verified');
  }

  const reports = Number(listing.reportCount);
  if (Number.isFinite(reports) && reports > 0) {
    score -= Math.min(30, reports * 10);
    reasons.push('listing_reported');
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= HIGH ? 'high' : score >= MEDIUM ? 'medium' : 'low';
  return { level, score, reasons };
}

export const _internal = {
  FRESH_HOURS, AGING_HOURS, STALE_HOURS, HIGH, MEDIUM,
};
