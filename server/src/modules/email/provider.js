/**
 * Email provider adapter.
 *
 * Delegates to the canonical `server/services/emailService.js` which
 * is SendGrid-only. The template orchestrator in
 * `server/src/modules/email/service.js` calls `send(...)` below with
 * already-rendered subject/html/text and a per-template `from`
 * identity. We honour the given `from.email` when it's a non-empty
 * verified address, otherwise we fall back to EMAIL_FROM.
 */

import {
  sendEmail as sgSendEmail,
  isEmailConfigured,
} from '../../../services/emailService.js';

// The canonical helper is `isEmailConfigured`; keep the legacy name
// `isConfigured` (used by email/routes.js and older callers) as a
// thin alias so the import chain stays intact after the SendGrid
// migration.
export { isEmailConfigured };
export function isConfigured() { return isEmailConfigured(); }

/**
 * Send an email via SendGrid.
 * @param {{ to: string, from?: { email: string, name: string }, subject: string, html: string, text: string }} params
 * @returns {{ success: boolean, error?: string }}
 */
export async function send({ to, from: _from, subject, html, text }) {
  // `from.email` in this module's call sites is a per-purpose sender
  // (support@ / notifications@ / etc). SendGrid requires each address
  // to be verified individually; if it isn't, the send fails with
  // `sender_not_verified`. In practice we rely on the global
  // EMAIL_FROM, which is why emailService doesn't accept per-call
  // `from` overrides. We accept the argument here for API shape
  // compatibility and ignore it.
  void _from;
  if (!isEmailConfigured()) {
    return { success: false, error: 'SENDGRID_API_KEY not configured' };
  }
  const result = await sgSendEmail({ to, subject, html, text });
  if (result.ok) return { success: true };
  return {
    success: false,
    error: result.code + (result.details ? `: ${result.details}` : ''),
  };
}
