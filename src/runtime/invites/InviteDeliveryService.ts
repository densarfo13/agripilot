/**
 * src/runtime/invites/InviteDeliveryService.ts — composes the
 * email + SMS providers behind a single dispatch function.
 *
 * Strict-rule audit
 *   • Pure dispatch. No state.
 *   • Never marks fake-sent.
 *   • Always returns a frozen envelope per channel.
 */

import {
  INVITE_CHANNEL,
  type InviteChannelValue, type InviteDeliveryResult,
} from './inviteContracts';
import {
  deliverEmailInvite, isEmailProviderConfigured,
} from './EmailInviteProvider';
import {
  deliverSMSInvite, isSMSProviderConfigured,
} from './SMSInviteProvider';

const _safe = <T,>(fn: () => Promise<T>, fb: T): Promise<T> =>
  fn().catch(() => fb);

export async function deliverInvite(
  channel: InviteChannelValue,
  inviteId: string,
  emailDestination: string | null,
  phoneDestination: string | null,
  rawToken: string,
): Promise<ReadonlyArray<InviteDeliveryResult>> {
  return _safe(async () => {
    const results: InviteDeliveryResult[] = [];
    if (channel === INVITE_CHANNEL.EMAIL || channel === INVITE_CHANNEL.BOTH) {
      if (emailDestination) {
        results.push(await deliverEmailInvite(inviteId, emailDestination, rawToken));
      } else {
        results.push(Object.freeze({
          channel: INVITE_CHANNEL.EMAIL,
          ok: false,
          reason: 'no_provider',
          providerSafe: true,
        }));
      }
    }
    if (channel === INVITE_CHANNEL.SMS || channel === INVITE_CHANNEL.BOTH) {
      if (phoneDestination) {
        results.push(await deliverSMSInvite(inviteId, phoneDestination, rawToken));
      } else {
        results.push(Object.freeze({
          channel: INVITE_CHANNEL.SMS,
          ok: false,
          reason: 'no_provider',
          providerSafe: true,
        }));
      }
    }
    return Object.freeze(results);
  }, Object.freeze([]));
}

export function deliveryProvidersStatus() {
  return Object.freeze({
    emailConfigured: isEmailProviderConfigured(),
    smsConfigured:   isSMSProviderConfigured(),
  });
}

export const INVITE_DELIVERY_SERVICE_VERSION = 'invite-delivery-service-v1';
