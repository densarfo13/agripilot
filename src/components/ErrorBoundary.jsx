/**
 * ErrorBoundary — catches React render crashes and shows a recovery screen.
 *
 * Without this, any unhandled error in a child component renders a white
 * screen with no explanation. This boundary shows a friendly message
 * and a reload button so the farmer can recover.
 */
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // HOTFIX (Apr 2026): the previous version used CommonJS
    // `require('../lib/analytics.js')` inside an ES-module project —
    // throws `ReferenceError: require is not defined` at runtime,
    // masking the original error and (in some bundlers) breaking
    // the recovery render. Switch to a fire-and-forget dynamic
    // import so the error boundary never trips its own analytics.
    try {
      import('../lib/analytics.js')
        .then((mod) => {
          try {
            mod.safeTrackEvent?.('app.crash', {
              error: error?.message,
              stack: info?.componentStack?.slice(0, 500),
            });
          } catch { /* analytics never critical */ }
        })
        .catch(() => { /* swallow */ });
    } catch { /* never propagate from a catch handler */ }

    try { console.error('[ErrorBoundary] Caught error:', error, info); }
    catch { /* console missing in some sandboxes */ }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={S.page}>
          <div style={S.card}>
            <span style={S.icon}>{'\u26A0\uFE0F'}</span>
            <h1 style={S.title}>Something went wrong</h1>
            <p style={S.desc}>
              The app ran into a problem. Your data is safe.
            </p>
            <button onClick={this.handleReload} style={S.btn}>
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  card: {
    textAlign: 'center',
    maxWidth: '22rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  icon: { fontSize: '3rem' },
  title: { fontSize: '1.375rem', fontWeight: 700, margin: 0 },
  desc: {
    fontSize: '0.9375rem', color: 'rgba(255,255,255,0.6)',
    margin: 0, lineHeight: 1.5,
  },
  btn: {
    padding: '0.875rem 2rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
  },
};
