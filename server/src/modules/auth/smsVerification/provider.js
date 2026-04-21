/**
 * SmsVerificationProvider — interface + active-provider selector.
 *
 * Every concrete provider (Twilio Verify, Plivo Verify, Infobip
 * 2FA, etc.) exposes the same tiny surface:
 *
 *   {
 *     name: 'twilio-verify' | 'plivo-verify' | 'infobip-verify',
 *     isConfigured(): boolean,
 *     supportsChannel(ch: 'sms'|'whatsapp'|'call'): boolean,
 *     startVerification({ to, channel, locale? })
 *       → Promise<{ ok: boolean, status: string, sid?: string, error?: string }>,
 *     checkVerification({ to, code })
 *       → Promise<{ ok: boolean, status: 'approved'|'pending'|'denied'|'error',
 *                    sid?: string, error?: string }>,
 *   }
 *
 * The business-logic layer (`service.js`) only talks to this shape,
 * so adding a new provider is: drop a file under `providers/`,
 * register it in `ALL_PROVIDERS`, set `SMS_VERIFY_PROVIDER=<name>`
 * in env. No callers change.
 *
 * Verification state (code value, attempts, expiry) is ALWAYS kept
 * on the provider side — we never store raw OTP codes locally. This
 * is the main reason we use provider-managed services (Verify) over
 * a DIY OTP table.
 */

import { twilioVerifyProvider }  from './providers/twilioVerify.js';
import { plivoVerifyProvider }   from './providers/plivoVerify.js';
import { infobipVerifyProvider } from './providers/infobipVerify.js';

const ALL_PROVIDERS = Object.freeze({
  'twilio-verify':   twilioVerifyProvider,
  'plivo-verify':    plivoVerifyProvider,
  'infobip-verify':  infobipVerifyProvider,
});

/**
 * Pick the active provider based on env:
 *   SMS_VERIFY_PROVIDER=twilio-verify   (default)
 *
 * If the named provider isn't configured we DO NOT silently fall
 * back to another one — auth recovery has to be explicit or not
 * available at all. The caller handles the "unavailable" branch.
 */
export function getActiveSmsVerificationProvider({ envSnapshot = process.env } = {}) {
  const picked = String(envSnapshot.SMS_VERIFY_PROVIDER || 'twilio-verify').trim();
  const provider = ALL_PROVIDERS[picked];
  if (!provider) {
    return {
      name: picked,
      isConfigured: () => false,
      supportsChannel: () => false,
      startVerification: async () => ({
        ok: false, status: 'unconfigured',
        error: `Unknown SMS verification provider: ${picked}`,
      }),
      checkVerification: async () => ({
        ok: false, status: 'unconfigured',
        error: `Unknown SMS verification provider: ${picked}`,
      }),
    };
  }
  return provider;
}

export { ALL_PROVIDERS };
