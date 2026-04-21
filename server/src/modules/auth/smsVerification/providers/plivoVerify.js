/**
 * Plivo Verify provider — scaffold (not yet implemented).
 *
 * To activate:
 *   1. npm install plivo
 *   2. Set env:
 *        PLIVO_AUTH_ID
 *        PLIVO_AUTH_TOKEN
 *        PLIVO_VERIFY_APP_UUID
 *   3. Replace the two `Not implemented` returns below with real
 *      Plivo Verify API calls (they map 1:1 to Twilio Verify:
 *      startVerification → Session.create,
 *      checkVerification → Session.validate).
 *
 * The provider interface (`isConfigured`, `supportsChannel`,
 * `startVerification`, `checkVerification`) is the contract —
 * keep the shapes identical so `service.js` never needs to change.
 */

const SUPPORTED_CHANNELS = new Set(['sms', 'call']);

function readEnv() {
  return {
    authId:     process.env.PLIVO_AUTH_ID,
    authToken:  process.env.PLIVO_AUTH_TOKEN,
    appUuid:    process.env.PLIVO_VERIFY_APP_UUID,
  };
}

export const plivoVerifyProvider = Object.freeze({
  name: 'plivo-verify',

  isConfigured() {
    const { authId, authToken, appUuid } = readEnv();
    return !!(authId && authToken && appUuid);
  },

  supportsChannel(ch) {
    return SUPPORTED_CHANNELS.has(String(ch || '').toLowerCase());
  },

  async startVerification(_params) {
    return {
      ok: false,
      status: 'unconfigured',
      error: 'Plivo Verify provider not yet implemented. See provider file for activation steps.',
    };
  },

  async checkVerification(_params) {
    return {
      ok: false,
      status: 'unconfigured',
      error: 'Plivo Verify provider not yet implemented. See provider file for activation steps.',
    };
  },
});
