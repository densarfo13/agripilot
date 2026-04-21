/**
 * cronRunner.js — daily autonomous-action loop.
 *
 *   startAutonomousActionCron()  — registers the daily cron
 *   stopAutonomousActionCron()   — tears it down
 *   runOnce(opts)                — single-cycle runner (used by the
 *                                   cron AND by the ops admin endpoint)
 *
 * Schedule (overridable via env):
 *   AUTONOMOUS_ACTION_CRON  — default '0 7 * * *' (07:00 UTC daily)
 *   AUTONOMOUS_ACTION_DRY_RUN — when '1', never dispatches (useful
 *                                for shadow-run validation)
 *   AUTONOMOUS_ACTION_BATCH — max decisions per cycle, default 100
 *
 * Delegates:
 *   • decideActions — pure rule-based decisions (decisionEngine)
 *   • executeAction — dispatch + log (actionEngine)
 *   • dispatch      — reuses autoNotifications/sender dispatch so the
 *                     fallback chain is identical to the manual
 *                     admin SMS/email path
 *
 * Never throws — a bad cycle logs via opsEvent + writes failure
 * rows to ActionLog; the next cycle runs normally.
 */

import cron from 'node-cron';

import { decideActions } from './decisionEngine.js';
import { executeAction } from './actionEngine.js';
import { dispatch }      from '../autoNotifications/sender.js';
import prisma            from '../../config/database.js';
import { opsEvent }      from '../../utils/opsLogger.js';

const DEFAULT_SCHEDULE = '0 7 * * *';
let task = null;

function readConfig() {
  const schedule = process.env.AUTONOMOUS_ACTION_CRON || DEFAULT_SCHEDULE;
  const dryRun = process.env.AUTONOMOUS_ACTION_DRY_RUN === '1'
             || process.env.AUTONOMOUS_ACTION_DRY_RUN === 'true';
  const batch  = Number(process.env.AUTONOMOUS_ACTION_BATCH) || 100;
  return { schedule, dryRun, batch };
}

/**
 * runOnce — execute one full cycle. Callable from the cron OR from
 * an ops-admin HTTP endpoint so operators can force a run without
 * waiting for the next tick.
 */
export async function runOnce({
  dryRunOverride = null,
  now = Date.now(),
  // Test-only overrides. Defaults are the production Prisma client
  // + the real dispatch sender. Tests inject lightweight stubs.
  prismaClient = prisma,
  dispatchFn   = dispatch,
} = {}) {
  const { dryRun: envDry, batch } = readConfig();
  const dryRun = dryRunOverride != null ? !!dryRunOverride : envDry;
  const started = Date.now();

  let decisions = [];
  try {
    decisions = await decideActions({ prisma: prismaClient, now });
  } catch (err) {
    opsEvent('autonomous', 'decide_actions_failed', 'error', { error: err && err.message });
    return { cycle: 'failed', ranForMs: Date.now() - started, error: err && err.message };
  }

  const slice = decisions.slice(0, Math.max(0, Math.min(500, batch)));
  const stats = {
    considered: decisions.length,
    attempted:  slice.length,
    succeeded:  0,
    skipped:    0,
    failed:     0,
    reasons:    {},
  };

  for (const decision of slice) {
    let result;
    try {
      result = await executeAction(decision, {
        prisma: prismaClient, dispatch: dispatchFn, now, dryRun,
      });
    } catch (err) {
      // executeAction never throws by contract, but be defensive.
      opsEvent('autonomous', 'execute_action_threw', 'error', {
        error: err && err.message,
        actionType: decision.actionType, targetId: decision.targetId,
      });
      stats.failed += 1;
      continue;
    }

    if (result.outcome === 'success') stats.succeeded += 1;
    else if (result.outcome === 'skipped') stats.skipped += 1;
    else stats.failed += 1;

    if (result.reason) {
      stats.reasons[result.reason] = (stats.reasons[result.reason] || 0) + 1;
    }
  }

  opsEvent('autonomous', 'cycle_complete', 'info', {
    dryRun, ...stats, durationMs: Date.now() - started,
  });
  return { cycle: 'ok', dryRun, durationMs: Date.now() - started, stats };
}

export function startAutonomousActionCron() {
  const { schedule, dryRun, batch } = readConfig();

  if (!cron || typeof cron.validate !== 'function' || !cron.validate(schedule)) {
    console.error(`[autonomousActions] Invalid cron schedule: "${schedule}". Not starting.`);
    return null;
  }

  task = cron.schedule(schedule, async () => {
    const startedAt = new Date().toISOString();
    console.log(`[autonomousActions] Cycle starting @ ${startedAt} (dryRun=${dryRun}, batch=${batch})`);
    try {
      const result = await runOnce();
      console.log('[autonomousActions] Cycle complete:', result);
    } catch (err) {
      console.error('[autonomousActions] Cycle threw:', err && err.message);
      opsEvent('autonomous', 'cycle_threw', 'error', { error: err && err.message });
    }
  }, { scheduled: false, timezone: 'UTC' });

  task.start();
  console.log(`[autonomousActions] Scheduled — "${schedule}" UTC (dryRun=${dryRun})`);
  return task;
}

export function stopAutonomousActionCron() {
  if (task) {
    try { task.stop(); } catch { /* ignore */ }
    task = null;
    console.log('[autonomousActions] Stopped.');
  }
}

export const _internal = Object.freeze({
  readConfig, DEFAULT_SCHEDULE, getTask: () => task,
});
