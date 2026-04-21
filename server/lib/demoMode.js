/**
 * demoMode.js (server) — mirrors the client-side allow-list so MFA
 * and dev-only fallbacks have a single source of truth.
 *
 * Server demo mode is enabled when:
 *   1. `process.env.DEMO_MODE` is '1' / 'true', OR
 *   2. `NODE_ENV !== 'production'` (dev + staging always get demo
 *      affordances; prod doesn't)
 *
 * A demo-mode server changes only these things:
 *   • forgot-password handler echoes the reset link to the log
 *     (never to an HTTP response body)
 *   • requireMfa middleware allows bypass for accounts in
 *     DEMO_ALLOWED_EMAILS (see server/src/middleware/requireMfa.js)
 *
 * It never loosens auth for non-demo users, never exposes secrets
 * to the UI, and never affects real accounts.
 */

export const DEMO_ALLOWED_EMAILS = Object.freeze([
  'demo@farroway.com',
  'demo-admin@farroway.com',
  'demo-ngo@farroway.com',
]);

const DEMO_EMAIL_SET = new Set(
  DEMO_ALLOWED_EMAILS.map((e) => String(e).toLowerCase()),
);

/**
 * isDemoMode — true iff DEMO_MODE is explicitly set OR the server
 * is running in a non-production environment. Gated by env only —
 * no user data, no DB lookups.
 */
export function isDemoMode() {
  if (process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true') return true;
  return String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
}

/**
 * isDemoAccount — true iff the email is on the allow-list. Works
 * independently of isDemoMode so caller can require BOTH before
 * bypassing any security gate:
 *
 *   if (isDemoMode() && isDemoAccount(user.email)) { …allow… }
 */
export function isDemoAccount(email) {
  if (!email) return false;
  return DEMO_EMAIL_SET.has(String(email).trim().toLowerCase());
}

export const _internal = Object.freeze({ DEMO_EMAIL_SET });
