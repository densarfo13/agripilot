/**
 * SafeLoader — the canonical "loading can never last forever" surface
 * (spec §2).
 *
 *   <SafeLoader />                         // app-level default
 *   <SafeLoader timeoutMs={8000} title="…" message="…" />
 *   <SafeLoader onRetry={fn} showUpload /> // scan-route variant
 *
 * Behavior
 * ────────
 *   • Shows a calm brand spinner for the first `timeoutMs` (default
 *     5000ms).
 *   • After the timeout it flips to a recovery panel — NEVER an
 *     indefinite spinner. Recovery copy is calm + actionable.
 *   • Buttons: Try Again (reload), Go Home, and an optional Upload
 *     Photo (scan route).
 *
 * The timer is scheduled with setTimeout in a useEffect, so it fires
 * even if the thing being awaited never resolves — the entire reason
 * this component exists. On timeout it stamps
 * window.__safeLoaderRecoveryRendered so __authStartupHealth() can
 * attest a recovery was shown rather than an infinite spinner.
 *
 * Strict-rule audit
 *   • Pure render + one useEffect. SSR-safe (window guarded).
 *   • Inline styles only. No theme dependency, no lazy imports.
 *   • Never throws — every action wrapped in try/catch.
 */

import React, { useEffect, useState } from 'react';

const DEFAULT_TIMEOUT_MS = 5000;

function _safe(fn) { try { return fn(); } catch { return null; } }

function _markRecovery() {
  _safe(() => {
    if (typeof window === 'undefined') return;
    const w = window;
    w.__safeLoaderRecoveryRendered = true;
    w.__lastSafeLoaderRecoveryAt = new Date().toISOString();
  });
}

function _currentPath() {
  return _safe(() => (typeof window !== 'undefined' && window.location
    ? String(window.location.pathname || '') : '')) || '';
}
function _isScanRoute() {
  return /^\/scan(\/|$)/.test(_currentPath());
}

function _retry() {
  _safe(() => { if (typeof window !== 'undefined') window.location.reload(); });
}
function _goHome() {
  _safe(() => { if (typeof window !== 'undefined') window.location.assign('/home'); });
}
function _goUpload() {
  _safe(() => { if (typeof window !== 'undefined') window.location.assign('/scan?intent=upload'); });
}

export default function SafeLoader({
  timeoutMs,
  title,
  message,
  onRetry,
  showUpload,
}) {
  const ms = Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let t = null;
    try {
      t = setTimeout(() => { _markRecovery(); setTimedOut(true); }, ms);
    } catch { /* swallow */ }
    return () => { try { if (t) clearTimeout(t); } catch { /* swallow */ } };
  }, [ms]);

  if (!timedOut) {
    return (
      <div style={S.spin} data-testid="safe-loader-spinner">
        <div style={S.spinInner}>
          <div style={S.spinner} />
          <span style={S.brand}>Farroway</span>
        </div>
      </div>
    );
  }

  const scanCtx = showUpload || _isScanRoute();
  const handleRetry = () => {
    try { if (typeof onRetry === 'function') { onRetry(); return; } } catch { /* fall through */ }
    _retry();
  };

  return (
    <div style={S.page} role="alert" data-testid="safe-loader-recovery">
      <div style={S.card}>
        <div style={S.icon} aria-hidden="true">⏱️</div>
        <h1 style={S.heading}>
          {title || 'Something is taking longer than expected.'}
        </h1>
        <p style={S.body}>
          {message || 'Your data is safe. Choose what to do next.'}
        </p>
        <div style={S.btnRow}>
          <button
            type="button"
            style={S.primary}
            onClick={handleRetry}
            data-testid="safe-loader-retry"
          >
            Try Again
          </button>
          {scanCtx && (
            <button
              type="button"
              style={S.secondary}
              onClick={_goUpload}
              data-testid="safe-loader-upload"
            >
              Upload Photo
            </button>
          )}
          <button
            type="button"
            style={S.ghost}
            onClick={_goHome}
            data-testid="safe-loader-home"
          >
            Go Home
          </button>
        </div>
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
    border: '3px solid ' + C.border,
    borderTopColor: C.accent,
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  brand: { fontSize: '1.25rem', fontWeight: 700, color: C.ink },
  page: {
    minHeight: '100vh', background: C.bg, color: C.ink,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  card: {
    maxWidth: 420, textAlign: 'center', padding: '32px 28px',
    background: '#FFFFFF', borderRadius: 16,
    border: '1px solid ' + C.border,
    boxShadow: '0 8px 22px rgba(0,0,0,0.04)',
  },
  icon:    { fontSize: 44, marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: C.ink },
  body:    { fontSize: 15, color: C.inkDim, margin: '0 0 20px', lineHeight: 1.5 },
  btnRow:  { display: 'flex', flexDirection: 'column', gap: 10 },
  primary: {
    padding: '12px 20px', borderRadius: 12, border: 'none',
    background: C.accent, color: '#FFFFFF',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 46,
  },
  secondary: {
    padding: '12px 20px', borderRadius: 12,
    border: '1px solid ' + C.accent,
    background: 'transparent', color: C.accent,
    fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 46,
  },
  ghost: {
    padding: '10px 18px', borderRadius: 12,
    border: '1px solid ' + C.border,
    background: 'transparent', color: C.ink,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 42,
  },
};
