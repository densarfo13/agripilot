/**
 * mailer.js — single-entry email sender used by auth (password reset,
 * email verification) and anywhere else that needs transactional email
 * without the richer `src/modules/email/service.js` template layer.
 *
 * Delivery strategy (first one that's configured wins):
 *
 *   1. SendGrid HTTP API   — preferred in production
 *        env SENDGRID_API_KEY + EMAIL_FROM (or SMTP_FROM)
 *
 *   2. SMTP (nodemailer)   — supported for legacy / self-hosted ops
 *        env SMTP_HOST + SMTP_USER + SMTP_PASS
 *
 *   3. Dev-console fallback — if neither is configured AND NODE_ENV !=
 *        production, print a clearly-labelled dev banner with the
 *        subject, recipient, and the first absolute URL found in the
 *        body so the operator can click straight through to the
 *        reset/verify flow. In production this path returns an error
 *        rather than silently dropping the email.
 *
 * Return shape (every path):
 *
 *   {
 *     success:  boolean,
 *     provider: 'sendgrid' | 'smtp' | 'console' | 'none',
 *     error?:   string,                // present when success=false
 *     skipped?: boolean,               // true when console-printed
 *   }
 *
 * Never throws. Callers can treat a false `success` as a signal to
 * surface a user-facing fallback (e.g. "check your spam folder, or
 * try again in a minute").
 */

import nodemailer from 'nodemailer';
import { env } from './env.js';

// ─── Provider detection ──────────────────────────────────────────
function hasSendgrid() {
  return !!(process.env.SENDGRID_API_KEY && String(process.env.SENDGRID_API_KEY).trim());
}
function hasSmtp() {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}
function fromAddress() {
  // EMAIL_FROM is the spec-canonical name; SMTP_FROM is legacy. We
  // accept either, plus a last-ditch fallback so test envs boot.
  return process.env.EMAIL_FROM
      || env.SMTP_FROM
      || 'no-reply@farroway.app';
}

/**
 * validateEmailConfig — called once at boot from server.js. Logs a
 * one-line warning per missing variable so ops has a boot-time
 * checklist. Does NOT throw; the app can still run (sign-in,
 * dashboards, etc.) when email is disabled.
 */
export function validateEmailConfig({ log = console } = {}) {
  const problems = [];
  if (!hasSendgrid() && !hasSmtp()) {
    problems.push('No email provider configured (set SENDGRID_API_KEY, or SMTP_HOST + SMTP_USER + SMTP_PASS).');
  }
  if (!process.env.EMAIL_FROM && !env.SMTP_FROM) {
    problems.push('EMAIL_FROM is not set. Falling back to the default "no-reply@farroway.app" sender.');
  }
  if (!env.APP_BASE_URL) {
    problems.push('APP_BASE_URL is not set. Reset links will be malformed.');
  }
  const configured =
    (hasSendgrid() ? 'sendgrid' : null) ||
    (hasSmtp()     ? 'smtp'     : null) ||
    'none';
  log.info
    ? log.info(`[mailer] provider=${configured} from=${fromAddress()} appBaseUrl=${env.APP_BASE_URL}`)
    : console.log(`[mailer] provider=${configured} from=${fromAddress()} appBaseUrl=${env.APP_BASE_URL}`);
  for (const p of problems) {
    (log.warn || console.warn)(`[mailer] ${p}`);
  }
  return Object.freeze({
    provider: configured,
    from:     fromAddress(),
    appBaseUrl: env.APP_BASE_URL,
    problems,
  });
}

// ─── SMTP transport (lazy) ───────────────────────────────────────
let _smtpTransport = null;
function getSmtpTransport() {
  if (_smtpTransport) return _smtpTransport;
  if (!hasSmtp())     return null;
  _smtpTransport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return _smtpTransport;
}

