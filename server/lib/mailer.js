/**
 * mailer.js — legacy adapter for the SendGrid-based email service.
 *
 * The canonical send lives in `server/services/emailService.js`. This
 * file preserves the pre-existing `{ success, provider, error }`
 * return shape so the ~10 call sites that were written before the
 * emailService refactor keep working without a PR each.
 *
 * Prefer importing from `server/services/emailService.js` directly
 * in new code.
 *
 * Removed in this pass:
 *   • nodemailer import and SMTP transport
 *   • SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS reads
 *   • dev-console fallback (SendGrid is the single provider)
 */

import {
  sendEmail as sgSendEmail,
  sendEmailLegacy,
  isEmailConfigured as sgIsEmailConfigured,
  validateEmailConfig as sgValidateEmailConfig,
  fromAddress as sgFromAddress,
} from '../services/emailService.js';

// ─── Legacy re-exports (same names as before the SMTP removal) ───
export const isEmailConfigured = sgIsEmailConfigured;
export const validateEmailConfig = sgValidateEmailConfig;
export const fromAddress = sgFromAddress;

/**
 * sendEmail — legacy shape preserved.
 *
 *   sendEmail({ to, subject, text, html, requestId? })
 *     → { success: true,  provider: 'sendgrid', messageId }
 *     → { success: false, provider: 'sendgrid', error: '<code>: <detail>' }
 *     → { success: false, provider: 'none',     error: 'not_configured: …' }
 *
 * New code should import `sendEmail` from services/emailService.js
 * and read `.ok` / `.code` / `.details` instead.
 */
export async function sendEmail(args) {
  return sendEmailLegacy(args);
}

// Re-export the canonical function for callers that already moved
// off the legacy shape but still import from lib/mailer.js.
export { sgSendEmail as sendEmailStructured };

export const _internal = Object.freeze({ sendEmailLegacy });
