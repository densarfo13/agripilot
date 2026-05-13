/**
 * DashboardErrorBoundary — dashboard-specific React error boundary.
 *
 * Rules (permanent safe bootstrap spec):
 *   • NEVER returns null or a blank screen.
 *   • On crash: shows safe recovery cards (Setup incomplete,
 *     Weather unavailable, No farm added yet, Tasks loading,
 *     Continue setup) so the farmer always sees something useful.
 *   • Logs [FARROWAY_DASH_CRASH] to console for operator grep.
 *   • Two recovery actions: Reload (transient crash) + Go to /today
 *     (stuck / looping crash) — never a blank.
 *   • Inline styles only; no external CSS dependency that could fail.
 *   • Never throws from componentDidCatch or render.
 */

import React from 'react';
import { SeedlingGlyph, TractorGlyph, CheckGlyph, LeafGlyph } from './icons/InlineGlyphs.jsx';

function _isDev() {
  try { return Boolean(import.meta?.env?.DEV); }
  catch { return false; }
}
function _currentPath() {
  try { return typeof window !== 'undefined' ? window.location.pathname : ''; }
  catch { return ''; }
}

export default class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { crashed: true, error };
  }

  componentDidCatch(error, info) {
    try {
      const tag = _isDev()
        ? '[FARROWAY_DASH_CRASH]'
        : '[FARROWAY_DASH_CRASH]';
       
      console.error(tag, error?.message || error, _currentPath());
      if (_isDev()) {
         
        console.error('[FARROWAY_DASH_CRASH][stack]', info?.componentStack);
      }
    } catch { /* never throw from componentDidCatch */ }
  }

  handleReload = () => {
    this.setState({ crashed: false, error: null });
    try { window.location.reload(); } catch { /* swallow */ }
  };

  handleGoToToday = () => {
    this.setState({ crashed: false, error: null });
    try { window.location.href = '/today'; } catch { /* swallow */ }
  };

  render() {
    if (!this.state.crashed) return this.props.children || null;

    return (
      <div style={S.page} data-testid="dashboard-error-boundary">
        <div style={S.container}>

          {/* Header */}
          <div style={S.header}>
            <span style={S.brandDot} aria-hidden="true" />
            <span style={S.brand}>Farroway</span>
          </div>
          <h1 style={S.title}>Something went wrong</h1>
          <p style={S.subtitle}>
            Your data is safe. Here is a summary of your farm status.
          </p>

          {/* Safe status cards — always visible even when the real
              dashboard data failed to load. */}
          <div style={S.cardGrid}>
            <div style={S.card} data-testid="dash-fallback-setup">
              <span style={S.cardIcon} aria-hidden="true"><SeedlingGlyph size={20} /></span>
              <span style={S.cardLabel}>Setup</span>
              <span style={S.cardValue}>Continue setup</span>
              <a href="/profile/setup" style={S.cardLink}>Open →</a>
            </div>
            <div style={S.card} data-testid="dash-fallback-weather">
              <span style={S.cardIcon} aria-hidden="true"><LeafGlyph size={20} /></span>
              <span style={S.cardLabel}>Weather</span>
              <span style={S.cardValue}>Unavailable</span>
              <span style={S.cardNote}>Check back later</span>
            </div>
            <div style={S.card} data-testid="dash-fallback-farm">
              <span style={S.cardIcon} aria-hidden="true"><TractorGlyph size={20} /></span>
              <span style={S.cardLabel}>Farm</span>
              <span style={S.cardValue}>No farm added yet</span>
              <a href="/farm/new" style={S.cardLink}>Add farm →</a>
            </div>
            <div style={S.card} data-testid="dash-fallback-tasks">
              <span style={S.cardIcon} aria-hidden="true"><CheckGlyph size={20} /></span>
              <span style={S.cardLabel}>Tasks</span>
              <span style={S.cardValue}>Loading…</span>
              <span style={S.cardNote}>Reload to refresh</span>
            </div>
          </div>

          {/* Dev error pill */}
          {_isDev() && this.state.error ? (
            <p style={S.errPill} data-testid="dash-error-message">
              {String(this.state.error?.message || this.state.error)}
            </p>
          ) : null}

          {/* Recovery buttons */}
          <div style={S.btnRow}>
            <button
              type="button"
              onClick={this.handleReload}
              style={S.btnPrimary}
              data-testid="dash-error-reload"
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={this.handleGoToToday}
              style={S.btnGhost}
              data-testid="dash-error-go-today"
            >
              Go to dashboard
            </button>
          </div>

        </div>
      </div>
    );
  }
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '2rem 1rem 4rem',
    boxSizing: 'border-box',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: '28rem',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  brandDot: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#C8944D',
  },
  brand: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#C8944D',
    letterSpacing: '0.02em',
  },
  title: {
    margin: 0,
    fontSize: '1.375rem',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: 0,
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.625rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.875rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  cardIcon: { fontSize: '1.25rem' },
  cardLabel: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'rgba(255,255,255,0.5)',
  },
  cardValue: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#EAF2FF',
    lineHeight: 1.3,
  },
  cardNote: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.4)',
  },
  cardLink: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#C8944D',
    textDecoration: 'none',
  },
  errPill: {
    margin: 0,
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.20)',
    fontSize: '0.75rem',
    color: '#FCA5A5',
    fontFamily: 'monospace',
    wordBreak: 'break-word',
  },
  btnRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginTop: '0.25rem',
  },
  btnPrimary: {
    padding: '0.875rem 1.25rem',
    borderRadius: '12px',
    border: 'none',
    background: '#C8944D',
    color: '#FFFFFF',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: '46px',
  },
  btnGhost: {
    padding: '0.875rem 1.25rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: '46px',
  },
};
