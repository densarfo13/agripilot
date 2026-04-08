/**
 * Auto-Notification Cron Scheduler
 *
 * Runs the notification trigger engine on a schedule.
 * Default: every day at 08:00 UTC.
 *
 * Override via environment variable:
 *   AUTO_NOTIF_CRON="0 8 * * *"  (default)
 *
 * Call startNotificationCron() once from app startup.
 * Call stopNotificationCron() for graceful shutdown.
 */

import cron from 'node-cron';
import { runNotificationCycle } from './service.js';
import { logNotificationEvent } from '../../utils/opsLogger.js';

const DEFAULT_SCHEDULE = '0 8 * * *'; // 08:00 UTC daily

let task = null;

export function startNotificationCron() {
  const schedule = process.env.AUTO_NOTIF_CRON || DEFAULT_SCHEDULE;

  if (!cron.validate(schedule)) {
    console.error(`[autoNotifCron] Invalid cron schedule: "${schedule}". Using default.`);
  }

  const resolvedSchedule = cron.validate(schedule) ? schedule : DEFAULT_SCHEDULE;

  task = cron.schedule(resolvedSchedule, async () => {
    const cycleStart = Date.now();
    console.log('[autoNotifCron] Starting notification cycle...');
    try {
      const result = await runNotificationCycle();
      const durationMs = Date.now() - cycleStart;
      console.log(`[autoNotifCron] Cycle complete (${durationMs}ms):`, result);
      logNotificationEvent('cycle_complete', { ...result, durationMs });
      // Warn if cycle takes longer than 60 seconds — may indicate DB pressure
      if (durationMs > 60_000) {
        logNotificationEvent('cycle_slow', { durationMs, threshold: 60_000, ...result });
      }
    } catch (err) {
      const durationMs = Date.now() - cycleStart;
      console.error('[autoNotifCron] Cycle failed:', err.message);
      logNotificationEvent('cycle_error', { error: err.message, durationMs });
    }
  }, {
    timezone: 'UTC',
  });

  console.log(`[autoNotifCron] Scheduled — "${resolvedSchedule}" (UTC)`);
}

export function stopNotificationCron() {
  if (task) {
    task.stop();
    task = null;
    console.log('[autoNotifCron] Stopped.');
  }
}
