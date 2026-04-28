/**
 * AdminState — the v3 state-component family every admin /
 * dashboard page should use to render the four stable
 * non-data states:
 *
 *   <LoadingState />                                    // skeleton / spinner
 *   <EmptyState   title="No farmers yet" message="…" />
 *   <ErrorState   message="…"  onRetry={retry} />
 *   <SessionExpiredState />                              // 401
 *   <MfaRequiredState verifyHref="/account/mfa" />       // step-up / setup
 *
 * Pattern
 * ───────
 *   const { data, loading, error, errorType, retry, isEmpty }
 *     = useSafeData(fetcher, { fallbackData: [] });
 *
 *   if (loading)                                  return <LoadingState/>;
 *   if (errorType === 'SESSION_EXPIRED')          return <SessionExpiredState/>;
 *   if (errorType === 'MFA_REQUIRED')             return <MfaRequiredState/>;
 *   if (error)                                    return <ErrorState message={error} onRetry={retry}/>;
 *   if (isEmpty)                                  return <EmptyState   title="…" message="…"/>;
 *   return <Table rows={data} />;
 *
 * Strict-rule audit
 *   * Pure presentation — no hooks, no fetching.
 *   * Each subcomponent renders calm copy; never shows raw
 *     stack traces / error codes (they go to the console
 *     only).
 *   * SessionExpiredState links to `/login?from=<here>` so
 *     the user lands back where they were after re-auth.
 *   * MfaRequiredState's "Verify now" button is OPTIONAL —
 *     if `verifyHref` is omitted (no MFA verify route on
 *     this surface), the action is hidden so the message
 *     still reads cleanly.
 *   * The empty / error / session / mfa cards share the same
 *     visual scaffold so a page never jumps layouts when it
 *     transitions between states.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

/* ─── shared scaffold ─────────────────────────────── */

