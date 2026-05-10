/**
 * components/system/ErrorBoundary — Sentry-aware boundary with a
 * calm Soft Ochre / Beige fallback.
 *
 *   import ErrorBoundary from './components/system/ErrorBoundary.jsx';
 *
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * Why a separate file from src/components/ErrorBoundary.jsx
 * ──────────────────────────────────────────────────────────
 * The top-level boundary at `src/components/ErrorBoundary.jsx`
 * owns the full-page recovery card with Repair / Restart
 * setup / Clear cache CTAs (used as the absolute last-resort
 * catch in main.jsx). This `system/ErrorBoundary` is the
 * INNER, Sentry-aware variant: it captures every render-path
 * exception via `captureException` from `src/lib/sentry.js`
 * and shows a minimal, brand-consistent fallback the user
 * can dismiss by reloading.
 *
 * Both boundaries can coexist — the system boundary is the
 * fast path (caught + reported to Sentry, calm UI), the
 * top-level one is the slow path (deep recovery flow). Either
 * one alone is enough to prevent a white screen.
 *
 * Strict-rule audit
 *   • Pure React class component. Never throws inside its own
 *     catch handler.
 *   • Reads tokens from `src/design/tokens/colors.js` via
 *     PREMIUM_TOKENS so the fallback always matches the rest
 *     of the app's palette.
 *   • `captureException` is a no-op when VITE_SENTRY_DSN is
 *     unset — boundary still works, the error just doesn't
 *     reach Sentry.
 */

import React from 'react';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';
import { captureException } from '../../lib/sentry.js';

function _currentPath() {
  try {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.pathname;
    }
  } catch { /* swallow */ }
  return '';
}

export default class SystemErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Send to Sentry. captureException is a no-op when
    // VITE_SENTRY_DSN isn't set, so the boundary still works
    // in dev / unprod without leaking anything.
    try {
      captureException(error, {
        tag: 'app.crash.system-boundary',
        extra: {
          componentStack: info && info.componentStack
            ? String(info.componentStack).slice(0, 500)
            : null,
          page: _currentPath(),
        },
      });
    } catch { /* never throw from a catch handler */ }

    // Greppable console line for ops.
    try {
      // eslint-disable-next-line no-console
      console.error('[FARROWAY_CRASH][system-boundary]',
        error && error.message ? error.message : error,
        _currentPath());
    } catch { /* swallow */ }
  }

  handleReload = () => {
    try {
      if (typeof window !== 'undefined' && window.location
          && typeof window.location.reload === 'function') {
        window.location.reload();
      }
    } catch { /* never throw */ }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main style={S.page} data-testid="system-error-boundary" role="alert">
        <div style={S.card}>
          <h1 style={S.title}>Something went off track</h1>
          <p style={S.body}>
            A small part of the app stumbled. Your data is safe — a
            quick reload usually puts everything back in place.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={S.primaryBtn}
            className="ff-tap"
            data-testid="system-error-reload"
          >
            Reload
          </button>
          <p style={S.footnote}>
            If it happens again, it&rsquo;s already been logged
            for review.
          </p>
        </div>
      </main>
    );
  }
}

// ─── Inline styles (unified Soft Ochre / Beige palette) ────────

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${T.bgTop || '#F6F1E7'} 0%, ${T.bgBottom || '#EFE7D5'} 100%)`,
    color: T.ink || '#1F2933',
    padding: '24px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '28rem',
    background: T.panelHi || '#FFFFFF',
    border: `1px solid ${T.border || 'rgba(36,49,58,0.08)'}`,
    borderRadius: 16,
    padding: '1.75rem 1.5rem',
    boxShadow: '0 1px 0 0 rgba(255,255,255,0.55) inset, 0 8px 24px rgba(15,23,42,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
    textAlign: 'left',
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: T.ink || '#1F2933',
  },
  body: {
    margin: 0,
    fontSize: '0.95rem',
    color: T.inkDim || '#667085',
    lineHeight: 1.5,
  },
  primaryBtn: {
    appearance: 'none',
    border: 'none',
    background: `linear-gradient(180deg, ${T.ochre || '#C8944D'} 0%, ${T.ochreActive || '#B9853F'} 100%)`,
    color: '#FFFFFF',
    padding: '0.85rem 1.4rem',
    borderRadius: 12,
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 48,
    fontFamily: 'inherit',
    boxShadow: '0 10px 24px rgba(200,148,77,0.32)',
    marginTop: 4,
  },
  footnote: {
    margin: '0.25rem 0 0',
    fontSize: '0.8rem',
    color: T.inkFaint || '#98A2B3',
    lineHeight: 1.5,
  },
};
