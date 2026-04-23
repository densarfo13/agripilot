/**
 * smsService.js — SMS provider configuration check + canonical
 * availability signal for the unauthenticated UI.
 *
 * Two separate needs:
 *   • OTP / verification   → Twilio Verify (see
 *     src/modules/auth/smsVerification/*). Requires
 *     TWILIO_VERIFY_SERVICE_SID on top of the basic Twilio creds.
 *
 *   • Transactional / invites → Twilio Messages (see
 *     src/modules/notifications/deliveryService.js sendInviteSms).
 *     Requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +
 *     TWILIO_PHONE_NUMBER.
 *
 * This module exposes:
 *   isSmsVerifyConfigured()        → boolean
 *   isSmsMessagingConfigured()     → boolean
 *   validateSmsConfig({ log? })    → { verify, messaging, problems[] }
 *   sendSms({ to, body, requestId? }) → { ok, code, messageSid?, details? }
 *
 * validateSmsConfig() is called once at boot from server.js and
 * emits a one-line status summary + a warning per missing capability.
 * It never throws — the app still boots without SMS, only the SMS
 * features degrade to their manual/alternative fallbacks.
 *
 * sendSms() is the direct Twilio Messages API path used for
 * transactional messages that carry a link (invite SMS, password-
 * reset fallback). It is deliberately SEPARATE from Twilio Verify —
 * verify is for OTPs and cannot send free-form links.
 */

/**
 * Env-var aliases. The original Farroway uses
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER
 * The spec also asks for the shorter
 *   TWILIO_SID / TWILIO_TOKEN / TWILIO_PHONE
 * We accept both; canonicalizeTwilioEnv() copies the short form into
 * the long form at module load so every downstream helper keeps
 * working unchanged. Call sites never need to know which pair was set.
 */
function canonicalizeTwilioEnv() {
  if (!process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_SID) {
    process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_SID;
  }
  if (!process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_TOKEN) {
    process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_TOKEN;
  }
  if (!process.env.TWILIO_PHONE_NUMBER && process.env.TWILIO_PHONE) {
    process.env.TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE;
  }
}
canonicalizeTwilioEnv();

export function isSmsMessagingConfigured() {
  canonicalizeTwilioEnv();
  return !!(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_PHONE_NUMBER
  );
}

export function isSmsVerifyConfigured() {
  const provider = (process.env.SMS_VERIFY_PROVIDER || 'twilio-verify').toLowerCase();
  if (provider === 'twilio-verify') {
    return !!(
      process.env.TWILIO_ACCOUNT_SID
      && process.env.TWILIO_AUTH_TOKEN
      && process.env.TWILIO_VERIFY_SERVICE_SID
    );
  }
  if (provider === 'plivo-verify') {
    return !!(
      process.env.PLIVO_AUTH_ID
      && process.env.PLIVO_AUTH_TOKEN
      && process.env.PLIVO_VERIFY_APP_UUID
    );
  }
  if (provider === 'infobip-verify') {
    return !!(
      process.env.INFOBIP_API_KEY
      && process.env.INFOBIP_2FA_APPLICATION_ID
    );
  }
  return false;
}

/**
 * validateSmsConfig — boot-time summary. Logs a one-line line with
 * each capability on/off plus warnings per missing variable so ops
 * can fix configuration without having to wait for the first failure.
 */
export function validateSmsConfig({ log = console } = {}) {
  const verify    = isSmsVerifyConfigured();
  const messaging = isSmsMessagingConfigured();
  const provider  = (process.env.SMS_VERIFY_PROVIDER || 'twilio-verify').toLowerCase();
  const problems  = [];

  if (!process.env.TWILIO_ACCOUNT_SID) problems.push('TWILIO_ACCOUNT_SID is not set.');
  if (!process.env.TWILIO_AUTH_TOKEN)  problems.push('TWILIO_AUTH_TOKEN is not set.');
  if (!messaging && !process.env.TWILIO_PHONE_NUMBER) {
    problems.push('TWILIO_PHONE_NUMBER is not set — invite SMS messages cannot be sent.');
  }
  if (provider === 'twilio-verify' && !process.env.TWILIO_VERIFY_SERVICE_SID) {
    problems.push('TWILIO_VERIFY_SERVICE_SID is not set — SMS password recovery will be unavailable.');
  }

  const line = `[sms] verify=${verify ? 'on' : 'off'} messaging=${messaging ? 'on' : 'off'}`
    + ` provider=${provider}`
    + ` accountSid=${process.env.TWILIO_ACCOUNT_SID ? 'set' : '(unset)'}`
    + ` phoneNumber=${process.env.TWILIO_PHONE_NUMBER ? 'set' : '(unset)'}`;
  (log.info || log.log || console.log)(line);
  for (const p of problems) (log.warn || console.warn)(`[sms] ${p}`);

  return Object.freeze({ verify, messaging, problems });
}

// ─── Direct Twilio Messages send (transactional / fallback) ─────
let _twilioClient = null;
let _twilioKey = '';

