/**
 * mailer.js — single SMTP transport for every outgoing Farroway email.
 *
 * Provider: Zoho SMTP (or any RFC-compliant SMTP server). SendGrid was
 * removed in favour of an ops-controlled mailbox the team can monitor
 * directly. There is NO silent fallback — if the SMTP environment is
 * missing or wrong, sends fail loudly and the caller can surface that
 * state to the UI.
 *
 *   env SMTP_HOST      — e.g. "smtp.zoho.com"
 *   env SMTP_PORT      — 465 (SSL) or 587 (STARTTLS). Default 587.
 *   env SMTP_USER      — e.g. "admin@farroway.app"
 *   env SMTP_PASS      — account / app password
 *   env EMAIL_FROM     — from address. Defaults to "admin@farroway.app".
 *   env EMAIL_FROM_NAME — display name. Defaults to "Farroway".
 *   env APP_BASE_URL   — used by callers to build links.
 *
 * Public API:
 *
 *   isEmailConfigured() → boolean
 *   validateEmailConfig({ log? }) → { provider, from, problems[] }
 *   sendEmail({ to, subject, html, text, requestId? })
 *     → { success, provider, messageId?, error? }
 *
 * sendEmail never throws. Callers check `.success` and route the rest.
 */

import nodemailer from 'nodemailer';

// We read env via process.env directly (not through lib/env.js) so
// that test environments without DATABASE_URL can still import the
// mailer — ops-only concerns like SMTP setup shouldn't be gated by
// the DB-required config module.
const env = {
  NODE_ENV:     process.env.NODE_ENV || 'development',
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5173',
};

// ─── Config helpers ──────────────────────────────────────────────
export function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function fromAddress() {
  // Zoho (and most SMTP relays) require that the From header match an
  // authenticated mailbox. Default to admin@farroway.app per product
  // spec; ops can override via EMAIL_FROM when needed for a specific
  // project mailbox.
  return process.env.EMAIL_FROM || 'admin@farroway.app';
}
function fromName() {
  return process.env.EMAIL_FROM_NAME || 'Farroway';
}
function fromHeader() {
  const addr = fromAddress();
  const name = fromName();
  // nodemailer accepts "Name <addr>" as a string.
  return name ? `${name} <${addr}>` : addr;
}

function smtpPort() {
  const n = Number(process.env.SMTP_PORT);
  return Number.isFinite(n) && n > 0 ? n : 587;
}

/**
 * validateEmailConfig — called once at boot from server.js. Logs a
 * one-line warning per missing variable so ops has a boot-time
 * checklist. Does NOT throw; the app still boots without email so
 * non-email flows keep working.
 */
export function validateEmailConfig({ log = console } = {}) {
  const problems = [];
  if (!process.env.SMTP_HOST) problems.push('SMTP_HOST is not set.');
  if (!process.env.SMTP_USER) problems.push('SMTP_USER is not set.');
  if (!process.env.SMTP_PASS) problems.push('SMTP_PASS is not set.');
  if (!env.APP_BASE_URL)      problems.push('APP_BASE_URL is not set. Links inside emails will be malformed.');
  if (!process.env.EMAIL_FROM) {
    problems.push('EMAIL_FROM is not set. Using default "admin@farroway.app" — make sure this mailbox is the SMTP_USER (or an alias it can send as).');
  }

  const configured = isEmailConfigured();
  const line = `[mailer] provider=${configured ? 'smtp' : 'none'}`
    + ` host=${process.env.SMTP_HOST || '(unset)'}`
    + ` port=${smtpPort()}`
    + ` user=${process.env.SMTP_USER || '(unset)'}`
    + ` from=${fromAddress()}`
    + ` appBaseUrl=${env.APP_BASE_URL}`;
  (log.info || log.log || console.log)(line);
  for (const p of problems) (log.warn || console.warn)(`[mailer] ${p}`);

  return Object.freeze({
    provider:   configured ? 'smtp' : 'none',
    from:       fromAddress(),
    appBaseUrl: env.APP_BASE_URL,
    problems,
  });
}

// ─── Transport (lazy, re-used across requests) ───────────────────
let _transport = null;
let _transportKey = '';

function currentKey() {
  return [process.env.SMTP_HOST, smtpPort(), process.env.SMTP_USER, process.env.SMTP_PASS].join('|');
}

function getTransport() {
  if (!isEmailConfigured()) return null;
  const key = currentKey();
  if (_transport && _transportKey === key) return _transport;
  const port = smtpPort();
  _transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 / 2525 use STARTTLS (secure=false).
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  _transportKey = key;
  return _transport;
}

// ─── Public send ─────────────────────────────────────────────────
/**
 * sendEmail — SMTP send with structured logging.
 *
 *   sendEmail({ to, subject, text, html, requestId? })
 *     → { success: true,  provider: 'smtp', messageId }
 *     → { success: false, provider: 'smtp', error: 'smtp_error: …' }
 *     → { success: false, provider: 'none', error: 'smtp_not_configured' }
 */
export async function sendEmail({ to, subject, html, text, requestId = null } = {}) {
  const tag = requestId ? `[mailer:${requestId}]` : '[mailer]';
  if (!to || !subject) {
    console.warn(`${tag} refusing to send — missing to/subject`);
    return { success: false, provider: 'none', error: 'missing_to_or_subject' };
  }
  const transport = getTransport();
  if (!transport) {
    console.error(`${tag} SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS. to=${to}`);
    return { success: false, provider: 'none', error: 'smtp_not_configured' };
  }
  const from = fromHeader();
  try {
    console.log(`${tag} sending via smtp host=${process.env.SMTP_HOST} from=${from} to=${to} subject=${JSON.stringify(subject)}`);
    const info = await transport.sendMail({ from, to, subject, html, text });
    console.log(`${tag} smtp accepted to=${to} messageId=${info?.messageId || '?'}`);
    return { success: true, provider: 'smtp', messageId: info?.messageId || null };
  } catch (err) {
    // Surface nodemailer's structured error where possible — response
    // / responseCode come straight from the SMTP server, which is
    // exactly what ops wants to see in the log.
    const detail = [
      err?.code,
      err?.responseCode,
      err?.response,
      err?.message,
    ].filter(Boolean).join(' | ');
    console.error(`${tag} smtp send failed to=${to}: ${detail}`);
    return { success: false, provider: 'smtp', error: `smtp_error: ${err?.message || 'unknown'}` };
  }
}

// Re-exported so ops scripts can inspect without importing the whole
// module surface.
export const _internal = Object.freeze({ fromHeader, smtpPort });
