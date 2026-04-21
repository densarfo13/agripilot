/**
 * demoMode.js — single source of truth for "is this session a demo?"
 *
 * Demo mode is enabled when ANY of these are true:
 *   1. `?demo=1` in the URL query string
 *   2. `farroway.demoMode = '1'` in localStorage (sticky toggle)
 *   3. `VITE_DEMO_MODE === '1'` at build time (Vite env)
 *   4. The active session belongs to an allowed demo account
 *
 * A demo-mode session changes *only* these things:
 *   • admin nav is simplified (see src/lib/demo/adminNav.js)
 *   • MFA bypass is allowed for accounts in `DEMO_ALLOWED_EMAILS`
 *   • empty / error states render friendly copy instead of red banners
 *   • the seed helper populates the local store on first entry
 *
 * It never loosens server-side auth, never changes backend contracts,
 * and never affects non-demo users.
 */

// Build-time env flag — respects Vite (`import.meta.env.*`) first,
// falls back to process.env for server-side / test contexts.
function readEnvFlag() {
  try {
    // eslint-disable-next-line no-undef
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const v = import.meta.env.VITE_DEMO_MODE;
      if (v === '1' || v === 'true') return true;
    }
  } catch { /* fall through */ }
  if (typeof process !== 'undefined' && process.env) {
    const v = process.env.VITE_DEMO_MODE || process.env.DEMO_MODE;
    if (v === '1' || v === 'true') return true;
  }
  return false;
}

function readQueryFlag() {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('demo');
    return v === '1' || v === 'true';
  } catch { return false; }
}

function readStickyFlag() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem('farroway.demoMode') === '1';
  } catch { return false; }
}

/**
 * Allow-list of demo accounts. Kept intentionally tiny so production
 * credentials can never accidentally join. The MFA bypass in
 * `src/lib/demo/mfaBypass.js` cross-checks this list AND `isDemoMode()`
 * so neither flag alone is enough to skip MFA.
 */
export const DEMO_ALLOWED_EMAILS = Object.freeze([
  'demo@farroway.com',
  'demo-admin@farroway.com',
  'demo-ngo@farroway.com',
]);

const DEMO_EMAIL_SET = new Set(
  DEMO_ALLOWED_EMAILS.map((e) => String(e).toLowerCase()),
);

/** True iff the app is currently in demo mode. */
export function isDemoMode() {
  return readEnvFlag() || readQueryFlag() || readStickyFlag();
}

/** True iff `email` is an explicitly allow-listed demo account. */
export function isDemoAccount(email) {
  if (!email) return false;
  return DEMO_EMAIL_SET.has(String(email).trim().toLowerCase());
}

/**
 * Persist demo mode across page reloads / tab re-opens. Used by
 * operators hosting a live walk-through who want the `?demo=1` URL
 * to stick after a navigation.
 */
export function setDemoMode(enabled) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    if (enabled) window.localStorage.setItem('farroway.demoMode', '1');
    else         window.localStorage.removeItem('farroway.demoMode');
    return true;
  } catch { return false; }
}

export const _internal = Object.freeze({
  readEnvFlag, readQueryFlag, readStickyFlag, DEMO_EMAIL_SET,
});
