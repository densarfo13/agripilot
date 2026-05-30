/**
 * src/runtime/invites/InviteRuntime.ts — top-level facade.
 * Composes token + delivery services.
 *
 * Strict-rule audit
 *   • Pure facade. Never owns transport.
 *   • Frozen envelopes.
 *   • Audit hook: every invite event SHOULD be emitted via the
 *     canonical audit runtime; the facade exposes a hook so the
 *     server-side route can wire it in without coupling.
 *   • Single window global: __inviteHealth.
 */

import {
  INVITE_RUNTIME_VERSION,
  type InviteHealth,
} from './inviteContracts';
import {
  isEmailProviderConfigured,
} from './EmailInviteProvider';
import {
  isSMSProviderConfigured,
} from './SMSInviteProvider';
import {
  generateToken, hashToken, maskDestination,
} from './InviteTokenService';
import { deliverInvite, deliveryProvidersStatus } from './InviteDeliveryService';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function inviteHealth(): InviteHealth {
  return _safe(() => {
    const emailOk = isEmailProviderConfigured();
    const smsOk   = isSMSProviderConfigured();
    // tokenHashingReady — sanity: WebCrypto is available.
    const hashingReady =
      typeof crypto !== 'undefined' && !!(crypto as any).subtle;
    // activationFlowReady — gated on at least one provider OR a
    // mounted /activate route (server-side; reported via window).
    const activationReady = emailOk || smsOk;
    return Object.freeze({
      runtimeVersion:           INVITE_RUNTIME_VERSION,
      initialized:              true,
      emailProviderConfigured:  emailOk,
      smsProviderConfigured:    smsOk,
      tokenHashingReady:        hashingReady,
      activationFlowReady:      activationReady,
      fakeDelivery:             false,
    });
  }, Object.freeze({
    runtimeVersion:           INVITE_RUNTIME_VERSION,
    initialized:              false,
    emailProviderConfigured:  false,
    smsProviderConfigured:    false,
    tokenHashingReady:        false,
    activationFlowReady:      false,
    fakeDelivery:             false,
  }));
}

export function installInviteGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__inviteHealth !== 'function') {
      w.__inviteHealth = function () {
        const out = inviteHealth();
        try { console.log('[Farroway · Invites]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

// Re-export the surface external callers will consume.
export {
  generateToken, hashToken, maskDestination,
  deliverInvite, deliveryProvidersStatus,
  isEmailProviderConfigured, isSMSProviderConfigured,
};
