/**
 * Email provider — SMTP via Zoho (nodemailer).
 *
 * SendGrid was removed; this module now delegates to the shared SMTP
 * transport in `server/lib/mailer.js`. The public contract is
 * unchanged so every caller inside `src/modules/email/service.js`
 * continues to work without code changes:
 *
 *   isConfigured()                             → boolean
 *   send({ to, from, subject, html, text })    → { success, error? }
 *
 * `from` is accepted for API shape compatibility but is ignored —
 * SMTP servers (Zoho especially) require the envelope sender to match
 * the authenticated SMTP_USER, so the mailer always uses EMAIL_FROM.
 * Passing a different `from` silently here would get the message
 * bounced by the relay.
 */

import { sendEmail, isEmailConfigured } from '../../../lib/mailer.js';

export function isConfigured() {
  return isEmailConfigured();
}

/**
 * Send an email via the shared SMTP transport.
 * @param {{ to: string, from?: { email: string, name: string }, subject: string, html: string, text: string }} params
 * @returns {{ success: boolean, error?: string }}
 */
export async function send({ to, from: _from, subject, html, text }) {
  // `_from` is accepted for backwards compatibility and intentionally
  // ignored — see file header.
  if (!isEmailConfigured()) {
    return { success: false, error: 'SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS).' };
  }
  const result = await sendEmail({ to, subject, html, text });
  if (result.success) return { success: true };
  return { success: false, error: result.error || 'smtp_send_failed' };
}
