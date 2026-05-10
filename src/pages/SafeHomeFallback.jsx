/**
 * SafeHomeFallback — the absolute-worst-case Home UI.
 *
 *   <HomeErrorBoundary fallback={SafeHomeFallback}>
 *     <PilotHome />
 *   </HomeErrorBoundary>
 *
 * Contract
 *   • ZERO dynamic logic. No useEffect, no useState that reads
 *     anything that could throw, no localStorage access at the
 *     module top, no context dependency, no API calls.
 *   • Pure JSX render. Every value is a hard-coded string.
 *   • Inline styles. No theme / CSS module imports that could
 *     leave the page unstyled if a CSS-loading bug surfaces.
 *   • Renders the same content on every device, every render,
 *     every state. Even if React mounts in a half-broken state
 *     this paints something.
 *
 * When this paints, an actual render error has already been
 * caught by HomeErrorBoundary. The two recovery actions are
 * deliberately the safest possible:
 *   1. "Continue setup" → /profile/setup (a real route,
 *      reachable even when /home is on fire).
 *   2. "Open dashboard" → /dashboard (the V1 fallback path
 *      farmers can use to read their farm data without the
 *      crashing Home component).
 *
 * Strict-rule audit
 *   • Pure presentational. Synchronous. Never throws.
 *   • No state, no effects, no refs.
 *   • Visible debug footer ("Safe mode") so engineers can
 *     tell at a glance the boundary fired.
 */

import React from 'react';
import { Link } from 'react-router-dom';

const STATIC_TASK = Object.freeze({
  title:       'Check soil moisture',
  description: 'Water only if soil feels dry',
  cta:         'Mark as done',
});

export default function SafeHomeFallback() {
  return (
    <div style={S.page} data-testid="safe-home-fallback">
      <div style={S.shell}>
        <header style={S.header}>
          <p style={S.eyebrow}>Farroway</p>
          <h1 style={S.title}>You're home.</h1>
          <p style={S.subtitle}>
            We've kept things simple while we sort a small issue.
            Your data is safe.
          </p>
        </header>

        <section style={S.card}>
          <p style={S.cardLabel}>Today's task</p>
          <h2 style={S.cardTitle}>{STATIC_TASK.title}</h2>
          <p style={S.cardBody}>{STATIC_TASK.description}</p>
          <button
            type="button"
            style={S.btnPrimary}
            data-testid="safe-home-task-cta"
          >
            {STATIC_TASK.cta}
          </button>
        </section>

        <section style={S.setupCard}>
          <p style={S.setupLabel}>Optional</p>
          <h2 style={S.setupTitle}>Continue setup</h2>
          <p style={S.setupBody}>
            Add your crop and location to unlock smarter tasks.
          </p>
          <Link
            to="/profile/setup"
            style={S.btnGhost}
            data-testid="safe-home-setup-cta"
          >
            Continue setup
          </Link>
        </section>

        <section style={S.linksGrid}>
          <Link to="/dashboard" style={S.linkTile}>Dashboard</Link>
          <Link to="/tasks"     style={S.linkTile}>Tasks</Link>
        </section>

        <footer style={S.footer}>
          <span>Farroway</span>
          <span>Safe mode</span>
        </footer>
      </div>
    </div>
  );
}

const C = {
  bgTop:    '#0B1D34',
  bgBottom: '#081423',
  panel:    'rgba(255,255,255,0.04)',
  border:   'rgba(255,255,255,0.08)',
  ink:      '#FFFFFF',
  inkDim:   'rgba(255,255,255,0.65)',
  inkFaint: 'rgba(255,255,255,0.45)',
  green:    '#C8944D',
  amber:    '#F59E0B',
};

const S = {
  page: {
    minHeight:  '100vh',
    background: 'linear-gradient(180deg, ' + C.bgTop + ' 0%, ' + C.bgBottom + ' 100%)',
    color:      C.ink,
    padding:    '1.5rem 1rem 4rem',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", '
              + 'Roboto, sans-serif',
  },
  shell: {
    maxWidth: '32rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    marginBottom: '0.25rem',
  },
  eyebrow: {
    margin: 0,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: C.green,
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: 0,
    fontSize: '0.9375rem',
    color: C.inkDim,
    lineHeight: 1.55,
  },
  card: {
    background: C.panel,
    border: '1px solid ' + C.border,
    borderRadius: '16px',
    padding: '1.25rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  cardLabel: {
    margin: 0,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.inkFaint,
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 700,
  },
  cardBody: {
    margin: 0,
    fontSize: '0.9375rem',
    color: C.inkDim,
    lineHeight: 1.55,
  },
  btnPrimary: {
    alignSelf: 'flex-start',
    marginTop: '0.5rem',
    padding: '0.85rem 1.4rem',
    border: 'none',
    borderRadius: '12px',
    background: C.green,
    color: C.ink,
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 46,
    boxShadow: '0 8px 22px rgba(200,148,77,0.25)',
  },
  setupCard: {
    background: 'rgba(245,158,11,0.06)',
    border: '1px dashed rgba(245,158,11,0.35)',
    borderRadius: '16px',
    padding: '1.25rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  setupLabel: {
    margin: 0,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.amber,
  },
  setupTitle: {
    margin: 0,
    fontSize: '1.0625rem',
    fontWeight: 700,
  },
  setupBody: {
    margin: 0,
    fontSize: '0.9375rem',
    color: C.inkDim,
    lineHeight: 1.5,
  },
  btnGhost: {
    alignSelf: 'flex-start',
    marginTop: '0.5rem',
    padding: '0.7rem 1.1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: C.ink,
    fontSize: '0.875rem',
    fontWeight: 700,
    textDecoration: 'none',
    minHeight: 40,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.65rem',
    marginTop: '0.25rem',
  },
  linkTile: {
    padding: '0.95rem 0.85rem',
    background: C.panel,
    border: '1px solid ' + C.border,
    borderRadius: '12px',
    color: C.ink,
    fontSize: '0.9375rem',
    fontWeight: 700,
    textDecoration: 'none',
    textAlign: 'center',
  },
  footer: {
    marginTop: '1.5rem',
    padding: '0.6rem 0.75rem',
    borderTop: '1px dashed rgba(255,255,255,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.6875rem',
    color: C.inkFaint,
    fontFamily: 'monospace',
    letterSpacing: '0.04em',
  },
};
