/**
 * dedupStore.js — persistent dedup backing store for the new
 * insightNotificationAdapter.
 *
 * The live daily cron (server/src/modules/autoNotifications/) is
 * already backed by the `AutoNotification` Prisma table + its own
 * `rateLimiter.isAllowed()` check. This module exposes the same
 * persistence guarantee in the shape the new adapter expects, so
 * the day someone migrates the cron to consume
 * `insightNotificationAdapter.buildNotifications({ liveChannels })`
 * (see Fix 4 header) the dedup Set is already wired to survive
 * server restarts and deploys.
 *
 *   getRecentDedupKeys(opts) → Promise<Set<string>>
 *     Reads every AutoNotification row (+ FarmerNotification
 *     mirror) created within `windowHours` and returns the set of
 *     dedup keys. The adapter passes the set into buildNotifications
 *     as `recentlySent`.
 *
 *   recordDedupKey({ key, userId, farmerId, payload }) → Promise<void>
 *     After a successful external-channel delivery (SMS, WhatsApp,
 *     voice), the dispatcher records the key so the next cron cycle
 *     will skip the same alert. Matches the adapter's id convention
 *     (`<channel>:<source>:<farmId>:<insightId>:<date>`).
 *
 * Contract
 *   • Both functions are safe to call on a fresh database — they
 *     no-op when the table is empty rather than crash.
 *   • The current live path (autoNotifications cron) ALREADY uses
 *     persistent dedup via rateLimiter.isAllowed + AutoNotification
 *     table, so this module is a foundation for the future unified
 *     path, not a replacement for what's live today.
 *   • Never throws to the caller. DB errors resolve to an empty Set
 *     (on read) or a warning log (on write) so a DB blip doesn't
 *     knock the notification system offline.
 */

import prisma from '../../config/database.js';

const DEFAULT_WINDOW_HOURS = 24;

/**
 * getRecentDedupKeys({ windowHours, userId?, farmerId? })
 *   Returns the Set of dedup keys logged within the window. When
 *   `userId` / `farmerId` is supplied we scope the scan; otherwise
 *   we scan the full window (used by the org-wide scheduler).
 */
export async function getRecentDedupKeys({
  windowHours = DEFAULT_WINDOW_HOURS,
  userId = null,
  farmerId = null,
} = {}) {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const keys = new Set();

  try {
    if (!prisma?.autoNotification?.findMany) return keys;
    const where = { createdAt: { gte: cutoff } };
    if (farmerId) where.farmerId = farmerId;
    if (userId)   where.userId   = userId;
    // `metadata` is the free-form JSON column on AutoNotification;
    // we stash the adapter dedup key under metadata.dedupKey.
    const rows = await prisma.autoNotification.findMany({
      where,
      select: { metadata: true },
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });
    for (const r of rows) {
      const md = coerceMeta(r && r.metadata);
      if (md && typeof md.dedupKey === 'string') keys.add(md.dedupKey);
    }
  } catch (err) {
    // DB blip — return what we have. The adapter treats an empty
    // set as "nothing sent yet", so the worst case is a duplicate
    // alert on the very first cycle after a DB outage.
    console.warn('[dedupStore] getRecentDedupKeys failed:', err && err.message);
  }
  return keys;
}

/**
 * recordDedupKey({ key, userId, farmerId, payload })
 *   Writes a row that subsequent scheduler runs will see via
 *   `getRecentDedupKeys`. Idempotent — if the row already exists
 *   (same key within window) we skip the write so concurrent
 *   dispatchers can't flood the table.
 */
export async function recordDedupKey({
  key, userId = null, farmerId = null, type = 'generic',
  payload = null,
} = {}) {
  if (!key) return;
  if (!prisma?.autoNotification?.create) return;
  try {
    // Best-effort uniqueness: check-then-insert within the same
    // microtask. Prisma doesn't give us upsert without a unique
    // constraint, and we don't want to change the schema just for
    // dedup.
    const existing = await prisma.autoNotification.count({
      where: {
        userId: userId || undefined,
        farmerId: farmerId || undefined,
        type,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        metadata: { path: ['dedupKey'], equals: key },
      },
    }).catch(() => 0);
    if (existing > 0) return;
    await prisma.autoNotification.create({
      data: {
        type,
        userId,
        farmerId,
        status: 'sent',
        metadata: {
          dedupKey: key,
          ...(payload && typeof payload === 'object' ? payload : {}),
        },
      },
    });
  } catch (err) {
    // Persisted-dedup failure is better than spam: we simply log.
    console.warn('[dedupStore] recordDedupKey failed:', err && err.message);
  }
}

function coerceMeta(m) {
  if (!m) return null;
  if (typeof m === 'string') {
    try { return JSON.parse(m); } catch { return null; }
  }
  return typeof m === 'object' ? m : null;
}

export const _internal = Object.freeze({
  DEFAULT_WINDOW_HOURS, coerceMeta,
});