// ─── SendGrid client (lazy) ──────────────────────────────────────
let _sg = null;
async function getSendgrid() {
  if (_sg) return _sg;
  if (!hasSendgrid()) return null;
  try {
    const mod = await import('@sendgrid/mail');
    _sg = mod.default || mod;
    _sg.setApiKey(process.env.SENDGRID_API_KEY);
    return _sg;
  } catch (err) {
    // The @sendgrid/mail package is optional — log once and signal
    // "not available" so we fall through to SMTP / console.
    console.warn('[mailer] @sendgrid/mail is not installed; skipping SendGrid path.', err?.message);
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function firstUrlIn(text) {
  if (!text) return null;
  const m = String(text).match(/https?:\/\/\S+/);
  return m ? m[0].replace(/[),.;]+$/, '') : null;
}

function devConsolePrint({ to, subject, text, html }) {
  // Render a high-contrast, greppable block so operators can spot
  // outgoing reset / verify URLs in a busy log stream.
  const url = firstUrlIn(text) || firstUrlIn(html) || '(no URL in body)';
  const bar = '─'.repeat(60);
  /* eslint-disable no-console */
  console.log(`\n${bar}\n[mailer:dev] Email would be sent (no provider configured)\n${bar}`);
  console.log(`  to:      ${to}`);
  console.log(`  subject: ${subject}`);
  console.log(`  link:    ${url}`);
  console.log(`${bar}`);
  console.log('  body (text):');
  console.log(String(text || html || '').split('\n').map((l) => `    ${l}`).join('\n'));
  console.log(`${bar}\n`);
  /* eslint-enable no-console */
}

// ─── Public API ──────────────────────────────────────────────────
/**
 * sendEmail — try providers in priority order. Always returns a
 * structured result; never throws.
 *
 *   sendEmail({ to, subject, text, html, requestId? })
 *     → { success, provider, error?, skipped? }
 */
export async function sendEmail({ to, subject, html, text, requestId = null } = {}) {
  const tag = requestId ? `[mailer:${requestId}]` : '[mailer]';
  if (!to || !subject) {
    console.warn(`${tag} refusing to send — missing to/subject`);
    return { success: false, provider: 'none', error: 'missing_to_or_subject' };
  }
  const from = fromAddress();

  // 1) SendGrid
  if (hasSendgrid()) {
    try {
      const client = await getSendgrid();
      if (client) {
        console.log(`${tag} sending via sendgrid to=${to} subject=${JSON.stringify(subject)}`);
        await client.send({ to, from, subject, html, text });
        console.log(`${tag} sendgrid accepted to=${to}`);
        return { success: true, provider: 'sendgrid' };
      }
    } catch (err) {
      // SendGrid usually buries the real reason 2 levels deep.
      const detail =
          err?.response?.body?.errors?.[0]?.message
       || err?.message
       || 'unknown sendgrid error';
      console.error(`${tag} sendgrid send failed to=${to}: ${detail}`);
      // Don't fall through to SMTP after SendGrid rejected — the
      // sender identity (EMAIL_FROM) is different enough that a
      // quiet double-send would be confusing. The caller will see
      // success=false and surface a safe message.
      return { success: false, provider: 'sendgrid', error: detail };
    }
  }

  // 2) SMTP
  if (hasSmtp()) {
    const transport = getSmtpTransport();
    if (transport) {
      try {
        console.log(`${tag} sending via smtp to=${to} subject=${JSON.stringify(subject)}`);
        const info = await transport.sendMail({ from, to, subject, html, text });
        console.log(`${tag} smtp accepted to=${to} messageId=${info?.messageId || '?'}`);
        return { success: true, provider: 'smtp' };
      } catch (err) {
        console.error(`${tag} smtp send failed to=${to}: ${err?.message || err}`);
        return { success: false, provider: 'smtp', error: err?.message || 'smtp_error' };
      }
    }
  }

  // 3) No provider configured
  if (String(env.NODE_ENV).toLowerCase() !== 'production') {
    // Dev / demo / staging: print the payload so the operator can use
    // the link without needing real SMTP. Returns skipped=true so the
    // caller's audit trail records that no real email went out.
    devConsolePrint({ to, subject, text, html });
    return { success: true, provider: 'console', skipped: true };
  }

  // 4) Production with no provider — this is a configuration bug.
  console.error(`${tag} NO EMAIL PROVIDER CONFIGURED. Set SENDGRID_API_KEY or SMTP_*. to=${to}`);
  return { success: false, provider: 'none', error: 'email_provider_not_configured' };
}

// Convenience re-export for ops scripts that want provider status
// without importing the whole module.
export const _internal = Object.freeze({ hasSendgrid, hasSmtp, fromAddress, firstUrlIn });
