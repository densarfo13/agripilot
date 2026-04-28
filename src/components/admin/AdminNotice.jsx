/**
 * AdminNotice — calm, branded inline banner for the admin /
 * dashboard surfaces. Replaces the older bare
 *
 *   {error && <div className="alert alert-danger">{error}</div>}
 *
 * pattern. Knows how to render the four common admin states:
 *
 *   <AdminNotice type="error"   onRetry={retry} />
 *   <AdminNotice type="auth"    />               // 401 / session expired
 *   <AdminNotice type="mfa"     />               // MFA / step-up required
 *   <AdminNotice type="warning" cached />        // showing cached data
 *   <AdminNotice type="info"    />               // empty / informational
 *
 * Behaviour
 *   * Never shows raw stack traces — the caller passes a
 *     short, user-safe `message` string.
 *   * "auth" type renders a "Sign in again" button that
 *     redirects to /login.
 *   * "mfa" type renders a "Verify MFA" button. If a
 *     `verifyHref` prop is supplied it is used; otherwise
 *     the button is omitted (so the notice is still useful
 *     on routes that don't have a dedicated MFA page).
 *   * "error" type optionally renders a "Retry" button when
 *     `onRetry` is supplied.
 *   * Banner colour comes from FARROWAY_BRAND so the look
 *     stays consistent with the rest of the v3 surface.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

const TONES = {
  error:   { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.30)',  fg: '#FCA5A5', icon: '⚠️' },
  warning: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', fg: '#FCD34D', icon: '⚠️' },
  info:    { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.30)',  fg: '#86EFAC', icon: 'ℹ️' },
  success: { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.40)',  fg: '#86EFAC', icon: '✅' },
  auth:    { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', fg: '#FCD34D', icon: '🔒' },
  mfa:     { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)',  fg: '#86EFAC', icon: '🔐' },
};

function _signInHref() {
  // Preserve the page the user was on so /login can return
  // them after re-auth. Same convention used by AuthGuard.
  try {
    const here = (typeof window !== 'undefined' && window.location)
      ? `${window.location.pathname}${window.location.search}`
      : '/';
    return `/login?from=${encodeURIComponent(here)}`;
  } catch {
    return '/login';
  }
}

export default function AdminNotice({
  type      = 'error',          // "error" | "warning" | "info" | "success" | "auth" | "mfa"
  title,                        // optional — falls back to a sensible default per type
  message,                      // body text; never render raw error.toString here
  onRetry,                      // function — when present, render Retry button
  verifyHref,                   // string  — MFA verify destination (optional)
  cached = false,               // hint that we're showing cached / stale data
  testId = 'admin-notice',
  style,
}) {
  const tone = TONES[type] || TONES.error;

  const defaultTitle =
      type === 'auth'    ? 'Session expired'
    : type === 'mfa'     ? 'MFA verification required'
    : type === 'warning' ? (cached ? 'Showing cached data' : 'Heads up')
    : type === 'info'    ? 'Nothing to show yet'
    : type === 'success' ? 'Done'
    :                      'We hit a snag';

  const defaultMessage =
      type === 'auth' ? 'Your session has timed out. Please sign in again to continue.'
    : type === 'mfa'  ? 'This area requires a verified second factor before it can load.'
    : type === 'warning' && cached
        ? 'We could not refresh just now, so this is the last copy we have. We will retry automatically.'
    : type === 'info'  ? 'Nothing has come through yet. Check back in a few minutes.'
    : type === 'success' ? 'All good.'
    : 'We could not load this section. Your data is safe — try again in a moment.';

  return (
    <div
      role={type === 'error' || type === 'auth' || type === 'mfa' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      data-testid={testId}
      data-tone={type}
      style={{
        background:    tone.bg,
        border:        `1px solid ${tone.border}`,
        borderRadius:  '14px',
        padding:       '0.875rem 1rem',
        color:         tone.fg,
        display:       'flex',
        alignItems:    'flex-start',
        gap:           '0.75rem',
        fontSize:      '0.9375rem',
        lineHeight:    1.5,
        ...(style || {}),
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1.125rem', lineHeight: 1.3 }}>
        {tone.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: C.white }}>
          {title || defaultTitle}
        </div>
        <div style={{ marginTop: '0.25rem', color: 'rgba(255,255,255,0.78)' }}>
          {message || defaultMessage}
        </div>

        {(onRetry || type === 'auth' || (type === 'mfa' && verifyHref)) && (
          <div style={{
            marginTop: '0.65rem',
            display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
          }}>
            {type === 'auth' && (
              <a
                href={_signInHref()}
                data-testid={`${testId}-signin`}
                style={btnStyle({ filled: true })}
              >
                Sign in again
              </a>
            )}
            {type === 'mfa' && verifyHref && (
              <a
                href={verifyHref}
                data-testid={`${testId}-verify`}
                style={btnStyle({ filled: true })}
              >
                Verify MFA
              </a>
            )}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                data-testid={`${testId}-retry`}
                style={btnStyle({ filled: false })}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle({ filled }) {
  return {
    display:       'inline-flex',
    alignItems:    'center',
    justifyContent:'center',
    padding:       '0.45rem 0.9rem',
    borderRadius:  '10px',
    fontSize:      '0.875rem',
    fontWeight:    700,
    cursor:        'pointer',
    textDecoration:'none',
    border:        filled ? 'none' : '1px solid rgba(255,255,255,0.18)',
    background:    filled ? C.green : 'transparent',
    color:         filled ? C.white : C.white,
  };
}
