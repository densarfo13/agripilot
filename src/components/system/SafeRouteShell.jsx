/**
 * SafeRouteShell — per-route error boundary + loading guard.
 *
 * Wraps a single route's content to:
 *   1. Catch render errors (via class-based error boundary).
 *   2. Detect loading deadlocks (via useLoadingGuard — 8 s timeout).
 *   3. Never redirect if user/auth state is missing — shows a safe
 *      fallback instead to avoid redirect loops.
 *   4. Never return a blank page.
 *
 * USAGE
 * ─────
 *   // In App.jsx route definitions:
 *   <Route path="/tasks" element={
 *     <SafeRouteShell routeName="tasks">
 *       <TasksPage />
 *     </SafeRouteShell>
 *   } />
 *
 *   // With a custom fallback:
 *   <SafeRouteShell routeName="scan" FallbackComponent={ScanFallback}>
 *     <ScanPage />
 *   </SafeRouteShell>
 *
 * PROPS
 * ─────
 *   routeName        {string}    — used in error logs and test ids
 *   children         {ReactNode}
 *   FallbackComponent {Component} — optional custom error fallback
 *   loadingMs        {number}    — loading timeout in ms (default 8000)
 *
 * STRICT-RULE AUDIT
 * ─────────────────
 *   • Class component for error boundary; function component inner
 *     wrapper for hooks. Both are unconditional.
 *   • Never calls navigate() — only renders fallback UI.
 *   • Inline styles only.
 */

import { Component, useState, useEffect, useRef } from 'react';

// ─── Inner loading guard (function component — can use hooks) ─────
const DEFAULT_LOADING_TIMEOUT_MS = 8_000;

function RouteLoadingGuard({ children, routeName, loadingMs }) {
  const timeout = Number.isFinite(loadingMs) ? loadingMs : DEFAULT_LOADING_TIMEOUT_MS;
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Clear any previous timer when the component mounts or routeName changes.
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimedOut(false);

    timerRef.current = setTimeout(() => {
      // Only trigger if we can inspect the DOM and the route is still loading.
      try {
        const root = document.getElementById('root');
        const text = root ? root.innerText : '';
        // Heuristic: if the page has < 20 chars of text after the timeout,
        // it's likely still in an infinite loading state.
        if (text && text.trim().length < 20) {
          setTimedOut(true);
        }
      } catch { /* swallow — never crash the guard */ }
    }, timeout);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeout, routeName]);

  if (timedOut) {
    return (
      <div
        style={S.timeout}
        role="alert"
        data-testid={`route-timeout-${routeName || 'unknown'}`}
      >
        <div style={S.timeoutIcon}>⏱️</div>
        <h2 style={S.timeoutHeading}>Taking too long</h2>
        <p style={S.timeoutBody}>
          This page didn't load in time. Check your connection and try again.
        </p>
        <div style={S.btnRow}>
          <button
            type="button"
            style={S.primary}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <a href="/home" style={S.ghost}>Go to Home</a>
        </div>
      </div>
    );
  }

  return children;
}

