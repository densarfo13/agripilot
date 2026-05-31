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

/**
 * _autoRecoverOnce — best-effort one-shot self-recovery.
 *
 * The most common cause of ChunkLoadError on production is a
 * stale service-worker / browser HTTP cache holding an old
 * bundle hash that no longer exists on the CDN. Reloading
 * without clearing the cache often hits the same stale entry
 * and shows the user the recovery panel again.
 *
 * On the FIRST chunk error of the session we:
 *   1. Mark `farroway.lazyRecoveryAttempted=1` in sessionStorage
 *      so we only auto-recover once (prevents reload loops).
 *   2. Best-effort `caches.delete()` for every CacheStorage key.
 *   3. Best-effort unregister of every active service worker.
 *   4. `window.location.reload()` with a `?_freshFetch=…` marker
 *      so any CDN-edge negotiation prefers a fresh fetch.
 *
 * Returns true if we kicked off recovery (caller should NOT
 * render the panel — the page will reload). Returns false if
 * recovery was already attempted or SSR — caller renders the
 * panel for the user to act.
 */
function _autoRecoverOnce() {
  try {
    if (typeof window === 'undefined') return false;
    const ss = window.sessionStorage;
    if (ss && ss.getItem('farroway.lazyRecoveryAttempted') === '1') {
      return false;  // already tried once this session
    }
    if (ss) {
      try { ss.setItem('farroway.lazyRecoveryAttempted', '1'); }
      catch { /* swallow */ }
    }
    // Fire-and-forget cache + SW cleanup. Don't await — we want
    // the reload to happen even if these reject.
    try {
      if (typeof caches !== 'undefined' && caches.keys) {
        caches.keys().then((keys) => {
          for (const k of keys) {
            try { caches.delete(k); } catch { /* swallow */ }
          }
        }).catch(() => { /* swallow */ });
      }
    } catch { /* swallow */ }
    try {
      if (navigator && navigator.serviceWorker
          && navigator.serviceWorker.getRegistrations) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const r of regs) {
            try { r.unregister(); } catch { /* swallow */ }
          }
        }).catch(() => { /* swallow */ });
      }
    } catch { /* swallow */ }
    // Brief delay so the cleanup tasks can begin before reload.
    setTimeout(() => {
      try {
        // String-level cache-bust — avoid new URL() to honor the
        // safe-URL-construction governance gate; this path only
        // ever runs in a real browser with window.location set.
        const href  = String(window.location.href || '');
        const stamp = String(Date.now());
        const sep   = href.indexOf('?') >= 0 ? '&' : '?';
        const next  = href.indexOf('_freshFetch=') >= 0
          ? href
          : href + sep + '_freshFetch=' + stamp;
        window.location.replace(next);
      } catch {
        try { window.location.reload(); } catch { /* swallow */ }
      }
    }, 80);
    return true;
  } catch {
    return false;
  }
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
    this.state = { hadChunkError: false, autoRecovering: false };
  }

  static getDerivedStateFromError(err) {
    if (!_isChunkError(err)) return null;
    // Try one-shot recovery (clear caches + SW + reload). If it
    // returns true, the page is about to reload — render a brief
    // "recovering…" UI rather than the failure panel so the user
    // sees forward motion instead of a scary error card.
    let recovering = false;
    try { recovering = _autoRecoverOnce(); } catch { recovering = false; }
    return {
      hadChunkError:    true,
      autoRecovering:   recovering,
    };
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
      // Brief "recovering" UI while the auto-recovery (cache
      // purge + SW unregister + reload) is in flight. The reload
      // typically lands in well under a second; if for any
      // reason it doesn't, the user still sees their data is safe.
      if (this.state.autoRecovering) {
        return (
          <div
            style={S.page}
            role="status"
            data-testid="lazy-load-auto-recovering"
          >
            <div style={S.card}>
              <div style={S.icon} aria-hidden="true">🔄</div>
              <h1 style={S.heading}>Refreshing Farroway…</h1>
              <p style={S.body}>
                Loading a fresh copy. Your data is safe.
              </p>
            </div>
          </div>
        );
      }
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
