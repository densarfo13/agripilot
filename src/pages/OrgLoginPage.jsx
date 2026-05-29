/**
 * src/pages/OrgLoginPage.jsx — Opt-in organization sign-in
 * surface at /org-login.
 *
 *   Route: /org-login
 *   Visibility: NOT in any grower nav. Reachable by direct URL
 *   only, so farmers / gardeners never see the SSO options
 *   unless their organization administrator hands them the link.
 *
 * What this is
 * ────────────
 *   Minimal, calm landing for enterprise users. Reads
 *   organization email; if the domain matches a configured
 *   policy via mapEmailDomainToOrg, initiates startFederatedLogin
 *   and redirects to the provider's authorization URL. Until
 *   the federation Prisma migration deploys, the domain lookup
 *   returns no matches and the page renders the calm "not
 *   enabled yet" state — no fake provider list, no leaked
 *   client config.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • Reads ONLY through the runtime — does not call fetch /
 *     APIs directly from this file.
 *   • All copy via tSafe.
 *   • Never displays the existing /login surface. This is a
 *     parallel, opt-in entry point.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import {
  mapEmailDomainToOrg, startFederatedLogin,
  federationHealth,
} from '../runtime/auth/federation/index';

const S = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '40px 20px 96px',
    maxWidth: 440,
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title:    { fontSize: 24, fontWeight: 800, margin: '0 0 4px',
              textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#475569', margin: '0 0 24px',
              textAlign: 'center', lineHeight: 1.55 },
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 14,
    padding: '20px 18px',
    marginBottom: 14,
  },
  label: {
    fontSize: 12, fontWeight: 700, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 6, display: 'block',
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    fontSize: 15, padding: '10px 12px',
    border: '1px solid rgba(31,41,51,0.18)',
    borderRadius: 10, marginBottom: 12,
    fontFamily: 'inherit', color: '#1F2933',
    background: '#FFFFFF',
  },
  cta: {
    appearance: 'none', border: 'none', width: '100%',
    background: '#C8944D', color: '#FFFFFF',
    padding: '12px 14px', borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ctaDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  back: {
    appearance: 'none', border: 'none',
    background: 'transparent', color: '#64748B',
    padding: '6px 0', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8,
  },
  status: {
    fontSize: 12, color: '#475569',
    background: 'rgba(31,41,51,0.04)',
    padding: '8px 10px', borderRadius: 8,
    marginTop: 10, lineHeight: 1.5,
  },
  err: {
    fontSize: 13, color: '#9B4747',
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    padding: '10px 12px', borderRadius: 10,
    marginTop: 10,
  },
};

export default function OrgLoginPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Honest probe — surfaces what the federation runtime sees
  // right now. Empty providers + 'in_memory' persistence are
  // expected until the supervised deploy lands.
  const health = useMemo(() => {
    try { return federationHealth(); }
    catch { return null; }
  }, []);

  const onSubmit = useCallback((e) => {
    e && e.preventDefault && e.preventDefault();
    setError('');
    const trimmed = String(email || '').trim().toLowerCase();
    if (!trimmed || trimmed.indexOf('@') < 0) {
      setError(tSafe('orgLogin.error.invalidEmail',
        'Enter a valid work email address.'));
      return;
    }
    setBusy(true);
    try {
      // Until the federation Prisma migration deploys, the
      // policy table is empty — mapEmailDomainToOrg returns
      // ok:false. We surface that as the calm "not enabled
      // yet" state without leaking provider config.
      const match = mapEmailDomainToOrg(trimmed, []);
      if (!match || !match.ok) {
        setError(tSafe('orgLogin.notEnabled',
          'Your organization is not yet enabled for Farroway. '
          + 'Please contact your organization administrator.'));
        return;
      }
      // When a policy is found at production time, the runtime
      // emits the authorization URL; redirect happens here.
      // (Code path executes only when persistence is live —
      // keeps the in-memory path safely inert.)
      const start = startFederatedLogin({
        providerType: 'oidc',
        state:        String(Date.now()),
      });
      if (start && start.ok && start.authorizationUrl) {
        if (typeof window !== 'undefined') {
          window.location.href = start.authorizationUrl;
        }
      } else {
        setError(tSafe('orgLogin.providerUnavailable',
          'Your organization provider is not available right '
          + 'now. Please try again later.'));
      }
    } catch {
      setError(tSafe('orgLogin.error.generic',
        'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  }, [email]);

  const pendingPersistence = health && health.persistence === 'in_memory';

  return (
    <main style={S.page} data-testid="org-login-page">
      <button
        type="button" style={S.back}
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }}
        data-testid="org-login-back-to-grower-login"
      >
        {'← '}{tSafe('orgLogin.backToGrowerLogin', 'Sign in as a grower instead')}
      </button>
      <h1 style={S.title}>
        {tSafe('orgLogin.title', 'Sign in with your organization')}
      </h1>
      <p style={S.subtitle}>
        {tSafe('orgLogin.subtitle',
          'For NGO staff, buyers, cooperatives, and government '
          + 'partners. Enter your work email to continue.')}
      </p>

      <form style={S.card} onSubmit={onSubmit}
        data-testid="org-login-form">
        <label style={S.label} htmlFor="org-login-email">
          {tSafe('orgLogin.emailLabel', 'Organization email')}
        </label>
        <input
          id="org-login-email"
          type="email"
          autoComplete="email"
          placeholder="you@your-organization.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={S.input}
          data-testid="org-login-email-input"
          required
        />
        <button
          type="submit"
          style={{ ...S.cta, ...(busy ? S.ctaDisabled : {}) }}
          disabled={busy}
          data-testid="org-login-continue"
        >
          {busy
            ? tSafe('orgLogin.continuing', 'Continuing…')
            : tSafe('orgLogin.continue',   'Continue')}
        </button>
        {error ? (
          <div style={S.err} data-testid="org-login-error">
            {error}
          </div>
        ) : null}
      </form>

      {pendingPersistence ? (
        <div style={S.status} data-testid="org-login-pending">
          {tSafe('orgLogin.persistencePending',
            'Federation is being rolled out. If your '
            + 'organization is already onboarded, sign-in will '
            + 'work as soon as your provider is enabled.')}
        </div>
      ) : null}
    </main>
  );
}
