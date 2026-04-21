/**
 * actionEngine.js — executes a single Decision via the existing
 * channel sender (Twilio SMS / SendGrid email / in-app fallback)
 * and writes the outcome to ActionLog.
 *
 *   executeAction(decision, { prisma, dispatch, now }) → {
 *     decision,
 *     executed:  boolean,
 *     channel:   string | null,
 *     outcome:   'success' | 'failure' | 'skipped',
 *     reason:    string | null,
 *     logId:     string | null,
 *   }
 *
 * Safety layers:
 *   • De-duplication — same (actionType, targetId) already executed
 *     successfully today → skipped with reason 'already_sent_today'.
 *   • Dry run — `{ dryRun: true }` in opts never calls dispatch;
 *     writes a skipped ActionLog row with reason 'dry_run'.
 *   • Graceful failure — dispatch errors are caught, logged, and
 *     returned as outcome 'failure' so the cron keeps processing
 *     the rest of the batch.
 *   • ActionLog missing — if `prisma.actionLog` isn't created yet
 *     (migration pending), the engine falls back to opsEvent + an
 *     in-memory buffer accessible via `_drainMemoryLog()` for
 *     server-side log scraping until the migration lands.
 *
 * Never throws.
 */

import { opsEvent } from '../../utils/opsLogger.js';

const DAY_MS = 24 * 3600 * 1000;

// In-memory backup when `prisma.actionLog` isn't yet migrated. Keeps
// the last 500 rows so operators can scrape `GET /api/admin/action-log`
// (added in a follow-up) before the DB column exists.
const MEMORY_LOG = [];
const MAX_MEMORY_ROWS = 500;

function rememberInMemory(row) {
  MEMORY_LOG.push(row);
  if (MEMORY_LOG.length > MAX_MEMORY_ROWS) MEMORY_LOG.splice(0, MEMORY_LOG.length - MAX_MEMORY_ROWS);
}

async function writeActionLog({ prisma, row }) {
  try {
    if (prisma && prisma.actionLog && typeof prisma.actionLog.create === 'function') {
      const created = await prisma.actionLog.create({ data: row });
      return created && created.id ? created.id : null;
    }
  } catch (err) {
    // Fall through to the ops event log.
    opsEvent('autonomous', 'action_log_write_failed', 'error', {
      error: err && err.message, actionType: row && row.actionType,
    });
  }
  rememberInMemory({ ...row, createdAt: new Date().toISOString() });
  opsEvent('autonomous', 'action_log_buffered', 'info', {
    actionType: row.actionType, outcome: row.outcome, reason: row.reason,
  });
  return null;
}

async function hasAlreadyRunToday({ prisma, actionType, targetId, now }) {
  try {
    if (!prisma || !prisma.actionLog || typeof prisma.actionLog.findFirst !== 'function') {
      return MEMORY_LOG.some((r) =>
        r.actionType === actionType
        && r.targetId   === targetId
        && r.outcome    === 'success'
        && Number.isFinite(Date.parse(r.createdAt))
        && (now - Date.parse(r.createdAt)) < DAY_MS,
      );
    }
    const since = new Date(now - DAY_MS);
    const hit = await prisma.actionLog.findFirst({
      where: { actionType, targetId, outcome: 'success', createdAt: { gte: since } },
      select: { id: true },
    });
    return !!hit;
  } catch { return false; }
}

/**
 * executeAction — dispatch + log. Returns an exhaustive outcome
 * object; never throws. The cron runner aggregates these into
 * per-cycle stats.
 */
