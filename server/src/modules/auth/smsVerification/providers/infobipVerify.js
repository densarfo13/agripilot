/**
 * Infobip 2FA provider — scaffold (not yet implemented).
 *
 * To activate:
 *   1. npm install @infobip-api/sdk
 *   2. Set env:
 *        INFOBIP_BASE_URL             (e.g. https://xxx.api.infobip.com)
 *        INFOBIP_API_KEY
 *        INFOBIP_2FA_APPLICATION_ID
 *        INFOBIP_2FA_MESSAGE_ID
 *   3. Implement:
 *        startVerification   → POST /2fa/2/pin/{templateId}/send
 *        checkVerification   → POST /2fa/2/pin/{pinId}/verify
 *
 * Same contract as the other providers — service.js never changes
 * when this file is filled in.
 */

const SUPPORTED_CHANNELS = new Set(['sms', 'whatsapp', 'voice']);

function readEnv() {
  return {
    baseUrl:   process.env.INFOBIP_BASE_URL,
    apiKey:    process.env.INFOBIP_API_KEY,
    appId:     process.env.INFOBIP_2FA_APPLICATION_ID,
    messageId: process.env.INFOBIP_2FA_MESSAGE_ID,
  };
}

export const infobipVerifyProvider = Object.freeze({
  name: 'infobip-verify',

  isConfigured() {
    const { baseUrl, apiKey, appId, messageId } = readEnv();
    return !!(baseUrl && apiKey && appId && messageId);
  },

  supportsChannel(ch) {
    return SUPPORTED_CHANNELS.has(String(ch || '').toLowerCase());
  },

  async startVerification(_params) {
    return {
      ok: false,
      status: 'unconfigured',
      error: 'Infobip 2FA provider not yet implemented. See provider file for activation steps.',
    };
  },

  async checkVerification(_params) {
    return {
      ok: false,
      status: 'unconfigured',
      error: 'Infobip 2FA provider not yet implemented. See provider file for activation steps.',
    };
  },
});
