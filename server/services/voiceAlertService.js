/**
 * voiceAlertService.js — Twilio Voice call wrapper that speaks a
 * short message via TwiML <Say>.
 *
 *   sendVoiceAlert(to, message, language?, { requestId? })
 *     → { ok: true,  code: 'ok', callSid }
 *     → { ok: false, code: 'not_configured' | 'missing_to_or_body' |
 *                          'recipient_invalid' | 'auth_failed' |
 *                          'region_blocked' | 'provider_error' |
 *                          'network_error',
 *         details?: string }
 *
 * Never throws. For low-connectivity + low-literacy farmers we keep
 * the call short (one Say, no menus) and let Twilio's TTS engine
 * speak the message in the farmer's preferred language. If Twilio
 * can't speak that language, we fall back to en-US.
 *
 * Env vars:
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN  (or TWILIO_SID / TWILIO_TOKEN)
 *   TWILIO_VOICE_FROM  (or TWILIO_VOICE_NUMBER or TWILIO_PHONE_NUMBER)
 */

function canonicalizeVoiceEnv() {
  if (!process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_SID) {
    process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_SID;
  }
  if (!process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_TOKEN) {
    process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_TOKEN;
  }
  if (!process.env.TWILIO_VOICE_FROM) {
    process.env.TWILIO_VOICE_FROM =
         process.env.TWILIO_VOICE_NUMBER
      || process.env.TWILIO_PHONE_NUMBER
      || process.env.TWILIO_PHONE
      || null;
  }
}
canonicalizeVoiceEnv();

export function isVoiceConfigured() {
  canonicalizeVoiceEnv();
  return !!(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_VOICE_FROM
  );
}

// Twilio <Say> supported language codes — short list we commit to.
// Unknown requests fall back to en-US. Hindi doesn't have native
// Twilio TTS yet so we ship it as en-IN (accent closer to Hindi
// farmers than en-US) and let the translation system handle the
// text. Not perfect, but avoids a hard failure.
const VOICE_LANG_MAP = Object.freeze({
  en: 'en-US',
  fr: 'fr-FR',
  sw: 'en-US',     // Twilio TTS can't speak Swahili — en-US closest
  ha: 'en-US',     // same for Hausa
  tw: 'en-US',     // same for Twi
  hi: 'en-IN',     // en-IN accent closer to Hindi audience
});

function normalizeLanguage(lang) {
  if (!lang) return 'en-US';
  const s = String(lang).toLowerCase();
  if (VOICE_LANG_MAP[s]) return VOICE_LANG_MAP[s];
  // Accept already-formatted BCP47 tags (en-US, fr-FR).
  if (/^[a-z]{2}-[A-Z]{2}$/.test(lang)) return lang;
  return 'en-US';
}

// Hard cap on a voice message — beyond this it starts to feel like a
// sermon. Twilio <Say> supports way more, but long calls eat costs.
const MAX_VOICE_CHARS = 240;

function truncateForVoice(s) {
  if (!s) return '';
  const str = String(s).trim();
  if (str.length <= MAX_VOICE_CHARS) return str;
  // Try to cut on a sentence boundary so the call doesn't end
  // mid-word. Find last sentence terminator before the cap.
  const slice = str.slice(0, MAX_VOICE_CHARS);
  const m = slice.match(/[.!?\u3002\uFF01\uFF1F][^.!?\u3002\uFF01\uFF1F]*$/);
  if (m && m.index > 40) return slice.slice(0, m.index + 1).trim();
  return `${slice.slice(0, MAX_VOICE_CHARS - 1).trim()}\u2026`;
}

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * buildTwiml(message, language)
 *   Emits a single-<Say> TwiML document. Exported so the backend
 *   webhook that Twilio calls back for live calls can reuse it.
 */
