/**
 * authDevAssertions.js — development-only warnings for the
 * Section-15 auth-reliability rules. Centralized so every
 * consumer calls the same entry point and we can swap the
 * output channel in one place.
 *
 * All assertions are pure, side-effect free in production,
 * and log a structured payload under a stable tag in dev.
 */

const TAG = '[farroway.auth]';

function isDev() {
  if (typeof window === 'undefined') return false;
  const env = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV)
    || 'development';
  return env !== 'production';
}

function warn(reason, details = {}) {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.warn(TAG, reason, { ...details, at: new Date().toISOString() });
}

/** §15: request to protected endpoint went out without a token */
export function assertRequestHasToken(url, hasToken) {
  if (!isDev()) return;
  if (hasToken) return;
  // Treat anything under /api/admin/, /api/v2/admin/, /api/v1/admin/
  // and the security/users endpoints as protected.
  const protectedRx = /\/api\/(?:v[12]\/)?(?:admin|security|auth\/me)\b/;
  if (!protectedRx.test(String(url || ''))) return;
  warn('API request sent without token to protected endpoint', { url });
}

/** §15: multiple refresh calls racing at once */
export function assertRefreshNotRacing(pendingCount) {
  if (!isDev()) return;
  if (typeof pendingCount !== 'number') return;
  if (pendingCount <= 1) return;
  warn('multiple refresh attempts racing', { pendingCount });
}

/** §15: admin page rendered without auth guard */
export function assertAdminPageGuarded(routePath, wasGuarded) {
  if (!isDev()) return;
  if (wasGuarded) return;
  if (!routePath || !/^\/admin\//.test(String(routePath))) return;
  warn('admin page rendered without auth guard', { routePath });
}

/** §15: MFA_REQUIRED response but the app did not route to MFA */
export function assertMfaRouted(mfaRequired, routed) {
  if (!isDev()) return;
  if (!mfaRequired) return;
  if (routed) return;
  warn('MFA required response not routed to MFA screen', {});
}

/** §15: refresh succeeded but session store was not updated */
export function assertSessionUpdatedAfterRefresh(refreshOk, storeUpdated) {
  if (!isDev()) return;
  if (!refreshOk) return;
  if (storeUpdated) return;
  warn('refresh succeeded but session store not updated', {});
}

/** §15: auth banner displayed without a recovery attempt first */
export function assertBannerAfterRecovery(bannerShown, recoveryTried) {
  if (!isDev()) return;
  if (!bannerShown) return;
  if (recoveryTried) return;
  warn('auth banner displayed without recovery attempt first', {});
}

export const _internal = { TAG };
