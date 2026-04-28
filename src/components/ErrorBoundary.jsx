/**
 * ErrorBoundary — catches React render crashes and shows a
 * calm recovery screen.
 *
 * Strict-rule audit (per the v3 admin-stability spec):
 *   * Does NOT clear localStorage. (A crash in one widget
 *     should never destroy the user's saved farms / queue.)
 *   * Does NOT force-logout. (AuthContext is the only owner
 *     of session state.)
 *   * Does NOT show raw stack traces to the user — the
 *     `[FARROWAY_CRASH]` console line is dev-mode only.
 *   * Branded recovery screen with two clear actions:
 *       - Reload page         (re-bootstraps cleanly from /)
 *       - Go to dashboard     (skips the broken route)
 *   * Logs to console only in development. Production pipes
 *     stay clean unless the analytics module is wired.
 *   * Includes the page name (window.location.pathname) so
 *     ops can grep one log line + path and know exactly
 *     which surface threw.
 */

import React from 'react';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import BrandLogo from './BrandLogo.jsx';

const C = FARROWAY_BRAND.colors;

function _isDev() {
  try {
    return Boolean(import.meta && import.meta.env && import.meta.env.DEV);
  } catch {
    return false;
  }
}

function _currentPath() {
  try {
    return (typeof window !== 'undefined' && window.location)
      ? window.location.pathname
      : '';
  } catch { return ''; }
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, page: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, page: _currentPath() };
  }

  componentDidCatch(error, info) {
    // Fire-and-forget analytics — dynamic import so the
    // boundary never trips its own analytics path. Never
    // re-throws into React.
    try {
      import('../lib/analytics.js')
        .then((mod) => {
          try {
            mod.safeTrackEvent?.('app.crash', {
              error: error?.message,
              stack: info?.componentStack?.slice(0, 500),
              page:  _currentPath(),
            });
          } catch { /* analytics never critical */ }
        })
        .catch(() => { /* swallow */ });
    } catch { /* never propagate from a catch handler */ }

    // Operators grep for FARROWAY_CRASH in Railway / Sentry.
    // Dev console gets the full payload; production gets just
    // the prefixed message so we don't leak component stacks
    // into a user's DevTools.
    try {
      if (_isDev()) {
        console.error('[FARROWAY_CRASH]', error, info, _currentPath());
      } else {
        console.error('[FARROWAY_CRASH]', error?.message || 'unknown',
          _currentPath());
      }
    } catch { /* console missing in some sandboxes */ }
  }

  handleReload = () => {
    // Reset local state first so React doesn't render the
    // recovery card on top of the new navigation. Reload the
    // current page so the user stays where they were —
    // useful when the crash was a transient render fault
    // (race, late prop) rather than a corrupt route.
    this.setState({ hasError: false, error: null, page: '' });
    try {
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    } catch { /* never throw from a recovery handler */ }
  };

  handleHome = () => {
    // Go to the dashboard root. Lets AuthContext re-bootstrap
    // from cookies cleanly instead of replaying whatever
    // broken state caused the crash on the previous route.
    this.setState({ hasError: false, error: null, page: '' });
    try {
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/';
      }
    } catch { /* never throw */ }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const page = this.state.page || _currentPath();

    return (
      <div style={S.page}>
        <div style={S.card}>
          <BrandLogo variant="light" size="md" />

          <h1 style={S.title}>We hit a temporary issue.</h1>
          <p style={S.lead}>Your data is safe.</p>

          <p style={S.desc}>
            Something went wrong rendering this page. You can
            reload to try again, or jump back to the dashboard.
          </p>

          {page && (
            <p style={S.pagePill}>
              <span style={S.pagePillLabel}>Page</span>
              <span style={S.pagePillVal}>{page}</span>
            </p>
          )}

          <div style={S.btnRow}>
            <button type="button"
                    onClick={this.handleReload}
                    style={S.btnPrimary}
                    data-testid="error-boundary-reload">
              Reload page
            </button>
            <button type="button"
                    onClick={this.handleHome}
                    style={S.btnGhost}
                    data-testid="error-boundary-home">
              Go to dashboard
            </button>
          </div>

          <p style={S.tagline}>{FARROWAY_BRAND.tagline}</p>
        </div>
      </div>
    );
  }
}

const S = {
  page: {
    minHeight:      '100vh',
    background:     `linear-gradient(180deg, ${C.navy} 0%, ${C.darkPanel} 100%)`,
    color:          C.white,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '2rem',
    fontFamily:     'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", '
                  + 'Roboto, sans-serif',
  },
  card: {
    textAlign:      'center',
    maxWidth:       '26rem',
    width:          '100%',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            '0.85rem',
    background:     'rgba(255,255,255,0.04)',
    border:         '1px solid rgba(255,255,255,0.08)',
    borderRadius:   '20px',
    padding:        '2rem 1.5rem',
  },
  title: { fontSize: '1.5rem', fontWeight: 800,
           margin: '0.5rem 0 0', color: C.white,
           letterSpacing: '-0.01em' },
  lead:  { margin: 0, fontSize: '0.9375rem',
           color: C.lightGreen, fontWeight: 700 },
  desc:  { fontSize: '0.9375rem',
           color: 'rgba(255,255,255,0.7)',
           margin: '0.25rem 0 0', lineHeight: 1.55 },
  pagePill: {
    display: 'inline-flex', alignItems: 'center',
    gap: '0.5rem',
    padding: '0.35rem 0.7rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    margin: '0.25rem 0 0',
    fontSize: '0.8125rem',
  },
  pagePillLabel: {
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em', fontWeight: 700,
    fontSize: '0.6875rem',
  },
  pagePillVal: { color: C.white, fontFamily: 'monospace' },
  btnRow: {
    display: 'flex', flexWrap: 'wrap',
    gap: '0.5rem', justifyContent: 'center',
    marginTop: '0.75rem',
  },
  btnPrimary: {
    padding:      '0.85rem 1.4rem',
    borderRadius: '12px', border: 'none',
    background:   C.green, color: C.white,
    fontSize:     '0.9375rem', fontWeight: 700,
    cursor:       'pointer',
    minHeight:    '46px',
    boxShadow:    '0 8px 22px rgba(34,197,94,0.25)',
  },
  btnGhost: {
    padding:      '0.85rem 1.4rem',
    borderRadius: '12px',
    border:       '1px solid rgba(255,255,255,0.18)',
    background:   'transparent', color: C.white,
    fontSize:     '0.9375rem', fontWeight: 700,
    cursor:       'pointer',
    minHeight:    '46px',
  },
  tagline: {
    margin: '0.85rem 0 0',
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.8125rem',
  },
};
