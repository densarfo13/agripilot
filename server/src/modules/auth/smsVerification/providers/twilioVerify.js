/**
 * Twilio Verify provider (provider #1).
 *
 * Twilio Verify is a managed OTP service:
 *   • Twilio generates, sends, expires, and validates the code.
 *   • We never see or store the raw code.
 *   • Rate limits + fraud heuristics live on Twilio's side.
 *   • Supports SMS + Voice + WhatsApp + Email out of the box.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID       — account SID
 *   TWILIO_AUTH_TOKEN        — account auth token
 *   TWILIO_VERIFY_SERVICE_SID — the Verify "Service" SID (VA…)
 *
 * We dynamically import the `twilio` SDK so unit tests (and
 * deployments without the package) never blow up at module load.
 */

const SUPPORTED_CHANNELS = new Set(['sms', 'call', 'whatsapp']);

function readEnv() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken:  process.env.TWILIO_AUTH_TOKEN,
    serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
  };
}

async function getTwilioClient() {
  const { accountSid, authToken } = readEnv();
  if (!accountSid || !authToken) return null;
  try {
    const mod = await import('twilio');
    const factory = mod.default || mod;
    return factory(accountSid, authToken);
  } catch (err) {
    // Package not installed, or network import failed — caller
    // treats this as "provider unavailable" and surfaces the
    // generic "SMS verification unavailable" message.
    return null;
  }
}

export const twilioVerifyProvider = Object.freeze({
  name: 'twilio-verify',

  isConfigured() {
    const { accountSid, authToken, serviceSid } = readEnv();
    return !!(accountSid && authToken && serviceSid);
  },

  supportsChannel(ch) {
    return SUPPORTED_CHANNELS.has(String(ch || '').toLowerCase());
  },

  async startVerification({ to, channel = 'sms', locale }) {
    if (!to) return { ok: false, status: 'invalid', error: 'Missing `to`' };
    if (!this.isConfigured()) {
      return { ok: false, status: 'unconfigured', error: 'Twilio Verify not configured' };
    }
    if (!this.supportsChannel(channel)) {
      return { ok: false, status: 'invalid', error: `Unsupported channel: ${channel}` };
    }

    const client = await getTwilioClient();
    if (!client) {
      return { ok: false, status: 'unconfigured', error: 'Twilio client unavailable' };
    }
    const { serviceSid } = readEnv();

    try {
      const ch = String(channel).toLowerCase();
      const payload = { to, channel: ch };
      // Twilio Verify accepts a `locale` for templated SMS — pass
      // through when the caller sent one (e.g. fr, sw, ha).
      if (locale && typeof locale === 'string') payload.locale = locale.slice(0, 5);

      const verification = await client.verify.v2
        .services(serviceSid)
        .verifications
        .create(payload);

      return {
        ok: verification.status === 'pending',
        status: verification.status,   // 'pending' on success
        sid:    verification.sid,
      };
    } catch (err) {
      return { ok: false, status: 'error', error: err?.message || 'Twilio error' };
    }
  },

  async checkVerification({ to, code }) {
    if (!to || !code) return { ok: false, status: 'invalid', error: 'Missing to/code' };
    if (!this.isConfigured()) {
      return { ok: false, status: 'unconfigured', error: 'Twilio Verify not configured' };
    }

    const client = await getTwilioClient();
    if (!client) {
      return { ok: false, status: 'unconfigured', error: 'Twilio client unavailable' };
    }
    const { serviceSid } = readEnv();

    try {
      const check = await client.verify.v2
        .services(serviceSid)
        .verificationChecks
        .create({ to, code: String(code).trim() });

      return {
        ok:     check.status === 'approved',
        status: check.status,  // 'approved' | 'pending' | 'canceled' | 'max_attempts_reached'
        sid:    check.sid,
      };
    } catch (err) {
      // Twilio returns 404 when the code is wrong or the attempt
      // has already been consumed. We normalize that to `denied`
      // so callers don't have to read provider-specific error codes.
      const msg = err?.message || '';
      const is404 = err?.status === 404 || /not found/i.test(msg);
      if (is404) return { ok: false, status: 'denied', error: 'Invalid code' };
      return { ok: false, status: 'error', error: msg || 'Twilio error' };
    }
  },
});
