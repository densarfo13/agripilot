/**
 * listingFreshnessService.js — buyer-facing freshness chip + a
 * stale-listing sweeper.
 *
 *   getListingFreshnessLabel(listing)
 *     → { key: 'market.freshness.fresh' | 'older' | 'stale' | 'expired',
 *         ageDays: number,
 *         expiresAt?: Date }
 *
 *   expireStaleListings(prisma, { now? })
 *     Flips any listing that's been active for > STALE_DAYS to
 *     status='closed'. Swallows table-not-migrated errors so ops
 *     cron jobs never crash.
 *
 * Thresholds are module-level constants so the UI copy + the
 * sweeper agree on what "stale" means.
 */

const MS_DAY = 86_400_000;
export const FRESH_DAYS = 3;
export const OLDER_DAYS = 14;
export const STALE_DAYS = 30;

function ageDays(listing, nowMs) {
  const created = listing?.createdAt ? new Date(listing.createdAt).getTime() : null;
  if (!Number.isFinite(created)) return null;
  return Math.max(0, Math.floor((nowMs - created) / MS_DAY));
}

export function getListingFreshnessLabel(listing = {}, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const age = ageDays(listing, nowMs);
  if (age === null) return { key: 'market.freshness.unknown', ageDays: null };
  if (age <= FRESH_DAYS) return { key: 'market.freshness.fresh', ageDays: age };
  if (age <= OLDER_DAYS) return { key: 'market.freshness.older', ageDays: age };
  if (age <= STALE_DAYS) {
    const expiresInDays = STALE_DAYS - age;
    return {
      key: 'market.freshness.stale',
      ageDays: age,
      expiresInDays,
    };
  }
  return { key: 'market.freshness.expired', ageDays: age };
}

/**
 * expireStaleListings — moves every active listing older than
 * STALE_DAYS to 'closed'. Returns { expired: N } so a cron job
 * can log the sweep.
 */
export async function expireStaleListings(prisma, { now = new Date() } = {}) {
  const cutoff = new Date((now instanceof Date ? now.getTime() : new Date(now).getTime()) - STALE_DAYS * MS_DAY);
  try {
    const res = await prisma.cropListing.updateMany({
      where: { status: 'active', createdAt: { lt: cutoff } },
      data: { status: 'closed' },
    });
    return { expired: res?.count ?? 0, cutoff: cutoff.toISOString() };
  } catch {
    return { expired: 0, cutoff: cutoff.toISOString() };
  }
}
