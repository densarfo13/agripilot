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
 *
 * validateSmsConfig() is called once at boot from server.js and
 * emits a one-line status summary + a warning per missing capability.
 * It never throws — the app still boots without SMS, only the SMS
 * features degrade to their manual/alternative fallbacks.
 */

export function isSmsMessagingConfigured() {
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
