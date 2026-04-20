/**
 * returnToStorage.js — intended-destination memory that
 * survives a full page reload.
 *
 * Problem it solves: React Router's `location.state.from`
 * vanishes the moment the browser reloads or the app
 * redirects through a third-party auth step. Users trying
 * to reach /admin/users end up on /dashboard after login
 * because the "from" was dropped.
 *
 * Contract:
 *   saveReturnTo(path)     — write one path to sessionStorage
 *   peekReturnTo()         — read without clearing
 *   consumeReturnTo()      — read and clear in one call
 *   clearReturnTo()        — just clear
 *
 * Why sessionStorage, not localStorage:
 *   • The pending destination is per-tab and short-lived.
 *   • sessionStorage is automatically wiped when the tab
 *     closes — we don't want a stale admin URL pulling a
 *     fresh login back into an old page a week later.
 *
 * Safety rules:
 *   • Only whitelisted in-app paths are stored (must start
 *     with "/" and not contain "://" — blocks open-redirect
 *     into any external origin).
 *   • "/login", "/register", "/verify-email", "/reset-password"
 *     are never stored — those are auth surfaces themselves.
 *   • Degrades cleanly when sessionStorage is unavailable
 *     (Safari private mode, SSR, old WebView).
 */

const KEY = 'farroway.auth.returnTo.v1';

/** Paths that should never be set as a return destination. */
const AUTH_SURFACES = new Set([
  '/login',
  '/register',
  '/verify-email',
  '/verify-otp',
  '/forgot-password',
  '/reset-password',
  '/farmer-welcome',
]);

function hasStorage() {
  try {
    return typeof window !== 'undefined' && !!window.sessionStorage;
  } catch { return false; }
}

/**
 * isSafeReturnPath — only relative in-app paths pass.
 * Returns false for anything that could open-redirect.
 */
export function isSafeReturnPath(p) {
  if (!p || typeof p !== 'string') return false;
  if (!p.startsWith('/')) return false;
  if (p.startsWith('//')) return false;         // protocol-relative
  if (p.includes('://')) return false;          // absolute URL
  if (p.includes('\\')) return false;           // backslash tricks
  // Block auth-surface loops.
  const pathname = p.split('?')[0].split('#')[0];
  if (AUTH_SURFACES.has(pathname)) return false;
  return true;
}

export function saveReturnTo(path) {
  if (!hasStorage()) return false;
  if (!isSafeReturnPath(path)) return false;
  try {
    window.sessionStorage.setItem(KEY, String(path));
    return true;
  } catch { return false; }
}

export function peekReturnTo() {
  if (!hasStorage()) return null;
  try {
    const v = window.sessionStorage.getItem(KEY);
    if (!v || !isSafeReturnPath(v)) return null;
    return v;
  } catch { return null; }
}

export function consumeReturnTo() {
  const v = peekReturnTo();
  clearReturnTo();
  return v;
}

export function clearReturnTo() {
  if (!hasStorage()) return;
  try { window.sessionStorage.removeItem(KEY); } catch { /* noop */ }
}

export const _internal = { KEY, AUTH_SURFACES };
