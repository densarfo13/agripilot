/**
 * emailService.js — single outbound email provider for Farroway.
 *
 * Provider: SendGrid (@sendgrid/mail). SMTP (nodemailer / Zoho) was
 * removed — this is the only transport the app uses now. There is
 * no console fallback in production; callers that want to cover a
 * delivery failure use the existing product-level manual-link
 * fallback (see invite flow / forgot-password flow).
 *
 * Required env:
 *   SENDGRID_API_KEY   SendGrid API key (starts with SG.)
 *   EMAIL_FROM         From address, MUST be verified in SendGrid
 *                      (matching a Single Sender or a Domain
 *                      Authentication record). Defaults to
 *                      admin@farroway.app.
 *   APP_BASE_URL       Origin for reset / invite links.
 *   NODE_ENV           'production' disables the dev-only verbose
 *                      stderr dump of the payload.
 *
 * Public API:
 *   isEmailConfigured() → boolean
 *   validateEmailConfig({ log? }) → { provider, from, problems[] }
 *   sendEmail({ to, subject, text, html, requestId? })
 *     → {
 *         ok:          boolean,
 *         statusCode?: number,           // HTTP status from SendGrid
 *         code?:       string,           // 'ok' | 'not_configured'
 *                                        // | 'sender_not_verified'
 *                                        // | 'recipient_invalid'
 *                                        // | 'auth_failed'
 *                                        // | 'provider_error'
 *                                        // | 'network_error'
 *                                        // | 'missing_to_or_subject'
 *         details?:    string,           // safe short server-side detail
 *         messageId?:  string,
 *       }
 *
 * Never throws. Errors come back as { ok: false, code, details }.
 * `details` is already sanitised and safe to persist in logs, but
 * MUST NOT be forwarded verbatim to a farmer-facing UI — callers map
 * `code` to a friendly line.
 */

// ─── Config helpers ──────────────────────────────────────────────
export function isEmailConfigured() {
  return !!(
    process.env.SENDGRID_API_KEY &&
    String(process.env.SENDGRID_API_KEY).trim().length > 0
  );
}

export function fromAddress() {
  return process.env.EMAIL_FROM || 'admin@farroway.app';
}

function fromName() {
  return process.env.EMAIL_FROM_NAME || 'Farroway';
}

/**
 * validateEmailConfig — called once at boot from server.js. Logs a
 * one-line startup summary plus a warning line per missing required
 * variable. Does NOT throw; the app still boots without email so
 * unrelated flows keep working.
 */
export function validateEmailConfig({ log = console } = {}) {
  const problems = [];
  if (!process.env.SENDGRID_API_KEY) problems.push('SENDGRID_API_KEY is not set.');
  if (!process.env.APP_BASE_URL)     problems.push('APP_BASE_URL is not set. Links inside emails will be malformed.');
  if (!process.env.EMAIL_FROM) {
    problems.push('EMAIL_FROM is not set. Falling back to admin@farroway.app — this MUST be verified in SendGrid.');
  }

  const configured = isEmailConfigured();
  const line = `[email] provider=${configured ? 'sendgrid' : 'none'}`
    + ` from=${fromAddress()}`
    + ` appBaseUrl=${process.env.APP_BASE_URL || '(unset)'}`;
  (log.info || log.log || console.log)(line);
  for (const p of problems) (log.warn || console.warn)(`[email] ${p}`);

  return Object.freeze({
    provider:   configured ? 'sendgrid' : 'none',
    from:       fromAddress(),
    appBaseUrl: process.env.APP_BASE_URL || '',
    problems,
  });
}

// ─── SendGrid client (lazy, cached) ──────────────────────────────
let _sg = null;
let _sgKey = '';
async function getSendgrid() {
  if (!isEmailConfigured()) return null;
  if (_sg && _sgKey === process.env.SENDGRID_API_KEY) return _sg;
  try {
    const mod = await import('@sendgrid/mail');
    const client = mod.default || mod;
    client.setApiKey(process.env.SENDGRID_API_KEY);
    _sg = client;
    _sgKey = process.env.SENDGRID_API_KEY;
    return _sg;
  } catch (err) {
    console.error('[email] @sendgrid/mail is missing from node_modules — install it with `npm i @sendgrid/mail`', err?.message);
    return null;
  }
}

