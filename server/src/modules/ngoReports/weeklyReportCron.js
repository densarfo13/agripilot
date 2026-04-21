/**
 * weeklyReportCron.js — Monday 08:00 UTC weekly-report run.
 *
 *   startWeeklyReportCron() / stopWeeklyReportCron()
 *   runWeeklyReportOnce(opts) — shared by cron + ops admin endpoint
 *
 * Env:
 *   NGO_WEEKLY_REPORT_CRON    default '0 8 * * 1'  (Monday 08:00 UTC)
 *   NGO_WEEKLY_REPORT_DRY_RUN '1' → compile + log, never email
 *   NGO_WEEKLY_REPORT_PROGRAM optional CSV allow-list of programs
 *
 * Recipients come from users with role in { super_admin, ngo_admin,
 * institutional_admin } who have an email and optional program scope.
 */

import cron from 'node-cron';

import defaultPrisma from '../../config/database.js';
import { opsEvent } from '../../utils/opsLogger.js';
import { sendWeeklyReport } from './weeklyReportSender.js';

const DEFAULT_SCHEDULE = '0 8 * * 1';
const REPORT_ROLES = new Set(['super_admin', 'ngo_admin', 'institutional_admin']);

let task = null;

function readConfig() {
  const schedule = process.env.NGO_WEEKLY_REPORT_CRON || DEFAULT_SCHEDULE;
  const dryRun   = process.env.NGO_WEEKLY_REPORT_DRY_RUN === '1'
               || process.env.NGO_WEEKLY_REPORT_DRY_RUN === 'true';
  const programAllow = (process.env.NGO_WEEKLY_REPORT_PROGRAM || '').trim();
  const programs = programAllow
    ? programAllow.split(',').map((x) => x.trim()).filter(Boolean)
    : null;
  return { schedule, dryRun, programs };
}

async function pickRecipients({ prisma, programs }) {
  if (!prisma || !prisma.user || typeof prisma.user.findMany !== 'function') {
    return [];
  }
  try {
    const users = await prisma.user.findMany({
      where: {
        active: true,
        email:  { not: null },
        role:   { in: Array.from(REPORT_ROLES) },
      },
      select: {
        id: true, email: true, fullName: true, role: true,
        organizationId: true, organization: { select: { name: true } },
      },
    });
    let list = users.map((u) => ({
      email:   u.email,
      name:    u.fullName,
      program: null, // program scoping can be refined once org ↔ program
                     // mapping exists; for now every recipient gets the
                     // all-programs view. Env allow-list can scope later.
    }));
    if (programs && programs.length > 0) {
      // With the allow-list set, we fan out one email per (user,
      // program) pair so operators get one report per program scope.
      const out = [];
      for (const u of list) {
        for (const program of programs) out.push({ ...u, program });
      }
      list = out;
    }
    return list;
  } catch (err) {
    opsEvent('ngoReports', 'recipient_query_failed', 'error', { error: err && err.message });
    return [];
  }
}

/**
 * runWeeklyReportOnce — shared driver used by cron + admin endpoint.
 * Injectable prisma / fetchEmail for tests; defaults pick up the
 * real client.
 */
export async function runWeeklyReportOnce({
  prisma         = defaultPrisma,
  now            = Date.now(),
  dryRunOverride = null,
  fetchEmail     = null,
  recipients     = null,
  actionLog      = null,
} = {}) {
  const { dryRun: envDry, programs } = readConfig();
  const dryRun = dryRunOverride != null ? !!dryRunOverride : envDry;
  const started = Date.now();

  const list = recipients != null
    ? recipients
    : await pickRecipients({ prisma, programs });

  if (list.length === 0) {
    opsEvent('ngoReports', 'weekly_no_recipients', 'warn', {});
    return { cycle: 'ok', dryRun, sent: 0, skipped: 0, failed: 0,
             recipients: 0, durationMs: Date.now() - started };
  }

  // Dry-run: still compile the report so operators can log-scrape
  // what the output WOULD have looked like; never calls SendGrid.
  const effectiveFetch = dryRun
    ? async () => ({ sent: false, skipped: true, reason: 'dry_run' })
    : fetchEmail;

  const out = await sendWeeklyReport({
    recipients: list, prisma, now,
    fetchEmail: effectiveFetch || undefined,
    actionLog,
  });

  opsEvent('ngoReports', 'weekly_cycle_complete', 'info', {
    dryRun, recipients: list.length,
    sent: out.sent, skipped: out.skipped, failed: out.failed,
    durationMs: Date.now() - started,
  });

  return {
    cycle: 'ok', dryRun,
    sent:       out.sent,
    skipped:    out.skipped,
    failed:     out.failed,
    recipients: list.length,
    durationMs: Date.now() - started,
  };
}

export function startWeeklyReportCron() {
  const { schedule } = readConfig();
  if (!cron || typeof cron.validate !== 'function' || !cron.validate(schedule)) {
    console.error(`[weeklyReportCron] Invalid schedule: "${schedule}". Not starting.`);
    return null;
  }
  task = cron.schedule(schedule, async () => {
    console.log(`[weeklyReportCron] Starting weekly report run`);
    try {
      const out = await runWeeklyReportOnce();
      console.log('[weeklyReportCron] Complete:', out);
    } catch (err) {
      console.error('[weeklyReportCron] Threw:', err && err.message);
      opsEvent('ngoReports', 'weekly_cycle_threw', 'error', { error: err && err.message });
    }
  }, { scheduled: false, timezone: 'UTC' });
  task.start();
  console.log(`[weeklyReportCron] Scheduled — "${schedule}" UTC`);
  return task;
}

export function stopWeeklyReportCron() {
  if (task) {
    try { task.stop(); } catch {}
    task = null;
    console.log('[weeklyReportCron] Stopped.');
  }
}

export const _internal = Object.freeze({
  readConfig, pickRecipients, DEFAULT_SCHEDULE,
  getTask: () => task,
});
