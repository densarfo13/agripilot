/**
 * ingest/maintenance.js — periodic cleanup helpers for the
 * client-event + risk-snapshot tables.
 *
 *   cleanupOldSnapshots({ prisma, retentionDays = 90 })
 *     -> { deleted }
 *   cleanupOldEvents({ prisma, retentionDays = 365 })
 *     -> { deleted }
 *
 * Why a separate module
 *   The ingestion path runs on every batch; cleanup runs at
 *   most once per day from a cron. Keeping them decoupled
 *   means a misbehaving cleanup can't slow down ingest, and a
 *   busy ingest can't push back on cleanup. Both functions
 *   take the prisma client as a parameter so the caller can
 *   inject a stub in tests.
 *
 * Strict-rule audit
 *   * Pure write paths — no reads beyond the deleteMany.
 *   * Bounded delete: clamp retentionDays to a sane range
 *     (7..730) so a misconfigured cron can't accidentally
 *     wipe the table by passing 0 days.
 *   * Returns the deleted-row count for observability so the
 *     cron task can log it via opsEvent.
 *   * Idempotent: a second run after a successful cleanup
 *     deletes 0 rows.
 *
 * Wiring
 *   This module exports the helpers but does NOT auto-run
 *   them. The host wires them into a scheduled task — e.g.
 *   the existing cron / scheduled-tasks layer in the codebase
 *   or a Railway cron job invoking a tiny CLI wrapper.
 *   Sample wrapper (not auto-mounted):
 *
 *     // scripts/cron-ingest-cleanup.mjs
 *     import prisma from '../server/src/config/database.js';
 *     import {
 *       cleanupOldSnapshots, cleanupOldEvents,
 *     } from '../server/src/modules/ingest/maintenance.js';
 *     await cleanupOldSnapshots({ prisma, retentionDays: 90 });
 *     await cleanupOldEvents({ prisma, retentionDays: 365 });
 *     await prisma.$disconnect();
 */

const MIN_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 730;
const DAY_MS = 24 * 60 * 60 * 1000;

function _clampDays(days, fallback) {
  const n = Number(days);
  if (!Number.isFinite(n)) return fallback;
  if (n < MIN_RETENTION_DAYS) return MIN_RETENTION_DAYS;
  if (n > MAX_RETENTION_DAYS) return MAX_RETENTION_DAYS;
  return Math.floor(n);
}

/**
 * cleanupOldSnapshots({ prisma, retentionDays })
 *
 * Deletes RiskSnapshot rows older than `retentionDays`. The
 * default of 90 days keeps a useful history for the
 * dashboard's 7d/30d slices while preventing unbounded
 * growth on a busy org.
 */
export async function cleanupOldSnapshots({
  prisma,
  retentionDays = 90,
} = {}) {
  if (!prisma || !prisma.riskSnapshot) {
    return { deleted: 0, error: 'prisma_missing' };
  }
  const days   = _clampDays(retentionDays, 90);
  const cutoff = new Date(Date.now() - days * DAY_MS);
  try {
    const result = await prisma.riskSnapshot.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return { deleted: Number(result && result.count) || 0, retentionDays: days };
  } catch (err) {
    return {
      deleted: 0,
      error:   err && err.message ? String(err.message).slice(0, 200) : 'unknown',
      retentionDays: days,
    };
  }
}

/**
 * cleanupOldEvents({ prisma, retentionDays })
 *
 * Deletes ClientEvent rows older than `retentionDays`. Default
 * of 365 days preserves a year of training history (plenty
 * for the baseline LR model + the seasonal NGO reports) while
 * capping growth.
 */
export async function cleanupOldEvents({
  prisma,
  retentionDays = 365,
} = {}) {
  if (!prisma || !prisma.clientEvent) {
    return { deleted: 0, error: 'prisma_missing' };
  }
  const days   = _clampDays(retentionDays, 365);
  const cutoff = new Date(Date.now() - days * DAY_MS);
  try {
    const result = await prisma.clientEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return { deleted: Number(result && result.count) || 0, retentionDays: days };
  } catch (err) {
    return {
      deleted: 0,
      error:   err && err.message ? String(err.message).slice(0, 200) : 'unknown',
      retentionDays: days,
    };
  }
}

export const RETENTION_BOUNDS = Object.freeze({
  MIN_DAYS: MIN_RETENTION_DAYS,
  MAX_DAYS: MAX_RETENTION_DAYS,
});

export default { cleanupOldSnapshots, cleanupOldEvents };
