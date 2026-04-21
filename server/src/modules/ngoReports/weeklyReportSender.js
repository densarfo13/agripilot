/**
 * weeklyReportSender.js — dispatches the Monday weekly report via
 * SendGrid (with graceful fallback when email isn't configured).
 *
 *   sendWeeklyReport({
 *     recipients,        // array of { email, name?, program? } rows
 *     report?,           // pre-compiled report — if omitted we build one
 *     prisma?,
 *     now?,
 *     fetchEmail?,       // test shim — replaces the sendgrid call
 *   }) → {
 *     sent:        number,
 *     skipped:     number,
 *     failed:      number,
 *     byOutcome:   Map,
 *     deliveries:  [{ email, outcome, reason? }],
 *   }
 *
 * Design:
 *   • Per-program filtering — recipients carry their own program
 *     scope so one NGO operator sees only their program's report
 *   • Never throws — individual send failures are captured in the
 *     deliveries array; the rest of the batch continues
 *   • Logs every outcome to ActionLog when available so admins can
 *     audit who got what last Monday
 */

import { opsEvent } from '../../utils/opsLogger.js';
import {
  buildWeeklyReport, formatReportAsText, formatReportAsHtml,
} from './weeklyReportEngine.js';

function envEmailConfigured() {
  return !!(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM_ADDRESS);
}

async function defaultSendEmail({ to, subject, text, html }) {
  if (!envEmailConfigured()) {
    return { sent: false, skipped: true, reason: 'email_not_configured' };
  }
  try {
    const sg = (await import('@sendgrid/mail')).default;
    sg.setApiKey(process.env.SENDGRID_API_KEY);
    const fromName = process.env.EMAIL_FROM_NAME || 'Farroway';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS;
    await sg.send({
      to,
      from: { email: fromAddress, name: fromName },
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err && err.message ? err.message.slice(0, 160) : 'send_failed' };
  }
}

/**
 * sendWeeklyReport — main entry. Report is compiled per unique
 * program present in the recipient list so we don't regenerate it
 * once per recipient.
 */
export async function sendWeeklyReport({
  recipients = [],
  report     = null,
  prisma     = null,
  now        = Date.now(),
  windowDays = 7,
  fetchEmail = defaultSendEmail,
  actionLog  = null,   // optional writer: async (row) => void
} = {}) {
  const list = Array.isArray(recipients) ? recipients.filter((r) => r && r.email) : [];
  if (list.length === 0) {
    return { sent: 0, skipped: 0, failed: 0, deliveries: [], reason: 'no_recipients' };
  }

  // Compile reports once per unique program scope.
  const scopes = new Set(list.map((r) => r.program || null));
  const reportsByScope = new Map();
  for (const scope of scopes) {
    const compiled = report && (!scope || report.meta?.program === scope)
      ? report
      : await buildWeeklyReport({ prisma, program: scope, now, windowDays });
    reportsByScope.set(scope, compiled);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const deliveries = [];

  for (const recipient of list) {
    const scope = recipient.program || null;
    const compiled = reportsByScope.get(scope);
    const scopeLabel = compiled.meta.program || 'All programs';
    const subject = `Farroway weekly report \u2014 ${scopeLabel}`;
    const text    = formatReportAsText(compiled);
    const html    = formatReportAsHtml(compiled);

    let result;
    try {
      result = await fetchEmail({ to: recipient.email, subject, text, html });
    } catch (err) {
      result = { sent: false, reason: err && err.message ? err.message : 'send_threw' };
    }

    if (result && result.sent) {
      sent += 1;
      deliveries.push({ email: recipient.email, outcome: 'sent' });
    } else if (result && result.skipped) {
      skipped += 1;
      deliveries.push({
        email: recipient.email, outcome: 'skipped',
        reason: result.reason || 'skipped',
      });
    } else {
      failed += 1;
      deliveries.push({
        email: recipient.email, outcome: 'failed',
        reason: (result && result.reason) || 'unknown',
      });
    }

    if (typeof actionLog === 'function') {
      try {
        await actionLog({
          actionType: 'weekly_report_email',
          targetType: 'email',
          targetId:   recipient.email,
          channel:    'email',
          outcome:    result && result.sent ? 'success' : 'failure',
          reason:     (result && result.reason) || null,
          metadata:   {
            program: scope, subject,
            summary: compiled.summary,
          },
        });
      } catch { /* non-fatal */ }
    }
  }

  opsEvent('ngoReports', 'weekly_report_dispatched', 'info', {
    sent, skipped, failed, recipients: list.length,
  });

  return { sent, skipped, failed, deliveries };
}

export const _internal = Object.freeze({
  defaultSendEmail, envEmailConfigured,
});
