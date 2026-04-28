/**
 * adminErrors.js — small shared helpers for admin / dashboard
 * pages so the inline `useEffect → api.get → catch` pattern
 * can render an `<AdminNotice>` with the right tone (auth /
 * mfa / generic error) without each page reinventing the
 * classification.
 *
 *   const cls = classifyAdminError(err);
 *   if (cls.isAuthError)   <AdminNotice type="auth" />
 *   if (cls.isMfaRequired) <AdminNotice type="mfa" />
 *   else                   <AdminNotice type="error" message={cls.message} onRetry={load} />
 */

/**
 * Reads AxiosError / fetch Response shapes safely. Always
 * returns a usable object; never throws.
 */
export function classifyAdminError(err) {
  if (!err) {
    return {
      isAuthError: false, isMfaRequired: false,
      message: '', status: null, code: '',
    };
  }

  const status =
       (err.response && err.response.status)
    || err.status
    || null;
  const code =
       (err.response && err.response.data && err.response.data.code)
    || err.code
    || '';
  const message =
       (err.response && err.response.data && err.response.data.error)
    || (err.response && err.response.data && err.response.data.message)
    || err.message
    || '';

  const codeUpper = String(code || '').toUpperCase();
  const isMfaRequired =
       codeUpper === 'MFA_CHALLENGE_REQUIRED'
    || codeUpper === 'MFA_SETUP_REQUIRED'
    || codeUpper === 'STEP_UP_REQUIRED'
    || codeUpper === 'STEP_UP_EXPIRED'
    || /mfa\s*(required|verification)/i.test(message);

  // 401 (without an MFA code) means the session is dead. The
  // global axios interceptor in api/client.js already tries a
  // cookie refresh; by the time the error reaches the page,
  // refresh has failed and we should prompt for re-auth.
  const isAuthError = status === 401 && !isMfaRequired;

  return {
    isAuthError,
    isMfaRequired,
    message: message || 'Request failed',
    status,
    code: codeUpper,
  };
}
