/**
 * DashboardErrorBoundary — lightweight recovery screen.
 *
 * Wraps the full Dashboard render so a crash in any child
 * (including the HomeAssistant or legacy layout) is caught
 * before it propagates to the App-level error boundary and
 * shows a blank screen.
 *
 * Recovery surface shows:
 *   • brief non-technical message
 *   • "Reload" button (hard navigation so module-init state resets)
 *   • "Go to home" link (navigates back to / without reload)
 *
 * Design rules
 *   • No imports from dashboard graph — this component must
 *     be importable even when the dashboard bundle is broken.
 *   • No hooks — class component so it can catch render errors.
 *   • No external styling deps — inline styles only.
 */

import { Component } from 'react';

const S = {
  shell: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(180deg, #0b2d2a 0%, #021a19 100%)',
    color: '#e8f5e9',
    padding: '24px',
    textAlign: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxSizing: 'border-box',
  },
  icon: { fontSize: '48px', marginBottom: '16px' },
  heading: { fontSize: '22px', fontWeight: '600', marginBottom: '10px', color: '#e8f5e9' },
  sub: { fontSize: '15px', color: 'rgba(232,245,233,0.60)', marginBottom: '28px', maxWidth: '320px' },
  primary: {
    background: 'linear-gradient(135deg,#C8944D,#B9853F)',
    border: 'none',
    borderRadius: '30px',
    padding: '13px 28px',
    fontSize: '15px',
    fontWeight: '700',
    color: '#042c1a',
    cursor: 'pointer',
    marginBottom: '12px',
    display: 'block',
    width: '200px',
    textAlign: 'center',
  },
  secondary: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '30px',
    padding: '10px 20px',
    fontSize: '14px',
    color: 'rgba(232,245,233,0.68)',
    cursor: 'pointer',
    display: 'block',
    width: '200px',
    textAlign: 'center',
    textDecoration: 'none',
  },
  detail: {
    marginTop: '32px',
    fontSize: '11px',
    color: 'rgba(232,245,233,0.25)',
    fontFamily: 'monospace',
    maxWidth: '380px',
    wordBreak: 'break-all',
    whiteSpace: 'pre-wrap',
    textAlign: 'left',
    background: 'rgba(0,0,0,0.2)',
    padding: '10px',
    borderRadius: '8px',
  },
};

export class DashboardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, errorMsg: '', errorStack: '' };
  }

  static getDerivedStateFromError(err) {
    return {
      crashed:    true,
      errorMsg:   err && err.message ? err.message : String(err),
      errorStack: err && err.stack   ? err.stack   : '',
    };
  }

  componentDidCatch(err, info) {
    // Fire a lightweight analytics event so the crash is recorded
    // even when the main analytics pipeline is part of the failure.
    try {
      const payload = {
        message:   err && err.message ? err.message : String(err),
        component: info && info.componentStack
          ? info.componentStack.trim().split('\n')[1] || 'unknown'
          : 'unknown',
        source: 'DashboardErrorBoundary',
      };
      // Try canonical pipeline first, then local store, then no-op.
      import('../../lib/analytics.js')
        .then((m) => { try { m.safeTrackEvent?.('app_error', payload); } catch { /* ignore */ } })
        .catch(() => {
          try { import('../../analytics/analyticsStore.js')
            .then((m) => { try { m.trackEvent?.('app_error', payload); } catch { /* ignore */ } })
            .catch(() => { /* give up */ });
          } catch { /* ignore */ }
        });
    } catch { /* analytics must never block recovery */ }
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    const isDev = typeof process !== 'undefined'
      && process.env
      && process.env.NODE_ENV !== 'production';

    return (
      <div style={S.shell} data-testid="dashboard-error-boundary">
        <div style={S.icon} aria-hidden="true">🌱</div>

        <h1 style={S.heading}>Something went wrong</h1>
        <p style={S.sub}>
          Farroway hit an unexpected error loading your dashboard.
          Reloading usually fixes it.
        </p>

        <button
          style={S.primary}
          onClick={() => window.location.reload()}
          aria-label="Reload page"
        >
          Reload
        </button>

        <a href="/" style={S.secondary} aria-label="Go to home">
          Go to home
        </a>

        {isDev && this.state.errorMsg && (
          <pre style={S.detail}>
            {this.state.errorMsg}
            {'\n\n'}
            {this.state.errorStack.slice(0, 800)}
          </pre>
        )}
      </div>
    );
  }
}

export default DashboardErrorBoundary;
