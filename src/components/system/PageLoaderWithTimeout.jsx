/**
 * src/components/system/PageLoaderWithTimeout.jsx — wave audit fix.
 *
 * Replaces the brand-only PageLoader with a self-timing variant
 * that flips to a recovery UI after 5 seconds. Mounts INSIDE the
 * top-level <Suspense fallback={…}> so its timer fires regardless
 * of which lazy chunk is still in flight.
 *
 * Why this exists
 * ───────────────
 * Pre-fix root cause: the outer Suspense fallback was a static
 * `<PageLoader />`. While a lazy import (e.g. ScanPage's chunk)
 * was downloading on a flaky iPhone Safari connection, the
 * fallback rendered indefinitely. The inner SafeRouteShell's
 * 5s timeout never fired because its useEffect cannot run until
 * its children (suspended on the lazy chunk) actually mount.
 *
 * Fix: put the timeout INSIDE the Suspense fallback itself.
 * After `timeoutMs` (default 5000), the loader flips to a
 * recovery panel with three buttons:
 *
 *   • Try again      → reload the route
 *   • Upload photo   → /scan?intent=upload  (scan-specific fallback)
 *   • Go Home        → /home
 *
 * Strict-rule audit
 *   • Pure render + 1 useEffect. SSR-safe (uses guarded window).
 *   • No state mutation outside the component.
 *   • Inline styles only. No theme dependency.
 *   • Never crashes — every action wrapped in try/catch.
 *   • Pins window.__scanSpinnerTimeoutFired flag on timeout so
 *     the wave-audit diagnostic can attest the route recovered.
 */

import React, { useEffect, useState } from 'react';

const DEFAULT_TIMEOUT_MS = 5000;

function _safe(fn) { try { return fn(); } catch { return null; } }

function _markTimeout(routeHint) {
  _safe(() => {
    if (typeof window === 'undefined') return;
    const w = window;
    w.__scanSpinnerTimeoutFired = true;
    w.__lastLoaderTimeoutAt = new Date().toISOString();
    w.__lastLoaderTimeoutRoute = String(routeHint || '');
  });
}

function _currentPath() {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.location) return '';
    return String(window.location.pathname || '');
  }) || '';
}

function _isScanRoute() {
  return /^\/scan(\/|$|\?)/.test(_currentPath());
}

function _retry() {
  _safe(() => {
    if (typeof window === 'undefined') return;
    window.location.reload();
  });
}

function _goHome() {
  _safe(() => {
    if (typeof window === 'undefined') return;
    window.location.assign('/home');
  });
}

function _goUpload() {
  _safe(() => {
    if (typeof window === 'undefined') return;
    // Scan-specific: deep-link to upload-intent on the scan page
    // so the next attempt skips camera-mount and goes straight
    // to the file picker fallback.
    window.location.assign('/scan?intent=upload');
  });
}

export default function PageLoaderWithTimeout({ timeoutMs }) {
  const [timedOut, setTimedOut] = useState(false);
  const ms = Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS;

  useEffect(() => {
    const path = _currentPath();
    let t = null;
    try {
      t = setTimeout(() => {
        _markTimeout(path);
        setTimedOut(true);
      }, ms);
    } catch { /* swallow */ }
    return () => { try { if (t) clearTimeout(t); } catch {} };
  }, [ms]);

  if (timedOut) {
    const scanCtx = _isScanRoute();
    const heading = scanCtx
      ? 'Scan is taking too long to load.'
      : 'This page is taking too long to load.';
    return (
      <div
        style={S.page}
        role="alert"
        data-testid="page-loader-timeout"
      >
        <div style={S.card}>
          <div style={S.icon} aria-hidden="true">⏱️</div>
          <h1 style={S.heading}>{heading}</h1>
          <p style={S.body}>
            Your data is safe. Choose what to do next.
          </p>
          <div style={S.btnRow}>
            <button
              type="button"
              style={S.primary}
              onClick={_retry}
              data-testid="page-loader-timeout-retry"
            >
              Try again
            </button>
            {scanCtx && (
              <button
                type="button"
                style={S.secondary}
                onClick={_goUpload}
                data-testid="page-loader-timeout-upload"
              >
                Upload photo
              </button>
            )}
            <button
              type="button"
              style={S.ghost}
              onClick={_goHome}
              data-testid="page-loader-timeout-home"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.spin} data-testid="page-loader-spinner">
      <div style={S.spinInner}>
        <div style={S.spinner} />
        <span style={S.brand}>Farroway</span>
      </div>
    </div>
  );
}

const C = {
  bg:     '#F6F1E7',
  ink:    '#1F2933',
  accent: '#C8944D',
  border: 'rgba(36,49,58,0.10)',
  inkDim: 'rgba(36,49,58,0.65)',
};

const S = {
  spin: {
    minHeight: '100vh', background: C.bg, color: C.ink,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  spinInner: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '0.75rem',
  },
  spinner: {
    width: '2rem', height: '2rem',
    border: '3px solid '+C.border,
    borderTopColor: C.accent,
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  brand: {
    fontSize: '1.25rem', fontWeight: 700, color: C.ink,
  },
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
  secondary: {
    padding: '12px 20px', borderRadius: 12,
    border: '1px solid '+C.accent,
    background: 'transparent', color: C.accent,
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
