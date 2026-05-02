/**
 * pruneScanTrainingEvents.js — bounded retention sweep for the
 * scan_training_events ledger.
 *
 *   import { pruneScanTrainingEvents } from './pruneScanTrainingEvents.js';
 *   const { deleted, retained } = await pruneScanTrainingEvents();
 *
 * Retention policy (advanced ML scan layer remaining-risk fix)
 *   * Hard cap: MAX_KEEP rows total (default 100,000). When the
 *     ledger crosses this number we delete the oldest excess
 *     rows in batches.
 *   * Always keeps rows with `userFeedback` set ("helpful" /
 *     "not_helpful" / "not_sure") regardless of age — they're
 *     the highest-value training samples.
 *   * Always keeps rows with `expertLabel` set — gold-standard
 *     supervision data.
 *   * The "expendable" pool that can be pruned is therefore:
 *       userFeedback IS NULL AND expertLabel IS NULL
 *   * Within the expendable pool, oldest-first deletion.
 *
 * Strict rules
 *   * Never throws — Prisma errors are swallowed and the
 *     function returns { deleted: 0, error } so a cron caller
 *     can keep retrying.
 *   * Idempotent — re-running on a healthy ledger is a no-op.
 *   * Deletion happens in batches of 1000 so a 200k+ ledger
 *     doesn't lock the table for minutes.
 *
 * Recommended invocation
 *   * Daily cron: midnight UTC via the existing
 *     farmProcessingCron.js scheduler.
 *   * Admin-triggered via POST /api/ops/scan-training/prune
 *     (super_admin only).
 */

const DEFAULT_MAX_KEEP = 100_000;
const BATCH_SIZE       = 1000;

let _prismaInstance = null;

async function _getPrisma() {
  if (_prismaInstance) return _prismaInstance;
  try {
    const mod = await import('../core/prisma.js');
    _prismaInstance = mod.prisma || mod.default || null;
    return _prismaInstance;
  } catch { return null; }
}

/**
 * pruneScanTrainingEvents({ maxKeep, dryRun }) → summary.
 *
 * @param {object} [opts]
 * @param {number} [opts.maxKeep=100000]  hard ceiling
 * @param {boolean}[opts.dryRun=false]    count only — no DELETE
 * @returns {Promise<{ deleted, retained, expendablePool, dryRun, error? }>}
 */
export async function pruneScanTrainingEvents(opts = {}) {
  const maxKeep = Number.isFinite(opts.maxKeep) ? opts.maxKeep : DEFAULT_MAX_KEEP;
  const dryRun  = !!opts.dryRun;

  const prisma = await _getPrisma();
  if (!prisma || !prisma.scanTrainingEvent) {
    return { deleted: 0, retained: 0, expendablePool: 0, dryRun, error: 'no_prisma' };
  }

  let total = 0;
  try {
    total = await prisma.scanTrainingEvent.count();
  } catch (err) {
    return { deleted: 0, retained: 0, expendablePool: 0, dryRun, error: err && err.message };
  }

  // No-op when under the cap.
  if (total <= maxKeep) {
    return { deleted: 0, retained: total, expendablePool: 0, dryRun };
  }

  // Compute how many to delete and from which pool.
  const overflow = total - maxKeep;
  let expendablePool = 0;
  try {
    expendablePool = await prisma.scanTrainingEvent.count({
      where: { userFeedback: null, expertLabel: null },
    });
  } catch (err) {
    return { deleted: 0, retained: total, expendablePool: 0, dryRun, error: err && err.message };
  }

  const targetDeletes = Math.min(overflow, expendablePool);
  if (targetDeletes <= 0) {
    return { deleted: 0, retained: total, expendablePool, dryRun };
  }

  if (dryRun) {
    return { deleted: 0, retained: total - targetDeletes, expendablePool, dryRun: true };
  }

  // Batched deletion — oldest expendable rows first.
  let deleted = 0;
  while (deleted < targetDeletes) {
    const batch = Math.min(BATCH_SIZE, targetDeletes - deleted);
    let ids;
    try {
      const rows = await prisma.scanTrainingEvent.findMany({
        where:   { userFeedback: null, expertLabel: null },
        orderBy: { createdAt: 'asc' },
        take:    batch,
        select:  { id: true },
      });
      ids = rows.map((r) => r.id);
    } catch (err) {
      return {
        deleted, retained: total - deleted, expendablePool,
        dryRun: false, error: err && err.message,
      };
    }
    if (!ids || ids.length === 0) break;

    try {
      await prisma.scanTrainingEvent.deleteMany({ where: { id: { in: ids } } });
      deleted += ids.length;
    } catch (err) {
      return {
        deleted, retained: total - deleted, expendablePool,
        dryRun: false, error: err && err.message,
      };
    }
  }

  return {
    deleted,
    retained:       total - deleted,
    expendablePool,
    dryRun:         false,
  };
}

export const _internal = Object.freeze({ DEFAULT_MAX_KEEP, BATCH_SIZE });
export default pruneScanTrainingEvents;