async function getTwilioClient() {
  if (!isSmsMessagingConfigured()) return null;
  const key = process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN;
  if (_twilioClient && _twilioKey === key) return _twilioClient;
  try {
    const mod = await import('twilio');
    const twilio = mod.default || mod;
    _twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    _twilioKey = key;
    return _twilioClient;
  } catch (err) {
    console.error('[sms] twilio module not installed — run `npm i twilio`', err?.message);
    return null;
  }
}

function classifySmsError(err) {
  // Twilio error code cheatsheet:
  //   21211 — invalid recipient ("To" number isn't valid)
  //   21408 — permission denied to send to this region
  //   21608 — trial account: recipient not verified
  //   20003 — authenticate failed (bad SID / token)
  //   21614 — "To" is not a mobile number
  const code = err && err.code;
  const msg = String(err && err.message ? err.message : '').toLowerCase();
  if (code === 21211 || code === 21614 || msg.includes('not a valid phone')) {
    return { code: 'recipient_invalid', details: 'Recipient phone rejected.' };
  }
  if (code === 21408 || msg.includes('permission to send')) {
    return { code: 'region_blocked', details: 'SMS region not enabled on Twilio.' };
  }
  if (code === 21608 || msg.includes('unverified')) {
    return { code: 'trial_unverified', details: 'Twilio trial — recipient number is not verified.' };
  }
  if (code === 20003 || msg.includes('authenticate')) {
    return { code: 'auth_failed', details: 'Twilio credentials rejected.' };
  }
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('econn')) {
    return { code: 'network_error', details: 'Could not reach Twilio.' };
  }
  return {
    code: 'provider_error',
    details: String(err && err.message ? err.message : 'Unknown Twilio error').slice(0, 240),
  };
}

/**
 * sendSms — send a transactional SMS via Twilio Messages.
 *
 *   sendSms({ to, body, requestId? })
 *     → { ok: true,  code: 'ok', messageSid }
 *     → { ok: false, code: 'not_configured' | 'missing_to_or_body' |
 *                          'recipient_invalid' | 'trial_unverified' |
 *                          'region_blocked' | 'auth_failed' |
 *                          'network_error' | 'provider_error',
 *         details?: string }
 *
 * Never throws. Callers (e.g. notificationService) check `ok` and
 * either fall through to the next channel or surface a calm message.
 * No raw Twilio error body is ever returned to the caller — every
 * field is either a canonical code or a short sanitised string.
 */
export async function sendSms({ to, body, requestId = null } = {}) {
  const tag = requestId ? `[sms:${requestId}]` : '[sms]';
  if (!to || !body) {
    console.warn(`${tag} refusing to send — missing to/body`);
    return { ok: false, code: 'missing_to_or_body' };
  }
  if (!isSmsMessagingConfigured()) {
    console.error(`${tag} not configured — set TWILIO_ACCOUNT_SID / AUTH_TOKEN / PHONE_NUMBER. to=${maskPhone(to)}`);
    return {
      ok: false, code: 'not_configured',
      details: 'Twilio Messages is not configured on the server.',
    };
  }
  const client = await getTwilioClient();
  if (!client) {
    return { ok: false, code: 'not_configured', details: 'twilio SDK unavailable.' };
  }
  try {
    console.log(`${tag} sending to=${maskPhone(to)} bodyLen=${String(body).length}`);
    const msg = await client.messages.create({
      body: String(body),
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`${tag} accepted sid=${msg.sid} status=${msg.status || '?'} to=${maskPhone(to)}`);
    return { ok: true, code: 'ok', messageSid: msg.sid };
  } catch (err) {
    const { code, details } = classifySmsError(err);
    console.error(`${tag} failed code=${code} to=${maskPhone(to)} details=${details}`);
    return { ok: false, code, details };
  }
}

// Mask all but the last 4 digits so phone numbers never land in a
// log in clear form. +12345555555 → +******5555
function maskPhone(raw) {
  const s = String(raw || '');
  if (s.length <= 4) return s;
  return s.slice(0, 1) + '*'.repeat(Math.max(0, s.length - 5)) + s.slice(-4);
}

/**
 * Spec §3 positional shorthand:
 *   sendSMS(phoneNumber, message) → { ok, code, messageSid?, details? }
 *
 * Thin wrapper over sendSms({ to, body }) that also truncates the
 * body to 160 characters so callers never accidentally produce a
 * multi-part SMS (which costs 2× and can split mid-word). Truncation
 * uses a single-character ellipsis so we stay within 160 bytes of
 * 7-bit GSM characters.
 *
 * Returns the same shape as sendSms(); never throws. Missing phone
 * number → { ok: false, code: 'missing_to_or_body' } so calling
 * code can branch cleanly without a null-guard.
 */
export async function sendSMS(phoneNumber, message, { requestId = null } = {}) {
  if (!phoneNumber) return { ok: false, code: 'missing_to_or_body' };
  const body = truncateTo160(String(message == null ? '' : message));
  return sendSms({ to: phoneNumber, body, requestId });
}

function truncateTo160(s) {
  const MAX = 160;
  if (!s) return '';
  if (s.length <= MAX) return s;
  return `${s.slice(0, MAX - 1)}\u2026`;
}

export const _internal = Object.freeze({
  classifySmsError, maskPhone, canonicalizeTwilioEnv, truncateTo160,
});
