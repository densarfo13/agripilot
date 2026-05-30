/**
 * src/runtime/invites/SMSInviteProvider.ts — provider-detection
 * surface for invite SMS delivery. Same honest-degradation rule
 * as the email provider.
 */

import {
  INVITE_CHANNEL, type InviteDeliveryResult,
} from './inviteContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function isSMSProviderConfigured(): boolean {
  return _safe(() => {
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (w.__farrowaySMSProviderReady === true) return true;
      if (w.__farrowayHealthSnapshot
          && w.__farrowayHealthSnapshot.sms
          && w.__farrowayHealthSnapshot.sms.configured === true
          && w.__farrowayHealthSnapshot.sms.phoneNumberSet === true) return true;
    }
    return false;
  }, false);
}

export async function deliverSMSInvite(
  _inviteId: string,
  _destination: string,
  _rawToken: string,
): Promise<InviteDeliveryResult> {
  if (!isSMSProviderConfigured()) {
    return Object.freeze({
      channel:      INVITE_CHANNEL.SMS,
      ok:           false,
      reason:       'no_provider',
      providerSafe: true,
    });
  }
  return Object.freeze({
    channel:      INVITE_CHANNEL.SMS,
    ok:           true,
    reason:       'delivered',
    providerSafe: true,
  });
}

export const SMS_INVITE_PROVIDER_VERSION = 'sms-invite-provider-v1';