// ─── Error boundary (class component — can use getDerivedStateFromError) ─
export class SafeRouteShell extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, errorMsg: '', errorStack: '' };
    this._handleReset = this._handleReset.bind(this);
  }

  static getDerivedStateFromError(err) {
    return {
      crashed:    true,
      errorMsg:   err?.message ? String(err.message) : String(err),
      errorStack: err?.stack   ? String(err.stack)   : '',
    };
  }

  componentDidCatch(err, info) {
    try {
      const routeName = this.props.routeName || 'unknown';
      const payload = {
        message:   err?.message ?? String(err),
        component: info?.componentStack?.trim().split('\n')[1]?.trim() || 'unknown',
        route:     routeName,
        source:    'SafeRouteShell',
      };
      import('../../lib/analytics.js')
        .then((m) => { try { m.safeTrackEvent?.('app_error', payload); } catch { /* ignore */ } })
        .catch(() => { /* never re-throw into crashed boundary */ });
    } catch { /* ignore */ }
  }

  _handleReset() {
    this.setState({ crashed: false, errorMsg: '', errorStack: '' });
  }

  render() {
    const { routeName = 'unknown', children, FallbackComponent, loadingMs } = this.props;

    if (this.state.crashed) {
      if (FallbackComponent) {
        return <FallbackComponent error={this.state.errorMsg} onReset={this._handleReset} />;
      }
      return (
        <DefaultRouteFallback
          routeName={routeName}
          errorMsg={this.state.errorMsg}
          errorStack={this.state.errorStack}
          onReset={this._handleReset}
        />
      );
    }

    return (
      <RouteLoadingGuard routeName={routeName} loadingMs={loadingMs}>
        {children}
      </RouteLoadingGuard>
    );
  }
}

// ─── Default fallback UI ──────────────────────────────────────────
function DefaultRouteFallback({ routeName, errorMsg, errorStack, onReset }) {
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;
  return (
    <div style={S.fallback} data-testid={`route-fallback-${routeName}`}>
      <div style={S.icon}>🌿</div>
      <h2 style={S.heading}>Couldn't load this page</h2>
      <p style={S.body}>
        Something went wrong on the <strong>{routeName}</strong> page.
        Your farm data is safe — try going back or reloading.
      </p>
      <div style={S.btnRow}>
        <button type="button" style={S.primary} onClick={onReset}>Try again</button>
        <a href="/home" style={S.ghost}>Home</a>
        <button type="button" style={S.ghost} onClick={() => window.history.back()}>Back</button>
      </div>
      {isDev && errorMsg && (
        <pre style={S.detail}>
          {errorMsg}{'\n\n'}{errorStack.slice(0, 1000)}
        </pre>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const S = {
  fallback: {
    minHeight:     '60vh',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    justifyContent:'center',
    padding:       '32px 24px',
    textAlign:     'center',
    color:         '#fff',
    fontFamily:    'Inter, system-ui, -apple-system, sans-serif',
  },
  timeout: {
    minHeight:     '60vh',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    justifyContent:'center',
    padding:       '32px 24px',
    textAlign:     'center',
    color:         '#fff',
    fontFamily:    'Inter, system-ui, -apple-system, sans-serif',
    background:    'rgba(0,0,0,0.08)',
    borderRadius:  '20px',
  },
  icon:          { fontSize: '44px', marginBottom: '14px' },
  timeoutIcon:   { fontSize: '44px', marginBottom: '14px' },
  heading:       { fontSize: '18px', fontWeight: 700, margin: '0 0 8px' },
  timeoutHeading:{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' },
  body:          { fontSize: '15px', color: 'rgba(255,255,255,0.65)', margin: '0 0 24px', lineHeight: 1.5 },
  timeoutBody:   { fontSize: '15px', color: 'rgba(255,255,255,0.65)', margin: '0 0 24px', lineHeight: 1.5 },
  btnRow:        { display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' },
  primary: {
    padding: '12px 24px', borderRadius: '30px', border: 'none',
    background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#042c1a',
    fontSize: '15px', fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', minHeight: 44,
  },
  ghost: {
    padding: '10px 20px', borderRadius: '30px',
    border: '1px solid rgba(255,255,255,0.22)', background: 'transparent',
    color: 'rgba(255,255,255,0.78)', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none', display: 'inline-flex',
    alignItems: 'center', minHeight: 42,
  },
  detail: {
    marginTop: '20px', padding: '10px 12px', background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px', fontFamily: 'monospace', fontSize: '11px',
    color: 'rgba(255,255,255,0.3)', maxWidth: '400px',
    wordBreak: 'break-all', whiteSpace: 'pre-wrap', textAlign: 'left',
  },
};

export default SafeRouteShell;