export function buildTwiml(message, language = 'en-US') {
  const lang = normalizeLanguage(language);
  const safe = escapeXml(truncateForVoice(message));
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<Response><Say language="${lang}">${safe}</Say></Response>`;
}

function maskPhone(raw) {
  const s = String(raw || '');
  if (s.length <= 4) return s;
  return s.slice(0, 1) + '*'.repeat(Math.max(0, s.length - 5)) + s.slice(-4);
}

let _client = null;
let _clientKey = null;
async function getTwilioClient() {
  if (!isVoiceConfigured()) return null;
  const key = `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`;
  if (_client && _clientKey === key) return _client;
  try {
    const mod = await import('twilio');
    const twilio = mod.default || mod;
    _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    _clientKey = key;
    return _client;
  } catch (err) {
    console.error('[voice] twilio module not installed — run `npm i twilio`',
      err && err.message);
    return null;
  }
}

function classifyError(err) {
  const code = err && err.code;
  const msg  = String(err && err.message ? err.message : '').toLowerCase();
  if (code === 21211 || msg.includes('not a valid phone')) {
    return { code: 'recipient_invalid', details: 'Recipient number rejected.' };
  }
  if (code === 21408 || msg.includes('permission to dial')) {
    return { code: 'region_blocked', details: 'Voice region not enabled on Twilio.' };
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
 * sendVoiceAlert(to, message, language?, { requestId? })
 *   Places an outbound call that speaks `message` in the nearest
 *   supported language. Uses inline TwiML (no webhook required).
 */
export async function sendVoiceAlert(to, message, language = 'en', { requestId = null } = {}) {
  const tag = requestId ? `[voice:${requestId}]` : '[voice]';
  if (!to || !message) {
    console.warn(`${tag} refusing to call — missing to/message`);
    return { ok: false, code: 'missing_to_or_body' };
  }
  if (!isVoiceConfigured()) {
    return {
      ok: false, code: 'not_configured',
      details: 'Twilio Voice is not configured.',
    };
  }
  const client = await getTwilioClient();
  if (!client) {
    return { ok: false, code: 'not_configured', details: 'twilio SDK unavailable.' };
  }
  const twiml = buildTwiml(message, language);
  try {
    console.log(`${tag} calling to=${maskPhone(to)} lang=${normalizeLanguage(language)}`);
    const call = await client.calls.create({
      twiml,
      from: process.env.TWILIO_VOICE_FROM,
      to,
    });
    console.log(`${tag} accepted sid=${call.sid} status=${call.status || '?'}`);
    return { ok: true, code: 'ok', callSid: call.sid };
  } catch (err) {
    const { code, details } = classifyError(err);
    console.error(`${tag} failed code=${code} to=${maskPhone(to)} details=${details}`);
    return { ok: false, code, details };
  }
}

/**
 * buildVoiceMessage(alert, language)
 *   Turns a spec-shape insight/notification into voice-safe copy.
 *   Rules:
 *     • simplify vs dashboard copy — drop emoji + symbols
 *     • avoid abbreviations (kg → kilograms)
 *     • crop names spoken naturally
 *     • use translated message when available (caller already has
 *       the translation tables); we accept a pre-translated string
 *       and just clean it up. If the caller passes the structured
 *       insight object, we use fallbackMessage + recommendedAction
 *       joined into a short spoken line.
 *     • if translation missing, fallback to English safely.
 */
export function buildVoiceMessage(alert, language = 'en') {
  if (!alert) return '';
  let text;
  if (typeof alert === 'string') {
    text = alert;
  } else if (typeof alert === 'object') {
    // Prefer a pre-translated message field the caller has already
    // resolved via the i18n system; otherwise fall back to the
    // structured English copy the insight engine always carries.
    text = alert.spokenMessage
        || alert.translatedMessage
        || alert.message
        || alert.fallbackMessage
        || '';
    const action = alert.spokenAction
        || alert.translatedAction
        || alert.recommendedAction
        || '';
    if (action && !text.toLowerCase().includes(action.toLowerCase())) {
      text = text ? `${text}. ${action}` : action;
    }
  } else {
    text = String(alert || '');
  }
  return cleanForSpeech(text);
}

function cleanForSpeech(s) {
  if (!s) return '';
  const out = String(s)
    // Strip common emoji ranges so the TTS doesn't say "exclamation
    // mark exclamation mark". Keep punctuation that aids prosody.
    .replace(/[\u2600-\u27BF\uD83C-\uD83E][\uD000-\uDFFF]?/g, '')
    .replace(/[\u23F1\u23F0\u23F3\u26A0\uFE0F]/g, '')
    // Expand a few critical abbreviations so TTS reads them clearly.
    .replace(/\bkg\b/gi, 'kilograms')
    .replace(/\bha\b/g, 'hectares')
    .replace(/\bsqm\b/gi, 'square meters')
    .replace(/\bm2\b/gi, 'square meters')
    .replace(/\bGHS\b/g, 'Ghana Cedis')
    .replace(/\bNGN\b/g, 'Nigerian Naira')
    .replace(/\bKES\b/g, 'Kenyan Shillings')
    .replace(/\bINR\b/g, 'Indian Rupees')
    .replace(/\bUSD\b/g, 'US dollars')
    // Replace arrow-style CTA markers with a short pause.
    .replace(/[\u2192\u279C]/g, '. ')
    // Collapse whitespace so the call doesn't gasp.
    .replace(/\s+/g, ' ')
    .trim();
  return truncateForVoice(out);
}

export const _internal = Object.freeze({
  canonicalizeVoiceEnv, normalizeLanguage, truncateForVoice, escapeXml,
  cleanForSpeech, classifyError, maskPhone, VOICE_LANG_MAP,
});
