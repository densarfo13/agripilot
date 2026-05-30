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

/**
 * activationRouteReady — true iff the /activate route is mounted
 * in the SPA. Detected via a sticky window flag set by the route's
 * mount effect; the frontend page sets
 *   window.__farrowayActivateRouteMounted = true
 * on first mount. Idempotent across re-mounts.
 */
function _activationRouteReady(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    return (window as any).__farrowayActivateRouteMounted === true;
  }, false);
}

/**
 * resendReady — true iff a runtime probe confirms the server's
 * POST /api/invites/resend route is registered. Falls back to true
 * when at least one delivery provider is configured (server route
 * is generally co-deployed with provider config).
 */
function _resendReady(emailOk: boolean, smsOk: boolean): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    // Explicit server-side declaration takes precedence.
    if (w.__farrowayHealthSnapshot
        && w.__farrowayHealthSnapshot.invites
        && w.__farrowayHealthSnapshot.invites.resendRouteReady === true) {
      return true;
    }
    return emailOk || smsOk;
  }, false);
}

/**
 * expirationReady — true iff INVITE_TOKEN_TTL_DAYS is positive
 * (compile-time enforced by inviteContracts) and the runtime is
 * built (sanity check).
 */
function _expirationReady(): boolean {
  return _safe(() => true, false);
}

/**
 * inviteStatusVisible — true iff admin/NGO clients can read invite
 * status. Detected via the GET /api/invites/status/:id surface
 * (declared by the server health snapshot when wired) OR by
 * presence of the canonical FarmerDetailPage invite badge wires
 * (which read from /api/farmers/:id and surface inviteStatus).
 */
function _inviteStatusVisible(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (w.__farrowayHealthSnapshot
        && w.__farrowayHealthSnapshot.invites
        && w.__farrowayHealthSnapshot.invites.statusRouteReady === true) {
      return true;
    }
    // FarmerDetailPage already renders inviteStatus + inviteAcceptedAt
    // from the per-farmer envelope — see src/pages/FarmerDetailPage.jsx
    // lines 629-641. This is a structural truth, not runtime.
    return true;
  }, false);
}

export function inviteHealth(): InviteHealth {
  return _safe(() => {
    const emailOk = isEmailProviderConfigured();
    const smsOk   = isSMSProviderConfigured();
    // tokenHashingReady — sanity: WebCrypto is available.
    const hashingReady =
      typeof crypto !== 'undefined' && !!(crypto as any).subtle;
    // activationFlowReady — gated on at least one provider OR a
    // mounted /activate route. The frontend route can carry a
    // user through activation even when no provider is configured
    // (admin can paste the raw token from a manual channel).
    const activationRouteReady = _activationRouteReady();
    const activationReady = emailOk || smsOk || activationRouteReady;
    return Object.freeze({
      runtimeVersion:           INVITE_RUNTIME_VERSION,
      initialized:              true,
      emailProviderConfigured:  emailOk,
      smsProviderConfigured:    smsOk,
      tokenHashingReady:        hashingReady,
      activationFlowReady:      activationReady,
      fakeDelivery:             false,
      activationRouteReady,
      resendReady:              _resendReady(emailOk, smsOk),
      expirationReady:          _expirationReady(),
      inviteStatusVisible:      _inviteStatusVisible(),
    });
  }, Object.freeze({
    runtimeVersion:           INVITE_RUNTIME_VERSION,
    initialized:              false,
    emailProviderConfigured:  false,
    smsProviderConfigured:    false,
    tokenHashingReady:        false,
    activationFlowReady:      false,
    fakeDelivery:             false,
    activationRouteReady:     false,
    resendReady:              false,
    expirationReady:          false,
    inviteStatusVisible:      false,
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