export async function executeAction(decision, {
  prisma,
  dispatch,              // injected sender — the existing autoNotifications/sender.js dispatch
  now     = Date.now(),
  dryRun  = false,
  actor   = { role: 'system', id: null },
} = {}) {
  if (!decision || !decision.actionType || !decision.targetId) {
    return {
      decision, executed: false, channel: null,
      outcome: 'skipped', reason: 'invalid_decision', logId: null,
    };
  }

  // Same-day de-dup — cheap Prisma lookup before we spend an SMS.
  const dupe = await hasAlreadyRunToday({
    prisma, actionType: decision.actionType, targetId: decision.targetId, now,
  });
  if (dupe) {
    const logId = await writeActionLog({
      prisma,
      row: {
        actionType: decision.actionType,
        targetType: decision.targetType || null,
        targetId:   decision.targetId,
        actorRole:  actor.role || 'system',
        actorId:    actor.id || null,
        channel:    decision.channel || null,
        outcome:    'skipped',
        reason:     'already_sent_today',
        priorityScore: Number(decision.score) || null,
        metadata:   { rule: decision.rule, reason: decision.reason },
        scheduledFor: decision.scheduledFor ? new Date(decision.scheduledFor) : null,
      },
    });
    return {
      decision, executed: false, channel: null,
      outcome: 'skipped', reason: 'already_sent_today', logId,
    };
  }

  // Dry run — never dispatch.
  if (dryRun) {
    const logId = await writeActionLog({
      prisma,
      row: {
        actionType: decision.actionType,
        targetType: decision.targetType || null,
        targetId:   decision.targetId,
        actorRole:  actor.role || 'system',
        actorId:    actor.id || null,
        channel:    decision.channel || null,
        outcome:    'skipped',
        reason:     'dry_run',
        priorityScore: Number(decision.score) || null,
        metadata:   { rule: decision.rule, reason: decision.reason,
                      template: decision.template },
        scheduledFor: decision.scheduledFor ? new Date(decision.scheduledFor) : null,
      },
    });
    return {
      decision, executed: false, channel: null,
      outcome: 'skipped', reason: 'dry_run', logId,
    };
  }

  // No-op actions (e.g. 'assign_officer' with no officer registry
  // wired server-side yet) are logged so the learning loop has
  // a record even when we can't execute.
  if (decision.actionType === 'assign_officer' && !decision.officerId) {
    const logId = await writeActionLog({
      prisma,
      row: {
        actionType: decision.actionType,
        targetType: decision.targetType || null,
        targetId:   decision.targetId,
        actorRole:  actor.role || 'system',
        actorId:    actor.id || null,
        channel:    null,
        outcome:    'skipped',
        reason:     'no_officer_roster',
        priorityScore: Number(decision.score) || null,
        metadata:   { rule: decision.rule, reason: decision.reason },
        scheduledFor: decision.scheduledFor ? new Date(decision.scheduledFor) : null,
      },
    });
    return {
      decision, executed: false, channel: null,
      outcome: 'skipped', reason: 'no_officer_roster', logId,
    };
  }

  // Dispatch via the existing channel-aware sender.
  let outcome = 'failure';
  let reasonCode = null;
  let usedChannel = null;
  try {
    const { phone, email, farmerId } = decision.contact || {};
    const { subject, message } = decision.template || {};
    const preferredChannel = decision.channel || 'sms';
    if (typeof dispatch !== 'function') {
      throw new Error('dispatch_not_injected');
    }
    const result = await dispatch({
      preferredChannel, subject, message, phone, email, farmerId,
    });
    usedChannel = result && result.channel ? result.channel : preferredChannel;
    outcome = 'success';
  } catch (err) {
    reasonCode = err && err.message ? String(err.message).slice(0, 120) : 'dispatch_failed';
  }

  const logId = await writeActionLog({
    prisma,
    row: {
      actionType: decision.actionType,
      targetType: decision.targetType || null,
      targetId:   decision.targetId,
      actorRole:  actor.role || 'system',
      actorId:    actor.id || null,
      channel:    usedChannel || decision.channel || null,
      outcome,
      reason:     reasonCode,
      priorityScore: Number(decision.score) || null,
      metadata:   {
        rule:    decision.rule,
        reason:  decision.reason,
        subject: decision.template && decision.template.subject,
      },
      scheduledFor: decision.scheduledFor ? new Date(decision.scheduledFor) : null,
      executedAt:   new Date(now),
    },
  });

  return {
    decision, executed: outcome === 'success', channel: usedChannel,
    outcome, reason: reasonCode, logId,
  };
}

export function _drainMemoryLog() {
  const snap = MEMORY_LOG.slice();
  MEMORY_LOG.length = 0;
  return snap;
}

export const _internal = Object.freeze({
  MEMORY_LOG, MAX_MEMORY_ROWS, DAY_MS, writeActionLog, hasAlreadyRunToday,
});
