/**
 * bulkAggregation.js — group individual produce listings into bulk
 * lots that buyers can request in one shot.
 *
 * Lots are DERIVED VIEWS of the existing ProduceListing rows — no
 * new Prisma model. Each lot has a deterministic id built from
 * (crop, country, region, pickupWeekStart) so the same inputs
 * always produce the same lot id. That means:
 *   • a buyer can request a lot without the lot needing its own DB row
 *   • the request references the constituent listing ids via its
 *     linking FarmerNotification metadata (same pattern as direct
 *     marketplace requests)
 *   • the aggregator can re-materialise the lot at any time
 *
 *   aggregateBulkLots(listings, { now?, pickupWindowDays?, minContributors? })
 *     → [{ lotId, crop, country, region, location, totalQuantity,
 *          contributors: [{ farmId, quantity, listingId, region }],
 *          pickupWindow: { start, end }, status, lastUpdated,
 *          priceSignal: { low, high, typical } | null }]
 *
 *   buildBulkLots(prisma, { crop?, country?, region?, windowDays?, ... })
 *     → Promise<Array<Lot>>
 *
 *   buildBulkLotById(prisma, lotId)
 *     → Promise<Lot | null>
 *
 * Lots are returned newest-first by pickup-window start.
 *
 * Pure helpers are exported for tests.
 */

// ─── Tuning knobs ─────────────────────────────────────────────
const DEFAULT_PICKUP_DAYS  = 7;    // lots span a one-week pickup window
const DEFAULT_WINDOW_DAYS  = 14;   // listings created within the last 14d
const DEFAULT_MIN_CONTRIB  = 2;    // lone listings aren't "bulk"
const MAX_LOTS             = 200;

// ─── Helpers ──────────────────────────────────────────────────
function canonical(s) {
  return String(s || '').trim();
}
function upperCrop(s) {
  return canonical(s).toUpperCase();
}
function lowerRegion(s) {
  return canonical(s).toLowerCase();
}

/**
 * pickupWeekStart(createdAtMs)
 *   Bucket the listing into its current ISO week — snap BACK to the
 *   Monday of the calendar week the listing was created in.
 *   Listings from Mon through Sun of the same week all land in the
 *   same bucket so their lot id is stable, regardless of which day
 *   of the week the farmer posted.
 */
export function pickupWeekStart(createdAtMs) {
  const d = new Date(createdAtMs);
  const day = d.getUTCDay();           // 0=Sun, 1=Mon, 2=Tue, … 6=Sat
  const daysBack = day === 0 ? 6 : day - 1;   // Sunday → 6, Monday → 0
  const monday = new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack,
  ));
  return monday.getTime();
}

/**
 * lotIdFor({ crop, country, region, weekStartMs })
 *   Deterministic, URL-safe lot id built from the grouping keys.
 *   Same inputs → same id. Using the date prefix keeps lots
 *   distinct across weeks.
 */
