/**
 * whatsAppService.js — Twilio WhatsApp Messages wrapper.
 *
 *   sendWhatsApp(to, message, { requestId? })
 *     → { ok: true,  code: 'ok', messageSid }
 *     → { ok: false, code: 'not_configured' | 'missing_to_or_body' |
 *                          'recipient_invalid' | 'provider_error' |
 *                          'auth_failed' | 'network_error' | 'region_blocked',
 *         details?: string }
 *
 * Never throws. Callers (notification dispatcher, channel router)
 * branch on `ok` and either fall through to the next channel (SMS,
 * in_app) or surface a calm message to ops.
 *
 * Env vars (spec §3):
 *   TWILIO_ACCOUNT_SID   (or short-form TWILIO_SID)
 *   TWILIO_AUTH_TOKEN    (or short-form TWILIO_TOKEN)
 *   TWILIO_WHATSAPP_FROM (or short-form TWILIO_WHATSAPP, must include
 *                         the `whatsapp:` prefix; we add it if missing)
 *
 * We intentionally share the SID/token with the SMS Messages API —
 * Twilio uses one auth pair for both channels. The "from" number is
 * separate because sandbox and production WhatsApp senders are
 * distinct from the farmer-facing SMS number.
 */

function canonicalizeWhatsAppEnv() {
  if (!process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_SID) {
    process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_SID;
  }
  if (!process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_TOKEN) {
    process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_TOKEN;
  }
  if (!process.env.TWILIO_WHATSAPP_FROM && process.env.TWILIO_WHATSAPP) {
    process.env.TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP;
  }
}
canonicalizeWhatsAppEnv();

export function isWhatsAppConfigured() {
  canonicalizeWhatsAppEnv();
  return !!(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_WHATSAPP_FROM
  );
}

function ensureWhatsAppPrefix(number) {
  if (!number) return null;
  const s = String(number).trim();
  return s.startsWith('whatsapp:') ? s : `whatsapp:${s}`;
}

function maskPhone(raw) {
  const s = String(raw || '');
  if (s.length <= 4) return s;
  return s.slice(0, 1) + '*'.repeat(Math.max(0, s.length - 5)) + s.slice(-4);
}

// Twilio client is lazily loaded; the app starts fine without the
// SDK installed and WhatsApp simply returns { ok:false, code:'not_configured' }.
let _client = null;
let _clientKey = null;
async function getTwilioClient() {
  if (!isWhatsAppConfigured()) return null;
  const key = `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`;
  if (_client && _clientKey === key) return _client;
  try {
    const mod = await import('twilio');
    const twilio = mod.default || mod;
    _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    _clientKey = key;
    return _client;
  } catch (err) {
    console.error('[whatsapp] twilio module not installed — run `npm i twilio`',
      err && err.message);
    return null;
  }
}

function classifyError(err) {
  const code = err && err.code;
  const msg  = String(err && err.message ? err.message : '').toLowerCase();
  if (code === 21211 || msg.includes('not a valid phone')) {
    return { code: 'recipient_invalid', details: 'WhatsApp recipient rejected.' };
  }
  if (code === 63007 || msg.includes('whatsapp')) {
    // Twilio WA-specific: recipient not in WhatsApp sandbox, or template
    // required outside 24h window. Treat as recipient_invalid for v1.
    return { code: 'recipient_invalid',
             details: 'WhatsApp channel unavailable for this recipient.' };
  }
  if (code === 21408 || msg.includes('permission to send')) {
    return { code: 'region_blocked', details: 'WhatsApp region not enabled.' };
  }
  if (code === 20003 || msg.includes('authenticate')) {
    return { code: 'auth_failed', details: 'Twilio credentials rejected.' };
  }
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('econn')) {
    return { code: 'network_error', details: 'Could not reach Twilio.' };
  }
  return {
    code: 'provider_error',
    details: String(err && err.message ? err.message : 'Unknown Twilio error').slice(0, 240),
  };
}

/**
 * sendWhatsApp(to, message, { requestId? })
 *   WhatsApp allows longer bodies than SMS (≤1024 chars via Twilio),
 *   but we clamp to 640 chars to keep the farmer's screen readable
 *   and stay well within any template limits. Any longer input is
 *   truncated with a single-char ellipsis — no silent split.
 */
export async function sendWhatsApp(to, message, { requestId = null } = {}) {
  const tag = requestId ? `[wa:${requestId}]` : '[wa]';
  if (!to || !message) {
    console.warn(`${tag} refusing to send — missing to/message`);
    return { ok: false, code: 'missing_to_or_body' };
  }
  // B6 — E.164 sanity check before we burn a Twilio API call. The
  // dispatcher's fallback chain treats `recipient_invalid` as a
  // skip-this-channel signal, so failing fast here saves a network
  // round-trip and a potential billing event for an obviously bad
  // number. Strip the `whatsapp:` prefix + any non-digits, then
  // require 8–15 digits (E.164 minimum is 8, max is 15).
  const digits = String(to).replace(/^whatsapp:/i, '').replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) {
    console.warn(`${tag} refusing to send — bad recipient format to=${maskPhone(to)}`);
    return { ok: false, code: 'recipient_invalid',
      details: 'Recipient phone is not a valid E.164 number.' };
  }
  if (!isWhatsAppConfigured()) {
    return {
      ok: false, code: 'not_configured',
      details: 'Twilio WhatsApp is not configured.',
    };
  }
  const client = await getTwilioClient();
  if (!client) {
    return { ok: false, code: 'not_configured', details: 'twilio SDK unavailable.' };
  }
  const body = truncateTo640(String(message));
  const toWa   = ensureWhatsAppPrefix(to);
  const fromWa = ensureWhatsAppPrefix(process.env.TWILIO_WHATSAPP_FROM);
  try {
    console.log(`${tag} sending to=${maskPhone(to)} len=${body.length}`);
    const msg = await client.messages.create({
      body, from: fromWa, to: toWa,
    });
    console.log(`${tag} accepted sid=${msg.sid} status=${msg.status || '?'}`);
    return { ok: true, code: 'ok', messageSid: msg.sid };
  } catch (err) {
    const { code, details } = classifyError(err);
    console.error(`${tag} failed code=${code} to=${maskPhone(to)} details=${details}`);
    return { ok: false, code, details };
  }
}

function truncateTo640(s) {
  const MAX = 640;
  if (!s) return '';
  if (s.length <= MAX) return s;
  return `${s.slice(0, MAX - 1)}\u2026`;
}

export const _internal = Object.freeze({
  canonicalizeWhatsAppEnv, ensureWhatsAppPrefix, classifyError,
  maskPhone, truncateTo640,
});
