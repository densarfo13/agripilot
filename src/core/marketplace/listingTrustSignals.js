/**
 * listingTrustSignals.js — marketplace listing trust indicators
 * (v2 §5).
 *
 *   import { computeListingTrustSignals }
 *     from 'src/core/marketplace/listingTrustSignals.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Pure helpers that turn a produce listing + light context into
 *   honest ACTIVITY signals a buyer can read: listing freshness,
 *   a recently-scanned flag, a harvest-readiness estimate, a
 *   seller-activity band, and profile completeness.
 *
 *   These are signals, NOT guarantees. The module never asserts
 *   produce quality, never grades the seller, and returns a
 *   `disclaimer` reminding the UI to say so.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const FRESHNESS  = Object.freeze({ FRESH: 'fresh', RECENT: 'recent', STALE: 'stale', UNKNOWN: 'unknown' });
export const READINESS  = Object.freeze({ READY: 'ready', SOON: 'soon', GROWING: 'growing', UNKNOWN: 'unknown' });
export const ACTIVITY   = Object.freeze({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high' });

export const LISTING_DISCLAIMER =
  'These are activity signals, not a quality guarantee. Confirm details directly with the seller.';

/** Parse a date-ish value to ms, or null. */
function _ms(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

/** Listing freshness from its last-updated time. */
export function listingFreshness(updatedAt, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const t = _ms(updatedAt);
  if (t == null) return FRESHNESS.UNKNOWN;
  const ageDays = (now - t) / DAY_MS;
  if (ageDays < 3) return FRESHNESS.FRESH;
  if (ageDays < 14) return FRESHNESS.RECENT;
  return FRESHNESS.STALE;
}

/** Whether the listed crop was scanned recently (default window 14d). */
export function recentlyScanned(lastScanAt, nowMs, windowDays) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const t = _ms(lastScanAt);
  if (t == null) return false;
  const win = Number.isFinite(windowDays) ? windowDays : 14;
  return (now - t) <= win * DAY_MS;
}

/** Harvest-readiness estimate from an expected harvest date. */
export function harvestReadiness(expectedHarvestDate, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const t = _ms(expectedHarvestDate);
  if (t == null) return READINESS.UNKNOWN;
  const daysAway = (t - now) / DAY_MS;
  if (daysAway <= 0) return READINESS.READY;
  if (daysAway <= 7) return READINESS.SOON;
  return READINESS.GROWING;
}

/** Seller-activity band from distinct active days in the recent window. */
export function sellerActivityScore(sellerActiveDays) {
  const d = Number(sellerActiveDays);
  if (!Number.isFinite(d) || d <= 1) return ACTIVITY.LOW;
  if (d <= 5) return ACTIVITY.MEDIUM;
  return ACTIVITY.HIGH;
}

// Listing fields that make a listing useful to a buyer.
const COMPLETENESS_FIELDS = Object.freeze([
  'title', 'description', 'price', 'cropType', 'quantity', 'photo', 'location',
]);

/** Profile / listing completeness as a 0..1 ratio. */
export function profileCompleteness(listing) {
  const l = (listing && typeof listing === 'object') ? listing : {};
  let filled = 0;
  for (const f of COMPLETENESS_FIELDS) {
    const v = l[f];
    const ok = Array.isArray(v) ? v.length > 0
      : (v != null && String(v).trim() !== '');
    if (ok) filled += 1;
  }
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100) / 100;
}

/**
 * Compute every listing trust signal at once.
 *
 * @param {object} listing  { updatedAt, expectedHarvestDate, ...fields }
 * @param {object} [context] { lastScanAt, sellerActiveDays, nowMs }
 * @returns {object}
 */
export function computeListingTrustSignals(listing, context) {
  try {
    const l = (listing && typeof listing === 'object') ? listing : {};
    const ctx = (context && typeof context === 'object') ? context : {};
    const nowMs = Number.isFinite(ctx.nowMs) ? ctx.nowMs : Date.now();
    return {
      listingFreshness:    listingFreshness(l.updatedAt || l.createdAt, nowMs),
      recentlyScanned:     recentlyScanned(ctx.lastScanAt, nowMs),
      harvestReadiness:    harvestReadiness(l.expectedHarvestDate || ctx.expectedHarvestDate, nowMs),
      sellerActivityScore: sellerActivityScore(ctx.sellerActiveDays),
      profileCompleteness: profileCompleteness(l),
      disclaimer:          LISTING_DISCLAIMER,
    };
  } catch {
    return {
      listingFreshness:    FRESHNESS.UNKNOWN,
      recentlyScanned:     false,
      harvestReadiness:    READINESS.UNKNOWN,
      sellerActivityScore: ACTIVITY.LOW,
      profileCompleteness: 0,
      disclaimer:          LISTING_DISCLAIMER,
    };
  }
}

const _module = {
  FRESHNESS, READINESS, ACTIVITY, LISTING_DISCLAIMER,
  listingFreshness, recentlyScanned, harvestReadiness,
  sellerActivityScore, profileCompleteness, computeListingTrustSignals,
};
export default _module;
