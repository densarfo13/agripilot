/**
 * AppCrashBoundary — global React error boundary for the entire app tree.
 *
 * Sits INSIDE the router (so <Link> works in the recovery UI) but
 * OUTSIDE every page-level boundary, so it catches anything that
 * escapes the per-route boundaries.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 *   • Preserves the navigation shell (bottom nav + header) so the
 *     user can switch to a working route without a reload.
 *   • Never returns a blank page. Always renders visible recovery UI.
 *   • Logs the crashed route + component to the error service.
 *   • Shows the raw error message in dev only.
 *   • Resets itself when the route changes (navigation recovery).
 *
 * WHAT IT CATCHES
 * ───────────────
 *   Any synchronous render error in its children that has NOT been
 *   caught by a closer boundary (RouteErrorBoundary, FeatureShell, etc).
 *   Does NOT catch: async errors, event handler errors, rejected promises.
 *   Use safeAsync() + useLoadingGuard() for those.
 *
 * STRICT-RULE AUDIT
 * ─────────────────
 *   • Class component — required to use getDerivedStateFromError.
 *   • No hooks (class component constraint).
 *   • Inline styles only — no CSS-module or theme dependency can cause
 *     a secondary crash here.
 *   • Analytics fired via dynamic import so analytics errors cannot
 *     propagate back into an already-crashed boundary.
 */

import { Component } from 'react';

// ─── Styles ───────────────────────────────────────────────────────
const S = {
  overlay: {
    position:      'fixed',
    inset:         0,
    background:    'linear-gradient(180deg, #0b1d34 0%, #081423 100%)',
    color:         '#ffffff',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    justifyContent:'center',
    padding:       '24px',
    zIndex:        9999,
    fontFamily:    'Inter, system-ui, -apple-system, sans-serif',
    textAlign:     'center',
  },
  icon:    { fontSize: '52px', marginBottom: '16px' },
  heading: { fontSize: '20px', fontWeight: 700, margin: '0 0 10px', color: '#fff' },
  sub:     { fontSize: '15px', color: 'rgba(255,255,255,0.65)', margin: '0 0 28px', maxWidth: '340px', lineHeight: 1.5 },
  navRow:  { display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' },
  primary: {
    padding:      '13px 26px',
    borderRadius: '30px',
    border:       'none',
    background:   'linear-gradient(135deg, #22c55e, #16a34a)',
    color:        '#042c1a',
    fontSize:     '15px',
    fontWeight:   700,
    cursor:       'pointer',
    minHeight:    46,
    textDecoration: 'none',
    display:      'inline-flex',
    alignItems:   'center',
  },
  ghost: {
    padding:      '11px 22px',
    borderRadius: '30px',
    border:       '1px solid rgba(255,255,255,0.22)',
    background:   'transparent',
    color:        'rgba(255,255,255,0.78)',
    fontSize:     '14px',
    fontWeight:   600,
    cursor:       'pointer',
    minHeight:    44,
    textDecoration: 'none',
    display:      'inline-flex',
    alignItems:   'center',
  },
  detail: {
    marginTop:   '24px',
    padding:     '12px 14px',
    background:  'rgba(0,0,0,0.3)',
    borderRadius:'10px',
    fontFamily:  'monospace',
    fontSize:    '11px',
    color:       'rgba(255,255,255,0.35)',
    maxWidth:    '420px',
    wordBreak:   'break-all',
    whiteSpace:  'pre-wrap',
    textAlign:   'left',
  },
  route: {
    marginTop:  '10px',
    fontSize:   '11px',
    fontFamily: 'monospace',
    color:      'rgba(255,255,255,0.3)',
  },
};

// ─── Component ────────────────────────────────────────────────────
export class AppCrashBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      crashed:    false,
      errorMsg:   '',
      errorStack: '',
      crashRoute: '',
    };
    this._handleReset = this._handleReset.bind(this);
  }

  static getDerivedStateFromError(err) {
    const route = (() => {
      try { return window.location.pathname; } catch { return '(unknown)'; }
    })();
    return {
      crashed:    true,
      errorMsg:   err?.message ? String(err.message) : String(err),
      errorStack: err?.stack   ? String(err.stack)   : '',
      crashRoute: route,
    };
  }

  componentDidCatch(err, info) {
    // Fire error analytics via dynamic import — never throws back.
    try {
      const payload = {
        message:   err?.message ?? String(err),
        component: info?.componentStack
          ? info.componentStack.trim().split('\n')[1]?.trim() || 'unknown'
          : 'unknown',
        route:     this.state.crashRoute || '(unknown)',
        source:    'AppCrashBoundary',
      };

      import('../../lib/analytics.js')
        .then((m) => { try { m.safeTrackEvent?.('app_error', payload); } catch { /* ignore */ } })
        .catch(() => { /* analytics must never re-throw into a crashed boundary */ });

      // Also POST to error service (best-effort).
      import('../../api/client.js')
        .then((m) => {
          try {
            m.default?.post?.('/api/errors', {
              ...payload,
              stack: err?.stack?.slice(0, 2000) || '',
            }).catch(() => { /* ignore */ });
          } catch { /* ignore */ }
        })
        .catch(() => { /* ignore */ });
    } catch { /* analytics must never block recovery */ }
  }

  // When the user navigates to a different route, reset the
  // boundary so the new page gets a clean render attempt.
  static getDerivedStateFromProps(props, state) {
    if (state.crashed && props.routeKey && props.routeKey !== state._routeKey) {
      return {
        crashed:    false,
        errorMsg:   '',
        errorStack: '',
        crashRoute: '',
        _routeKey:  props.routeKey,
      };
    }
    return null;
  }

  _handleReset() {
    this.setState({ crashed: false, errorMsg: '', errorStack: '', crashRoute: '' });
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    const isDev = typeof import.meta !== 'undefined'
      && import.meta.env?.DEV === true;

    return (
      <div style={S.overlay} role="alert" data-testid="app-crash-boundary">
        <div style={S.icon} aria-hidden="true">🌱</div>

        <h1 style={S.heading}>Something went wrong</h1>
        <p style={S.sub}>
          Farroway hit an unexpected error. Use the buttons below to
          navigate to a working page — your farm data is safe.
        </p>

        <div style={S.navRow}>
          <a href="/home" style={S.primary}>
            Go to Home
          </a>
          <button
            style={S.ghost}
            onClick={this._handleReset}
            type="button"
          >
            Try again
          </button>
          <button
            style={S.ghost}
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload page
          </button>
        </div>

        <div style={S.navRow}>
          <a href="/my-farm"  style={S.ghost}>My Farm</a>
          <a href="/tasks"    style={S.ghost}>Tasks</a>
          <a href="/progress" style={S.ghost}>Progress</a>
        </div>

        {isDev && this.state.errorMsg && (
          <pre style={S.detail}>
            {this.state.errorMsg}
            {'\n\n'}
            {this.state.errorStack.slice(0, 1200)}
          </pre>
        )}

        <div style={S.route}>
          Crashed at: {this.state.crashRoute || '(unknown route)'}
        </div>
      </div>
    );
  }
}

export default AppCrashBoundary;
