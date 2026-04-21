/**
 * mfaBypass.js — MFA bypass gate for demo accounts only.
 *
 * Contract (deliberately narrow):
 *   shouldBypassMfa(email) → true IFF
 *     • `isDemoMode()` is true AND
 *     • `isDemoAccount(email)` returns true (allow-list in
 *       src/config/demoMode.js)
 *
 * Either condition alone is insufficient. This means:
 *   • a real admin visiting `?demo=1` does NOT bypass MFA
 *   • a demo account outside demo mode does NOT bypass MFA
 *
 * Server-side auth (`server/src/modules/auth/service.js` +
 * `modules/mfa/service.js`) is UNCHANGED — this gate only
 * suppresses the blocking client-side MFA banner during demo
 * walk-throughs. The server still enforces MFA on any sensitive
 * endpoint per role.
 */

import { isDemoMode, isDemoAccount } from '../../config/demoMode.js';

/** Returns true only for allow-listed demo accounts in demo mode. */
export function shouldBypassMfa(email) {
  if (!isDemoMode()) return false;
  if (!isDemoAccount(email)) return false;
  return true;
}

/**
 * suppressMfaBanner — convenience for UI code that would otherwise
 * render a blocking MFA banner. Call this where the banner is
 * currently unconditional:
 *
 *   if (suppressMfaBanner(currentUser.email)) return null;
 *
 * Non-demo paths fall through and render the banner as before.
 */
export function suppressMfaBanner(email) {
  return shouldBypassMfa(email);
}

export const _internal = Object.freeze({ shouldBypassMfa });
