/**
 * useAdminData — DEPRECATED alias.
 *
 * The canonical defensive data hook is `useSafeData`. Kept as
 * a re-export so existing call sites (PendingRegistrationsPage,
 * any future hold-overs) keep working without a migration
 * sweep. New code should import `useSafeData` directly.
 *
 * The shape returned here adapts the v3 `useSafeData` shape
 * onto the legacy `useAdminData` contract:
 *
 *   {
 *     data, loading, error, retry, isEmpty,
 *     // legacy boolean flags (older callers branch on these)
 *     isAuthError, isMfaRequired,
 *   }
 */

import useSafeData, { API_ERROR_TYPES } from './useSafeData.js';

export default function useAdminData(fetcher, options = {}) {
  const safe = useSafeData(fetcher, options);
  return {
    ...safe,
    isAuthError:   safe.errorType === API_ERROR_TYPES.SESSION_EXPIRED,
    isMfaRequired: safe.errorType === API_ERROR_TYPES.MFA_REQUIRED,
  };
}

export { API_ERROR_TYPES };
