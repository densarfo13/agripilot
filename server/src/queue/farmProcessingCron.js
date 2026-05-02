/**
 * farmProcessingCron.js — periodic sweep that breaks the farmer
 * roster into small batches and enqueues each batch onto the
 * RISK_SCORING queue. The worker side consumes those jobs,
 * computes per-farm risk via the V2 intelligence layer, writes
 * the result into FarmMetrics, and invalidates the farm-summary
 * cache.
 *
 *   startFarmProcessingCron()   — registers the sweep
 *   stopFarmProcessingCron()    — tears it down
 *   runSweepOnce({ prismaClient, batchSize })
 *     — single cycle, used by the cron AND by an ops admin
 *       endpoint ("force a sweep now")
 *
 * Defaults — env-overridable:
 *   FARM_PROCESSING_CRON        default '*\/30 * * * *' (every 30 min)
 *   FARM_PROCESSING_BATCH_SIZE  default 250
 *   FARM_PROCESSING_MAX_BATCHES default 200  (safety cap per cycle)
 *
 * The API layer stays lightweight — it never computes scores
 * inline. Only this cron (and the worker) touch the intelligence
 * pipeline, so dashboard reads serve from cache + FarmMetrics.
 */

import cron from 'node-cron';

import prisma       from '../config/database.js';
import { opsEvent } from '../utils/opsLogger.js';
import { enqueue, QUEUES } from './queueClient.js';

const DEFAULT_SCHEDULE      = '*/30 * * * *';
const DEFAULT_BATCH_SIZE    = 250;
const DEFAULT_MAX_BATCHES   = 200;
let task = null;

function readConfig() {
  return {
    schedule:    process.env.FARM_PROCESSING_CRON        || DEFAULT_SCHEDULE,
    batchSize:   Number(process.env.FARM_PROCESSING_BATCH_SIZE)  || DEFAULT_BATCH_SIZE,
    maxBatches:  Number(process.env.FARM_PROCESSING_MAX_BATCHES) || DEFAULT_MAX_BATCHES,
  };
}

/**
 * runSweepOnce — walk the farmer roster in page-sized batches and
 * enqueue one `risk_scoring` job per batch. Workers fan out from
 * there. Uses keyset pagination (id > lastId) so it scales to
 * millions of rows without cursor / offset pain.
 */
export async function runSweepOnce({
  prismaClient = prisma,
  batchSize    = DEFAULT_BATCH_SIZE,
  maxBatches   = DEFAULT_MAX_BATCHES,
  now          = Date.now(),
} = {}) {
  const started = Date.now();
  let enqueued  = 0;
  let batches   = 0;
  let lastId    = null;

  // Farmer model has an auto id — use it as the paging cursor.
  // Programs / cohorts could be added as filters later without
  // changing the worker contract; every batch carries whatever
  // ids it scanned and the worker re-reads them fresh.
  if (!prismaClient || !prismaClient.farmer || typeof prismaClient.farmer.findMany !== 'function') {
    opsEvent('farmProcessingCron', 'prisma_unavailable', 'warn', {});
    return { cycle: 'skipped', reason: 'prisma_unavailable', enqueued, batches };
  }

  while (batches < maxBatches) {
    let rows;
    try {
      rows = await prismaClient.farmer.findMany({
        where: lastId ? { id: { gt: lastId } } : undefined,
        orderBy: { id: 'asc' },
        take: Math.max(1, Math.min(1000, batchSize)),
        select: { id: true },
      });
    } catch (err) {
      opsEvent('farmProcessingCron', 'scan_failed', 'error', {
        batches, error: err && err.message,
      });
      break;
    }
    if (!rows || rows.length === 0) break;

    const farmIds = rows.map((r) => String(r.id));
    const result  = await enqueue(QUEUES.RISK_SCORING, {
      batchId:    `farms_${now}_${batches}`,
      farmIds,
      requestedAt: now,
      source:     'cron',
    });
    if (result && result.queued) enqueued += farmIds.length;
    batches += 1;
    lastId = farmIds[farmIds.length - 1];
    if (rows.length < batchSize) break;
  }

  const durationMs = Date.now() - started;
  opsEvent('farmProcessingCron', 'sweep_complete', 'info', {
    batches, enqueued, durationMs, batchSize,
  });
  return { cycle: 'ok', enqueued, batches, durationMs };
}

export function startFarmProcessingCron() {
  const { schedule, batchSize, maxBatches } = readConfig();
  if (!cron || typeof cron.validate !== 'function' || !cron.validate(schedule)) {
    console.error(`[farmProcessingCron] Invalid schedule: "${schedule}". Not starting.`);
    return null;
  }
  task = cron.schedule(schedule, async () => {
    console.log(`[farmProcessingCron] Sweep starting (batch=${batchSize})`);
    try {
      const out = await runSweepOnce({ batchSize, maxBatches });
      console.log('[farmProcessingCron] Sweep complete:', out);
    } catch (err) {
      console.error('[farmProcessingCron] Sweep threw:', err && err.message);
      opsEvent('farmProcessingCron', 'sweep_threw', 'error', { error: err && err.message });
    }
    // ML scan training-data retention sweep — bounded ledger
    // size at 100k rows. Runs alongside the farm sweep so we
    // get one daily housekeeping pass instead of two cron
    // schedules. Self-contained — failure here doesn't impact
    // the farm sweep.
    try {
      const { pruneScanTrainingEvents } = await import('../ml/pruneScanTrainingEvents.js');
      const summary = await pruneScanTrainingEvents();
      if (summary.deleted > 0 || summary.error) {
        opsEvent('mlRetentionSweep', 'prune_complete', summary.error ? 'warn' : 'info', summary);
      }
    } catch (err) {
      opsEvent('mlRetentionSweep', 'prune_threw', 'error', { error: err && err.message });
    }
  }, { scheduled: false, timezone: 'UTC' });
  task.start();
  console.log(`[farmProcessingCron] Scheduled — "${schedule}" UTC (batch=${batchSize}, maxBatches=${maxBatches})`);
  return task;
}

export function stopFarmProcessingCron() {
  if (task) {
    try { task.stop(); } catch {}
    task = null;
    console.log('[farmProcessingCron] Stopped.');
  }
}

export const _internal = Object.freeze({
  readConfig, DEFAULT_SCHEDULE, DEFAULT_BATCH_SIZE, DEFAULT_MAX_BATCHES,
  getTask: () => task,
});
