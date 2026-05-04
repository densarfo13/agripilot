/**
 * DisabledFeatureFallback — friendly placeholder for routes
 * gated off behind a pilot feature flag.
 *
 *   <DisabledFeatureFallback feature="scan" />
 *
 * Used by App.jsx when a FEATURE_* flag is OFF — the route
 * stays mounted (so deep links don't 404) but renders this
 * surface instead of the live page. The bottom-nav stays
 * functional so the user can move to a working tab.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only.
 *   • Reads route name from the prop, NEVER from a router
 *     hook, so it's safe to mount inside an error boundary.
 */

import React from 'react';

const FEATURE_LABELS = Object.freeze({
  scan:    'Scan',
  sell:    'Sell',
  buyer:   'Marketplace',
  ngo:     'NGO',
  admin:   'Admin',
  funding: 'Funding',
});

export default function DisabledFeatureFallback({ feature, message }) {
  const label = (typeof feature === 'string' && FEATURE_LABELS[feature.toLowerCase()])
    || (typeof feature === 'string' && feature.length > 0 ? feature : 'This feature');
  const body = typeof message === 'string' && message.length > 0
    ? message
    : 'Feature temporarily disabled for pilot.';

  const handleHome = () => {
    try {
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/';
      }
    } catch { /* never throw */ }
  };

  return (
    <main
      style={S.page}
      data-testid="disabled-feature-fallback"
      data-feature={feature || 'unknown'}
    >
      <div style={S.card}>
        <span aria-hidden="true" style={S.icon}>{'\uD83D\uDEE0\uFE0F'}</span>
        <h1 style={S.title}>{label}</h1>
        <p style={S.body}>{body}</p>
        <p style={S.hint}>
          We\u2019re focused on the daily action loop while we
          stabilise. Use Home, My Grow, Tasks, or Progress in the
          meantime.
        </p>
        <div style={S.btnRow}>
          <button
            type="button"
            onClick={handleHome}
            style={S.btnPrimary}
            data-testid="disabled-feature-back-home"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: '60vh',
    padding: '24px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary, #fff)',
  },
  card: {
    width: '100%',
    maxWidth: '26rem',
    background: 'var(--card-bg, rgba(255,255,255,0.06))',
    border: '1px solid var(--card-border, rgba(255,255,255,0.12))',
    borderRadius: 16,
    padding: '1.75rem 1.5rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  icon: { fontSize: 40, lineHeight: 1 },
  title: { margin: '0.5rem 0 0', fontSize: '1.15rem', fontWeight: 800 },
  body:  { margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary, rgba(255,255,255,0.78))' },
  hint:  { margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted, rgba(255,255,255,0.55))', lineHeight: 1.5 },
  btnRow: { display: 'flex', gap: 8, marginTop: 14, width: '100%', justifyContent: 'center' },
  btnPrimary: {
    minWidth: '12rem',
    minHeight: 48,
    padding: '0.85rem 1.25rem',
    border: 'none',
    borderRadius: 12,
    background: 'var(--role-accent, #2ecc71)',
    color: 'var(--role-accent-ink, #042c1a)',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