// ─── Error classification ────────────────────────────────────────
// Map a SendGrid error body into one of our canonical codes. Keep
// `details` short and sanitised — never pass a full stack trace.
function classifyError(err) {
  const body      = err?.response?.body;
  const statusCode = err?.code || err?.response?.statusCode;
  const sgErrors  = Array.isArray(body?.errors) ? body.errors : [];
  const firstMsg  = sgErrors[0]?.message || '';
  const msg       = String(firstMsg || err?.message || '').toLowerCase();

  if (msg.includes('does not match a verified sender')
      || msg.includes('verified sender identity')
      || msg.includes('from address does not match')) {
    return { code: 'sender_not_verified',
             details: sgErrors[0]?.message || 'Sender not verified in SendGrid.',
             statusCode };
  }
  if (msg.includes('permission') || msg.includes('forbidden')
      || msg.includes('unauthorized') || statusCode === 401 || statusCode === 403) {
    return { code: 'auth_failed',
             details: 'SendGrid rejected the API key.',
             statusCode };
  }
  if (msg.includes('does not contain a valid address')
      || msg.includes('invalid email address')
      || msg.includes('recipient')) {
    return { code: 'recipient_invalid',
             details: 'Recipient address rejected by SendGrid.',
             statusCode };
  }
  if (msg.includes('network') || msg.includes('timeout')
      || msg.includes('fetch failed') || msg.includes('econn')) {
    return { code: 'network_error',
             details: 'Could not reach SendGrid.',
             statusCode };
  }
  return {
    code: 'provider_error',
    details: (firstMsg || err?.message || 'Unknown SendGrid error').slice(0, 240),
    statusCode,
  };
}

// ─── Public send ─────────────────────────────────────────────────
/**
 * sendEmail — canonical entry point.
 *
 *   sendEmail({ to, subject, text, html, requestId? })
 *     → { ok, code, statusCode?, details?, messageId? }
 */
export async function sendEmail({ to, subject, text, html, requestId = null } = {}) {
  const tag = requestId ? `[email:${requestId}]` : '[email]';

  if (!to || !subject) {
    console.warn(`${tag} refusing to send — missing to/subject`);
    return { ok: false, code: 'missing_to_or_subject' };
  }
  if (!isEmailConfigured()) {
    console.error(`${tag} SendGrid not configured — set SENDGRID_API_KEY. to=${to}`);
    return { ok: false, code: 'not_configured',
             details: 'SENDGRID_API_KEY is not set on the server.' };
  }

  const client = await getSendgrid();
  if (!client) {
    return { ok: false, code: 'not_configured',
             details: '@sendgrid/mail is not available on this host.' };
  }

  const from = { email: fromAddress(), name: fromName() };
  const msg = { to, from, subject, text, html };

  try {
    console.log(`${tag} sending to=${to} subject=${JSON.stringify(subject)} from=${from.email}`);
    const [response] = await client.send(msg);
    const statusCode = response?.statusCode;
    const messageId  = response?.headers?.['x-message-id'] || null;
    console.log(`${tag} sendgrid accepted status=${statusCode} messageId=${messageId || '?'} to=${to}`);
    return { ok: true, code: 'ok', statusCode, messageId };
  } catch (err) {
    const { code, details, statusCode } = classifyError(err);
    // Log the real reason for ops, but never forward it to the UI as-is.
    console.error(`${tag} sendgrid send failed to=${to} code=${code} status=${statusCode || '?'} details=${details}`);
    return { ok: false, code, statusCode, details };
  }
}

// Re-export a legacy-compatible helper for callers that pre-dated
// this module and expected { success, provider, error } shape.
// Keeping it here lets us flip a large call-site count without a
// big PR — deliveryService.js / resetService.js / etc. call this.
export async function sendEmailLegacy(args) {
  const result = await sendEmail(args);
  if (result.ok) {
    return { success: true, provider: 'sendgrid', messageId: result.messageId || null };
  }
  return {
    success: false,
    provider: result.code === 'not_configured' ? 'none' : 'sendgrid',
    error:    result.code + (result.details ? `: ${result.details}` : ''),
  };
}

// For ops scripts / tests.
export const _internal = Object.freeze({ classifyError, fromName });
