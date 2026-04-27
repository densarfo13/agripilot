/**
 * AccountLoadFallback — recovery surface shown when /me / farmer-
 * profile returned a non-fatal failure (5xx, network blip, hard
 * deadline). The dashboard renders this in place of farmer content
 * but does NOT crash and does NOT auto-logout.
 *
 *   <AccountLoadFallback
 *     message={profileError}
 *     onRetry={runBootstrap}
 *   />
 *
 * Three actions, each with a strict contract:
 *   1. Retry  → calls onRetry() to re-fetch from the API. Never
 *               window.location.reload(). Per spec § 4.
 *   2. Continue → navigates to /today (the farmer-friendly route
 *               that runs without the full profile JOIN result)
 *               WITHOUT touching auth state. The user keeps their
 *               session and can keep working. Per spec § 8 + 3.
 *   3. Back to login → EXPLICIT user logout. Calls the central
 *               logout() helper (token + cached user only — keeps
 *               onboarding, language, settings) then navigates.
 *
 * Strict-rule audit
 *   * Does NOT call localStorage.clear()
 *   * Does NOT logout on render — only on the explicit Back-to-
 *     login click
 *   * Does NOT auto-reload — Retry calls the supplied onRetry
 *   * Continue allows app entry with the cached session intact
 *   * tSafe friendly: every visible string has an English fallback
 *
 * Why a standalone component
 *   The same recovery card was inlined in FarmerDashboardPage and
 *   risked drift on every audit. Extracting it gives one canonical
 *   surface that the spec's three-button contract is enforced
 *   from, and lets future pages reuse it without re-implementing
 *   the strict no-auto-logout / no-auto-reload guarantees.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { logout as runLogout } from '../utils/logout.js';

export default function AccountLoadFallback({
  message     = '',
  onRetry     = null,
  continuePath = '/today',
  testIdPrefix = 'account-load-fallback',
}) {
  const navigate = useNavigate();

  const safeMessage = message
    || tSafe('account.loadFailed.body',
        'Unable to load account. Please refresh or continue.');

  function handleRetry() {
    if (typeof onRetry === 'function') {
      try { onRetry(); }
      catch { /* never throw from a recovery click */ }
    }
    // No window.location.reload(): per spec § 4 the retry is a
    // user-action that re-runs the data load, not a page reload.
  }

  function handleContinue() {
    // Per spec § 3: even if the user payload is missing, allow
    // entry. /today is the farmer route that renders cleanly off
    // the local farm record + IDB store — no full profile JOIN
    // result required.
    try { navigate(continuePath, { replace: true }); }
    catch { /* navigate can't fail under react-router but be safe */ }
  }

  function handleBackToLogin() {
    // Explicit user action — only path that calls logout from
    // this surface. logout() clears the token + cached user via
    // the canonical sessionManager allow-list (NOT
    // localStorage.clear) and preserves onboarding + language +
    // settings + farm data per the strict rules.
    try { runLogout(navigate); }
    catch {
      // Belt-and-braces: navigate even if the storage clear blew
      // up so the user isn't stuck on the fallback screen.
      try { navigate('/login', { replace: true }); }
      catch { /* nothing left we can do */ }
    }
  }

  return (
    <div
      style={S.card}
      role="alert"
      aria-live="polite"
      data-testid={testIdPrefix}
    >
      <h2 style={S.title}>
        {tSafe('account.loadFailed.title', 'Welcome')}
      </h2>
      <p style={S.body}>{safeMessage}</p>

      <div style={S.actions}>
        <button
          type="button"
          onClick={handleRetry}
          style={S.primaryBtn}
          data-testid={`${testIdPrefix}-retry`}
        >
          {tSafe('common.retry', 'Retry')}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          style={S.secondaryBtn}
          data-testid={`${testIdPrefix}-continue`}
        >
          {tSafe('common.continue', 'Continue')}
        </button>
        <button
          type="button"
          onClick={handleBackToLogin}
          style={S.tertiaryBtn}
          data-testid={`${testIdPrefix}-login`}
        >
          {tSafe('auth.backToLogin', 'Back to login')}
        </button>
      </div>
    </div>
  );
}

const S = {
  card: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '1.25rem 1.25rem 1.5rem',
    color: '#EAF2FF',
    margin: '1rem 0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 700,
    margin: 0,
    color: '#FFFFFF',
  },
  body: {
    margin: '0.5rem 0 1rem',
    color: 'rgba(255,255,255,0.78)',
    fontSize: '0.9375rem',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    flex: '1 1 8rem',
    minHeight: 44,
    borderRadius: 12,
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9375rem',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  },
  secondaryBtn: {
    flex: '1 1 8rem',
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.05)',
    color: '#EAF2FF',
    fontWeight: 600,
    fontSize: '0.9375rem',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  },
  tertiaryBtn: {
    flex: '1 1 8rem',
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.60)',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  },
};
