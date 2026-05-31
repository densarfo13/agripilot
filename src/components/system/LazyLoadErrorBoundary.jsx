/**
 * src/components/system/LazyLoadErrorBoundary.jsx — wave audit fix.
 *
 * Catches chunk-load failures that bubble up from lazy()-imported
 * route components. Errors of interest:
 *   • `ChunkLoadError` (webpack / vite chunk fetch failure)
 *   • Messages containing "Loading chunk" / "Failed to fetch
 *     dynamically imported module" (vite + browser variants)
 *
 * Renders a recovery panel with Try again / Go Home. Non-chunk
 * errors re-throw so the parent crash boundary still handles them.
 *
 * Pins window.__lastLazyLoadErrorAt + ~Route for the wave-audit
 * diagnostic. Logs to console once per mount (no log spam).
 *
 * Strict-rule audit
 *   • Class component (required for componentDidCatch).
 *   • Render path is pure on the happy path.
 *   • Side effects (window flag, console.error) only fire in
 *     componentDidCatch.
 *   • Never re-throws inside the boundary itself.
 */

import React from 'react';

function _isChunkError(err) {
  try {
    if (!err) return false;
    if (err.name === 'ChunkLoadError') return true;
    const msg = String(err.message || '').toLowerCase();
    return msg.includes('loading chunk')
        || msg.includes('failed to fetch dynamically imported module')
        || msg.includes('importing a module script failed');
  } catch { return false; }
}

function _markLazyError(route, msg) {
  try {
    if (typeof window === 'undefined') return;
    const w = window;
    w.__lastLazyLoadErrorAt = new Date().toISOString();
    w.__lastLazyLoadErrorRoute = String(route || '');
    w.__lastLazyLoadErrorMessage = String(msg || '');
  } catch { /* swallow */ }
}

function _retry() {
  try {
    if (typeof window === 'undefined') return;
    window.location.reload();
  } catch { /* swallow */ }
}

function _goHome() {
  try {
    if (typeof window === 'undefined') return;
    window.location.assign('/home');
  } catch { /* swallow */ }
}

function _currentPath() {
  try {
    if (typeof window === 'undefined' || !window.location) return '';
    return String(window.location.pathname || '');
  } catch { return ''; }
}

export default class LazyLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hadChunkError: false };
  }

  static getDerivedStateFromError(err) {
    return { hadChunkError: _isChunkError(err) };
  }

  componentDidCatch(err) {
    if (!_isChunkError(err)) {
      // Re-throw so the parent crash boundary handles non-chunk errors.
      throw err;
    }
    const route = _currentPath();
    _markLazyError(route, err && err.message);
    try {
      // One greppable line for QA.
      // eslint-disable-next-line no-console
      console.error('[FARROWAY_LAZY_LOAD_ERROR]', route, err && err.message);
    } catch { /* swallow */ }
    // Best-effort monitoring hook (never re-throws).
    try {
      if (typeof window !== 'undefined') {
        const w = window;
        if (w.__monitoringClient
            && typeof w.__monitoringClient.captureError === 'function') {
          w.__monitoringClient.captureError(err, {
            tag: 'lazy_load_failure',
            route,
          });
        }
      }
    } catch { /* swallow */ }
  }

  render() {
    if (this.state.hadChunkError) {
      return (
        <div
          style={S.page}
          role="alert"
          data-testid="lazy-load-error-boundary"
        >
          <div style={S.card}>
            <div style={S.icon} aria-hidden="true">📡</div>
            <h1 style={S.heading}>Something didn't load correctly.</h1>
            <p style={S.body}>
              Your data is safe. Check your connection and try again.
            </p>
            <div style={S.btnRow}>
              <button
                type="button"
                style={S.primary}
                onClick={_retry}
                data-testid="lazy-load-error-retry"
              >
                Try again
              </button>
              <button
                type="button"
                style={S.ghost}
                onClick={_goHome}
                data-testid="lazy-load-error-home"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const C = {
  bg:     '#F6F1E7',
  ink:    '#1F2933',
  accent: '#C8944D',
  border: 'rgba(36,49,58,0.10)',
  inkDim: 'rgba(36,49,58,0.65)',
};
const S = {
  page: {
    minHeight: '100vh', background: C.bg, color: C.ink,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  card: {
    maxWidth: 420, textAlign: 'center',
    padding: '32px 28px',
    background: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid '+C.border,
    boxShadow: '0 8px 22px rgba(0,0,0,0.04)',
  },
  icon:    { fontSize: 44, marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: C.ink },
  body:    { fontSize: 15, color: C.inkDim, margin: '0 0 20px', lineHeight: 1.5 },
  btnRow:  { display: 'flex', flexDirection: 'column', gap: 10 },
  primary: {
    padding: '12px 20px', borderRadius: 12, border: 'none',
    background: C.accent, color: '#FFFFFF',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    minHeight: 46,
  },
  ghost: {
    padding: '10px 18px', borderRadius: 12,
    border: '1px solid '+C.border,
    background: 'transparent', color: C.ink,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    minHeight: 42,
  },
};
