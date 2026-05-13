/**
 * RouteErrorBoundary — per-route error isolation so a crash on
 * one tab degrades to a small in-route fallback instead of
 * unmounting the whole app.
 *
 *   <RouteErrorBoundary routeName="home">
 *     <DashboardPage />
 *   </RouteErrorBoundary>
 *
 * Behaviour
 *   • Catches synchronous render throws inside the wrapped tree.
 *   • Logs `[FARROWAY_CRASH][<routeName>_route_error]` to the
 *     console and fires `route_render_error` analytics with the
 *     route name + truncated message.
 *   • Renders a minimal fallback card with the route name and
 *     a "Reload" button. Bottom-nav stays mounted because this
 *     boundary lives INSIDE the layout shell.
 *
 * Why scoped per route
 *   The global ErrorBoundary in main.jsx surfaces a full-page
 *   recovery card. That's the right surface for a fatal bootstrap
 *   crash. For a per-tab render failure (e.g. Tasks throws on a
 *   stale row) we want the user to keep their nav, switch tabs,
 *   and come back — exactly what this boundary enables.
 *
 * Strict-rule audit
 *   • Pure React class. Never throws inside its own catch.
 *   • Lazy-imports analytics so a missing module never blocks
 *     the crash path.
 *   • Inline styles only.
 */

import React from 'react';

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError:    true,
      errorMessage: error && error.message
        ? String(error.message).slice(0, 200)
        : 'unknown',
    };
  }

  componentDidCatch(error, info) {
    const route = String(this.props.routeName || 'unknown');
    try {
       
      console.error('[FARROWAY_CRASH][' + route + '_route_error]',
        error && error.message ? error.message : error,
        info && info.componentStack ? info.componentStack.slice(0, 500) : '');
    } catch { /* swallow */ }

    try {
      import('../../lib/analytics.js')
        .then((mod) => {
          try {
            if (mod && typeof mod.safeTrackEvent === 'function') {
              mod.safeTrackEvent('route_render_error', {
                route,
                message: error && error.message
                  ? String(error.message).slice(0, 200) : 'unknown',
                componentStack: info && info.componentStack
                  ? String(info.componentStack).slice(0, 500) : null,
              });
            }
          } catch { /* never propagate */ }
        })
        .catch(() => { /* tolerate */ });
    } catch { /* never throw from a catch */ }
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: null });
    try {
      if (typeof window !== 'undefined' && window.location
          && typeof window.location.reload === 'function') {
        window.location.reload();
      }
    } catch { /* never throw */ }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const route = String(this.props.routeName || 'this page');
    return (
      <main
        style={S.page}
        data-testid="route-error-fallback"
        data-route={route}
      >
        <div style={S.card}>
          <h2 style={S.title}>{`We hit a problem on ${route}`}</h2>
          <p style={S.body}>
            You can keep using the rest of the app. Reload to try this
            page again.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={S.btn}
            data-testid="route-error-reload"
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
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
    maxWidth: '24rem',
    background: 'var(--card-bg, rgba(255,255,255,0.06))',
    border: '1px solid var(--card-border, rgba(255,255,255,0.12))',
    borderRadius: 16,
    padding: '1.5rem 1.25rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  title: { margin: 0, fontSize: '1.05rem', fontWeight: 800 },
  body:  { margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary, rgba(255,255,255,0.75))', lineHeight: 1.5 },
  btn: {
    marginTop: 6,
    border: 'none',
    borderRadius: 12,
    background: 'var(--role-accent, #2ecc71)',
    color: 'var(--role-accent-ink, #042c1a)',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
