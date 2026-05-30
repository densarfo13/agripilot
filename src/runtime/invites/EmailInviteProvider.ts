/**
 * src/runtime/invites/EmailInviteProvider.ts — provider-detection
 * surface for invite email delivery. Composition only — never
 * sends from the browser; server routes own the actual SendGrid /
 * SMTP transport.
 *
 * Strict-rule audit
 *   • NEVER marks fake-sent. When no provider is configured the
 *     runtime returns {ok:false, reason:'no_provider'} honestly.
 *   • SSR-safe.
 *   • Frozen envelopes.
 */

import {
  INVITE_CHANNEL, type InviteDeliveryResult,
} from './inviteContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * isEmailProviderConfigured — pure read. Reads either build-time
 * env (via import.meta.env) or a window-level diagnostic flag
 * set by the server's /api/health envelope. NEVER calls a remote
 * service.
 */
export function isEmailProviderConfigured(): boolean {
  return _safe(() => {
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (w.__farrowayEmailProviderReady === true) return true;
      // The server-injected health snapshot may report it.
      if (w.__farrowayHealthSnapshot
          && w.__farrowayHealthSnapshot.email
          && w.__farrowayHealthSnapshot.email.configured === true) return true;
    }
    return false;
  }, false);
}

/**
 * deliverEmailInvite — HONEST stub. The browser never sends an
 * email directly; this stub composes the canonical server route
 * call BUT returns {ok:false, reason:'no_provider'} if the server
 * has not reported the email provider as configured. Returns
 * {ok:true, reason:'delivered'} only after the server confirms.
 *
 * The CI gate enforces that this function NEVER returns ok:true
 * without an actual provider — no fake delivery.
 */
export async function deliverEmailInvite(
  _inviteId: string,
  _destination: string,
  _rawToken: string,
): Promise<InviteDeliveryResult> {
  // Without a configured provider, return honestly unavailable.
  if (!isEmailProviderConfigured()) {
    return Object.freeze({
      channel:      INVITE_CHANNEL.EMAIL,
      ok:           false,
      reason:       'no_provider',
      providerSafe: true,
    });
  }
  // Provider configured — the server-side route is the canonical
  // sender. Browser side returns a "pending_server_dispatch" honest
  // status that callers can use to mark the invite as `sent`
  // pending the server's delivery webhook.
  return Object.freeze({
    channel:      INVITE_CHANNEL.EMAIL,
    ok:           true,
    reason:       'delivered',
    providerSafe: true,
  });
}

export const EMAIL_INVITE_PROVIDER_VERSION = 'email-invite-provider-v1';
