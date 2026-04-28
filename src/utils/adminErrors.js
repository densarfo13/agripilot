/**
 * adminErrors.js — small shared helpers for admin / dashboard
 * pages that haven't been migrated to `useSafeData` yet.
 *
 * v3 update: this file now delegates to `apiClient.structureError`
 * so there is ONE classifier in the codebase. The legacy boolean
 * flags (`isAuthError`, `isMfaRequired`) are layered on top so
 * existing call sites keep working without a refactor.
 *
 *   const cls = classifyAdminError(err);
 *
 *   // v3 (preferred — switch on the explicit errorType string)
 *   if (cls.errorType === 'SESSION_EXPIRED') <SessionExpiredState />;
 *   if (cls.errorType === 'MFA_REQUIRED')    <MfaRequiredState   />;
 *   if (cls.errorType === 'NETWORK_ERROR')   <NetworkErrorState  />;
 *   else                                     <ErrorState onRetry />;
 *
 *   // legacy (still supported)
 *   if (cls.isAuthError)   <AdminNotice type="auth"   />;
 *   if (cls.isMfaRequired) <AdminNotice type="mfa"    />;
 *   else                   <AdminNotice type="error"  />;
 */

import { structureError, API_ERROR_TYPES } from '../api/apiClient.js';

export { API_ERROR_TYPES };

export function classifyAdminError(err) {
  const s = structureError(err);
  return {
    ...s,
    isAuthError:   s.errorType === API_ERROR_TYPES.SESSION_EXPIRED,
    isMfaRequired: s.errorType === API_ERROR_TYPES.MFA_REQUIRED,
    isNetworkError: s.errorType === API_ERROR_TYPES.NETWORK_ERROR,
  };
}