function StateCard({
  tone = 'neutral',           // 'neutral' | 'error' | 'auth' | 'mfa' | 'empty'
  icon, title, message, children,
  testId,
}) {
  const palette = TONES[tone] || TONES.neutral;
  return (
    <div
      role={tone === 'error' || tone === 'auth' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      data-testid={testId}
      data-tone={tone}
      style={{
        background:    palette.bg,
        border:        `1px solid ${palette.border}`,
        borderRadius:  '16px',
        padding:       '1.25rem 1.25rem',
        color:         C.white,
        display:       'flex',
        flexDirection: 'column',
        gap:           '0.5rem',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
      }}>
        <span aria-hidden="true" style={{ fontSize: '1.25rem' }}>
          {icon}
        </span>
        <span style={{
          fontSize: '1rem', fontWeight: 800, color: C.white,
          letterSpacing: '-0.005em',
        }}>
          {title}
        </span>
      </div>
      {message && (
        <p style={{
          margin: 0, color: 'rgba(255,255,255,0.78)',
          fontSize: '0.9375rem', lineHeight: 1.55,
        }}>{message}</p>
      )}
      {children && (
        <div style={{
          marginTop: '0.5rem', display: 'flex',
          flexWrap: 'wrap', gap: '0.5rem',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

const TONES = {
  neutral: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
  empty:   { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
  error:   { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.30)'  },
  auth:    { bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.30)' },
  mfa:     { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.30)'  },
  network: { bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.30)' },
};

/* ─── shared button styles ────────────────────────── */

function btnPrimary() {
  return {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem 0.95rem',
    borderRadius: '10px', border: 'none',
    background: C.green, color: C.white,
    fontSize: '0.875rem', fontWeight: 700,
    cursor: 'pointer', textDecoration: 'none',
  };
}
function btnGhost() {
  return {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem 0.95rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: C.white,
    fontSize: '0.875rem', fontWeight: 700,
    cursor: 'pointer', textDecoration: 'none',
  };
}

/* ─── helpers ─────────────────────────────────────── */

function _signInHref() {
  try {
    const here = (typeof window !== 'undefined' && window.location)
      ? `${window.location.pathname}${window.location.search}`
      : '/';
    return `/login?from=${encodeURIComponent(here)}`;
  } catch {
    return '/login';
  }
}

/* ─── 1. LoadingState ─────────────────────────────── */

export function LoadingState({
  message = 'Loading…',
  testId  = 'admin-state-loading',
}) {
  return (
    <div
      role="status" aria-live="polite" data-testid={testId}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.65rem',
        padding: '1rem 0.25rem',
        color: 'rgba(255,255,255,0.65)', fontSize: '0.9375rem',
      }}>
      <span style={{
        width: 14, height: 14, borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.15)',
        borderTopColor: C.green,
        animation: 'farroway-spin 0.8s linear infinite',
      }} />
      {message}
    </div>
  );
}

/* ─── 2. EmptyState ───────────────────────────────── */

export function EmptyState({
  title   = 'Nothing to show yet',
  message = 'New entries will appear here as they come in.',
  icon    = 'ℹ️',
  action,                                  // optional <a/> or <button/>
  testId  = 'admin-state-empty',
}) {
  return (
    <StateCard
      tone="empty" icon={icon}
      title={title} message={message} testId={testId}
    >
      {action}
    </StateCard>
  );
}

/* ─── 3. ErrorState ───────────────────────────────── */

export function ErrorState({
  title   = 'We hit a snag',
  message = 'We could not load this section. Your data is safe — try again in a moment.',
  onRetry,
  testId  = 'admin-state-error',
}) {
  return (
    <StateCard
      tone="error" icon="⚠️"
      title={title} message={message} testId={testId}
    >
      {onRetry && (
        <button
          type="button" onClick={onRetry}
          style={btnPrimary()}
          data-testid={`${testId}-retry`}
        >
          Retry
        </button>
      )}
    </StateCard>
  );
}

/* ─── 4. SessionExpiredState ──────────────────────── */

export function SessionExpiredState({
  message = 'Session expired. Please sign in again.',
  testId  = 'admin-state-session',
}) {
  return (
    <StateCard
      tone="auth" icon="🔒"
      title="Session expired" message={message} testId={testId}
    >
      <a
        href={_signInHref()}
        style={btnPrimary()}
        data-testid={`${testId}-signin`}
      >
        Sign in again
      </a>
    </StateCard>
  );
}

/* ─── 5. MfaRequiredState ─────────────────────────── */

export function MfaRequiredState({
  message    = 'MFA verification required. Please complete verification to continue.',
  verifyHref,                              // optional
  testId     = 'admin-state-mfa',
}) {
  return (
    <StateCard
      tone="mfa" icon="🔐"
      title="MFA verification required"
      message={message} testId={testId}
    >
      {verifyHref ? (
        <a
          href={verifyHref}
          style={btnPrimary()}
          data-testid={`${testId}-verify`}
        >
          Verify now
        </a>
      ) : null}
    </StateCard>
  );
}

/* ─── 6. NetworkErrorState ────────────────────────── */
/* Bonus state for the NETWORK_ERROR errorType — same look
   as ErrorState but with copy that hints at connectivity
   instead of a server fault. */

export function NetworkErrorState({
  message = 'We cannot reach the server right now. Check your connection and try again.',
  onRetry,
  testId  = 'admin-state-network',
}) {
  return (
    <StateCard
      tone="network" icon="📡"
      title="Cannot reach the server" message={message} testId={testId}
    >
      {onRetry && (
        <button
          type="button" onClick={onRetry}
          style={btnGhost()}
          data-testid={`${testId}-retry`}
        >
          Try again
        </button>
      )}
    </StateCard>
  );
}

/* ─── 7. AdminState — auto-router for useSafeData ──── */
/*
 * Convenience wrapper: pass the whole `useSafeData` return
 * shape and AdminState picks the right subcomponent. Useful
 * for terse pages where you just want
 *
 *   <AdminState
 *     state={safe}
 *     emptyTitle="No farmers yet"
 *     emptyMessage="They will appear here once registered."
 *   />
 *
 * Returns null when the page is in the "data ready, render
 * the table" path — caller renders the data view themselves.
 */
export default function AdminState({
  state,                       // useSafeData return
  emptyTitle, emptyMessage, emptyIcon, emptyAction,
  errorTitle,  errorMessage,
  loadingMessage,
  verifyHref,
  testIdPrefix = 'admin-state',
}) {
  if (!state) return null;
  const { loading, error, errorType, retry, isEmpty } = state;

  if (loading) {
    return <LoadingState message={loadingMessage} testId={`${testIdPrefix}-loading`} />;
  }
  if (errorType === 'SESSION_EXPIRED') {
    return <SessionExpiredState testId={`${testIdPrefix}-session`} />;
  }
  if (errorType === 'MFA_REQUIRED') {
    return <MfaRequiredState verifyHref={verifyHref}
                             testId={`${testIdPrefix}-mfa`} />;
  }
  if (errorType === 'NETWORK_ERROR') {
    return <NetworkErrorState onRetry={retry} testId={`${testIdPrefix}-network`} />;
  }
  if (error) {
    return <ErrorState
      title={errorTitle} message={errorMessage}
      onRetry={retry} testId={`${testIdPrefix}-error`}
    />;
  }
  if (isEmpty) {
    return <EmptyState
      title={emptyTitle} message={emptyMessage} icon={emptyIcon}
      action={emptyAction} testId={`${testIdPrefix}-empty`}
    />;
  }
  return null;
}