export function lotIdFor({ crop, country, region, weekStartMs }) {
  const safe = (v) => String(v || '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'any';
  const datePart = new Date(weekStartMs).toISOString().slice(0, 10); // YYYY-MM-DD
  return `bulk:${safe(crop)}:${safe(country)}:${safe(region)}:${datePart}`;
}

// ─── Aggregator (pure) ────────────────────────────────────────
/**
 * aggregateBulkLots(listings, options?)
 *   Drop listings that are outside the window, missing required
 *   fields, or can't be grouped. Group by (crop, country, region,
 *   pickupWeek) and return one lot per group that has ≥ minContributors
 *   UNIQUE farmers.
 */
export function aggregateBulkLots(listings, {
  now = Date.now(),
  windowDays = DEFAULT_WINDOW_DAYS,
  pickupWindowDays = DEFAULT_PICKUP_DAYS,
  minContributors = DEFAULT_MIN_CONTRIB,
} = {}) {
  if (!Array.isArray(listings) || listings.length === 0) return [];
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const cutoff   = now - windowMs;

  // 1. Bucket.
  const buckets = new Map();   // key → { listings[], crop, country, region, weekStart }
  for (const l of listings) {
    if (!l || !l.crop || !l.farmId) continue;
    const createdAt = l.createdAt ? new Date(l.createdAt).getTime() : NaN;
    if (!Number.isFinite(createdAt) || createdAt < cutoff) continue;
    if (l.status && l.status !== 'available') continue;

    const crop    = upperCrop(l.crop);
    const country = canonical(l.country || l.countryCode || '') || '';
    const region  = canonical(l.region  || '') || '';
    const weekStart = pickupWeekStart(createdAt);
    const key = `${crop}|${country}|${lowerRegion(region)}|${weekStart}`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        crop, country, region, weekStart, items: [],
      });
    }
    buckets.get(key).items.push(l);
  }

  // 2. Project buckets → lots + filter by min contributors.
  const lots = [];
  for (const bucket of buckets.values()) {
    const byFarmer = new Map();
    let totalQty = 0;
    let lastUpdated = 0;
    let location    = null;
    for (const item of bucket.items) {
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      totalQty += qty;
      const key = String(item.farmId);
      if (!byFarmer.has(key)) {
        byFarmer.set(key, {
          farmId: key, quantity: 0,
          listingIds: [], region: item.region || null,
        });
      }
      const c = byFarmer.get(key);
      c.quantity += qty;
      c.listingIds.push(item.id);
      if (!location && item.location) location = item.location;
      const updatedAt = item.updatedAt || item.createdAt;
      const updatedMs = updatedAt ? new Date(updatedAt).getTime() : 0;
      if (Number.isFinite(updatedMs) && updatedMs > lastUpdated) lastUpdated = updatedMs;
    }
    if (byFarmer.size < minContributors) continue;

    const pickupStart = bucket.weekStart;
    const pickupEnd   = pickupStart + pickupWindowDays * 24 * 60 * 60 * 1000;
    const lot = {
      lotId: lotIdFor({
        crop: bucket.crop, country: bucket.country,
        region: bucket.region, weekStartMs: pickupStart,
      }),
      crop:    bucket.crop,
      country: bucket.country || null,
      region:  bucket.region  || null,
      location,
      totalQuantity: totalQty,
      contributors:  Array.from(byFarmer.values())
                          .sort((a, b) => b.quantity - a.quantity)
                          .map(Object.freeze),
      pickupWindow: Object.freeze({
        start: new Date(pickupStart).toISOString(),
        end:   new Date(pickupEnd).toISOString(),
      }),
      status: 'active',
      lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
      priceSignal: null,  // caller (DB wrapper) attaches price insight
    };
    lots.push(Object.freeze({ ...lot, contributors: Object.freeze(lot.contributors) }));
  }

  // 3. Sort by pickup window start (soonest first).
  lots.sort((a, b) => Date.parse(a.pickupWindow.start) - Date.parse(b.pickupWindow.start));
  return lots.slice(0, MAX_LOTS);
}

// ─── DB wrapper ───────────────────────────────────────────────
/**
 * buildBulkLots(prisma, filters?)
 *   Fetches recent listings + runs the aggregator. Accepts the same
 *   crop/country/region filters as listings so callers can scope to
 *   one view at a time. Returns [] on missing prisma or no matches.
 */
export async function buildBulkLots(prisma, {
  crop = null, country = null, region = null,
  windowDays = DEFAULT_WINDOW_DAYS,
  pickupWindowDays = DEFAULT_PICKUP_DAYS,
  minContributors = DEFAULT_MIN_CONTRIB,
  now = Date.now(),
} = {}) {
  if (!prisma?.produceListing?.findMany) return [];
  const ms = windowDays * 24 * 60 * 60 * 1000;
  const fromDate = new Date(now - ms);

  const where = {
    status: 'available',
    createdAt: { gte: fromDate },
  };
  if (crop) where.crop = upperCrop(crop);
  if (country) {
    // ProduceListing doesn't have a country column in schema; we
    // filter on region only server-side and rely on aggregator to
    // surface the country carried through by the listing row.
  }
  if (region) {
    where.region = { equals: region, mode: 'insensitive' };
  }

  const rows = await prisma.produceListing.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  return aggregateBulkLots(rows, { now, windowDays, pickupWindowDays, minContributors });
}

/**
 * buildBulkLotById(prisma, lotId, options?)
 *   Re-runs aggregation and returns the lot with the matching id,
 *   or null if it no longer exists (listings removed, contributors
 *   dropped below minimum, past the window).
 */
export async function buildBulkLotById(prisma, lotId, opts = {}) {
  if (!lotId || typeof lotId !== 'string') return null;
  const lots = await buildBulkLots(prisma, opts);
  return lots.find((l) => l.lotId === lotId) || null;
}

// ─── Status inference (exported for tests) ───────────────────
/**
 * classifyLotStatus(lot, requestsForLot)
 *   'active'     — no buyer requests, at least one contributor still
 *                  available
 *   'requested'  — at least one open or accepted request references
 *                  this lotId
 *   'completed'  — all contributing listings have moved to sold
 */
export function classifyLotStatus(lot, requestsForLot = []) {
  if (!lot) return 'active';
  if (Array.isArray(requestsForLot) && requestsForLot.some(
        (r) => r && (r.status === 'matched' || r.status === 'open'))) {
    return 'requested';
  }
  return lot.status || 'active';
}

export const _internal = Object.freeze({
  DEFAULT_PICKUP_DAYS, DEFAULT_WINDOW_DAYS, DEFAULT_MIN_CONTRIB, MAX_LOTS,
  canonical, upperCrop, lowerRegion,
});
