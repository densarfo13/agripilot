/**
 * Email Service — central orchestrator for all Farroway email delivery.
 *
 * Responsibilities:
 *   1. Render template → html + text
 *   2. Log to EmailLog (queued)
 *   3. Send via provider
 *   4. Update log (sent / failed)
 *
 * Non-critical emails are fire-and-forget — they never block the caller.
 * Critical emails (OTP, password reset) return the result so the caller
 * can surface delivery failure to the user.
 */

import prisma from '../../config/database.js';
import * as provider from './provider.js';
import { SENDERS, TEMPLATES } from './constants.js';
import { renderTemplate } from './templateRenderer.js';
import { opsEvent } from '../../utils/opsLogger.js';

/**
 * Send an email and log it.
 *
 * @param {object} opts
 * @param {string}   opts.to           — recipient email
 * @param {object}   opts.sender       — { email, name } from SENDERS
 * @param {string}   opts.templateName — from TEMPLATES
 * @param {object}   opts.vars         — template variables
 * @param {string}  [opts.relatedUserId]
 * @param {string}  [opts.relatedReportId]
 * @param {boolean} [opts.critical]    — if true, awaits result; if false, fire-and-forget
 * @returns {Promise<{ sent: boolean, error?: string, logId?: string }>}
 */
export async function sendEmail({
  to,
  sender,
  templateName,
  vars = {},
  relatedUserId = null,
  relatedReportId = null,
  critical = false,
}) {
  // Render template
  const { subject, html, text } = renderTemplate(templateName, vars);

  // Create log entry (queued)
  let log;
  try {
    log = await prisma.emailLog.create({
      data: {
        recipient: to,
        sender: sender.email,
        subject,
        templateName,
        status: 'queued',
        relatedUserId,
        relatedReportId,
        metadata: vars.logSafe ? vars.logSafe : undefined,
      },
    });
  } catch (dbErr) {
    // Log creation failure should not block sending
    opsEvent('email', 'log_create_failed', 'warn', { templateName, to, error: dbErr.message });
  }

  // Send via provider
  const result = await provider.send({
    to,
    from: { email: sender.email, name: sender.name },
    subject,
    html,
    text,
  });

  // Update log status
  if (log) {
    try {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: result.success ? 'sent' : 'failed',
          errorMessage: result.error || null,
        },
      });
    } catch (dbErr) {
      opsEvent('email', 'log_update_failed', 'warn', { logId: log.id, error: dbErr.message });
    }
  }

  if (!result.success) {
    opsEvent('email', 'send_failed', 'warn', { templateName, to, error: result.error });
  }

  return { sent: result.success, error: result.error, logId: log?.id };
}

// ─── Convenience wrappers ────────────────────────────────────
// Each wraps sendEmail with the correct sender + template.
// Non-critical emails catch errors silently to avoid breaking the caller.

/**
 * Send welcome email after registration.
 */
export function sendWelcomeEmail({ to, fullName, appUrl, relatedUserId }) {
  return sendEmail({
    to,
    sender: SENDERS.ONBOARDING,
    templateName: TEMPLATES.WELCOME,
    vars: { fullName, appUrl, supportEmail: SENDERS.SUPPORT.email },
    relatedUserId,
  }).catch(err => {
    opsEvent('email', 'welcome_failed', 'warn', { to, error: err.message });
    return { sent: false, error: err.message };
  });
}

/**
 * Send verification/OTP email.
 * Critical — caller should check result.
 */
export function sendVerificationEmail({ to, fullName, otpCode, expiryMinutes, relatedUserId }) {
  return sendEmail({
    to,
    sender: SENDERS.NO_REPLY,
    templateName: TEMPLATES.VERIFICATION_OTP,
    vars: { fullName, otpCode, expiryMinutes },
    relatedUserId,
    critical: true,
  });
}

/**
 * Send pest alert email for high-confidence pest reports.
 */
export function sendPestAlertEmail({ to, fullName, riskLevel, likelyIssue, confidenceScore, actionGuidance, appUrl, relatedUserId, relatedReportId }) {
  return sendEmail({
    to,
    sender: SENDERS.NOTIFICATIONS,
    templateName: TEMPLATES.PEST_ALERT,
    vars: {
      fullName, riskLevel, likelyIssue, confidenceScore,
      actionGuidance, appUrl,
      logSafe: { riskLevel, likelyIssue, confidenceScore },
    },
    relatedUserId,
    relatedReportId,
  }).catch(err => {
    opsEvent('email', 'pest_alert_failed', 'warn', { to, error: err.message });
    return { sent: false, error: err.message };
  });
}

/**
 * Send regional pest watch email.
 */
export function sendRegionalWatchEmail({ to, fullName, regionName, riskSummary, recommendedAction, inspectionWindow, appUrl, relatedUserId }) {
  return sendEmail({
    to,
    sender: SENDERS.NOTIFICATIONS,
    templateName: TEMPLATES.REGIONAL_WATCH,
    vars: { fullName, regionName, riskSummary, recommendedAction, inspectionWindow, appUrl },
    relatedUserId,
  }).catch(err => {
    opsEvent('email', 'regional_watch_failed', 'warn', { to, error: err.message });
    return { sent: false, error: err.message };
  });
}

/**
 * Send feedback follow-up email.
 */
export function sendFeedbackEmail({ to, fullName, issueDescription, feedbackUrl, relatedUserId, relatedReportId }) {
  return sendEmail({
    to,
    sender: SENDERS.REPORTS,
    templateName: TEMPLATES.FEEDBACK_FOLLOWUP,
    vars: { fullName, issueDescription, feedbackUrl },
    relatedUserId,
    relatedReportId,
  }).catch(err => {
    opsEvent('email', 'feedback_failed', 'warn', { to, error: err.message });
    return { sent: false, error: err.message };
  });
}

/**
 * Send onboarding reminder email.
 */
export function sendOnboardingReminderEmail({ to, fullName, nextStep, continueUrl, relatedUserId }) {
  return sendEmail({
    to,
    sender: SENDERS.ONBOARDING,
    templateName: TEMPLATES.ONBOARDING_REMINDER,
    vars: { fullName, nextStep, continueUrl },
    relatedUserId,
  }).catch(err => {
    opsEvent('email', 'onboarding_reminder_failed', 'warn', { to, error: err.message });
    return { sent: false, error: err.message };
  });
}

/**
 * Send password reset email.
 * Critical — caller should check result.
 */
export function sendPasswordResetEmail({ to, fullName, resetUrl, expiryMinutes, relatedUserId }) {
  return sendEmail({
    to,
    sender: SENDERS.NO_REPLY,
    templateName: TEMPLATES.PASSWORD_RESET,
    vars: { fullName, resetUrl, expiryMinutes },
    relatedUserId,
    critical: true,
  });
}

// ─── Preference check helper ─────────────────────────────────

/**
 * Check if a user has opted out of a specific email type.
 * Uses the User.notifPreferences JSON field.
 * Returns true if email should be sent (default = yes).
 */
export async function shouldSendEmail(userId, templateName) {
  if (!userId) return true;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notifPreferences: true },
    });
    const prefs = user?.notifPreferences;
    if (!prefs || typeof prefs !== 'object') return true;
    // Check if the specific template type is explicitly disabled
    if (prefs.email === false) return false; // global email opt-out
    if (prefs[templateName] === false) return false; // per-template opt-out
    return true;
  } catch {
    return true; // on error, default to sending
  }
}
