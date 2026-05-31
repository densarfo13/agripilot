/**
 * src/components/scan/ScanStartupBanner.jsx — wave iOS audit
 * 3-state visible diagnostic banner for real-device scan
 * startup.
 *
 * Mounts globally. Self-hides unless the user is on /scan AND
 * the scan is not yet ready (no camera + no upload fallback).
 *
 * States
 * ──────
 *   State 1 (≥ 600ms AND < 3000ms): "Opening camera…"
 *     Compact ochre banner so the user knows work is happening.
 *     600ms threshold avoids a flash on fast cameras.
 *
 *   State 2 (≥ 3000ms AND < 5000ms): "Camera is taking longer
 *     than expected" — yellow notice with stage + duration.
 *
 *   State 3 (≥ 5000ms OR permissionState === 'denied'):
 *     "Camera unavailable" with three buttons:
 *       • Upload Photo → /scan?intent=upload
 *       • Try Again    → window.location.reload()
 *       • Go Home      → /home
 *
 *   Permission-denied path (anytime permissionState='denied'):
 *     "Camera access is blocked in Safari settings."
 *     + step-by-step instructions to open Settings.
 *
 * Strict-rule audit
 *   • Pure read-only component. Polls __scanStartupHealth() every
 *     500ms (cleaned up on unmount).
 *   • Never throws. Never modifies the scan engine.
 *   • Inline styles only.
 */

import React, { useEffect, useState } from 'react';

const POLL_MS    = 500;
const OPENING_MS = 600;
const WARN_MS    = 3000;
const ERR_MS     = 5000;

function _safe(fn, fb) { try { return fn(); } catch { return fb; } }

function _probe() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window;
    return typeof w.__scanStartupHealth === 'function'
      ? w.__scanStartupHealth() : null;
  }, null);
}

function _isIOS() {
  return _safe(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = String(navigator.userAgent || '');
    return /\b(iPhone|iPad|iPod)\b/.test(ua);
  }, false);
}

function _goUpload() {
  _safe(() => {
    if (typeof window === 'undefined') return;
    window.location.assign('/scan?intent=upload');
  });
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

function _phase(snap) {
  if (!snap || !snap.initialized || !snap.routeLoaded) return null;
  if (snap.scanReady) return null;
  // ─── PERMANENT FIX (mobile-blocker spec §4) ─────────────────
  // Camera warnings ("Opening camera" / "taking longer" /
  // "unavailable" / denied) must NEVER appear before the user taps
  // Take Photo. `cameraRequested` is set ONLY inside the real
  // getUserMedia wrap (i.e. after the tap), so on the idle camera-
  // like shell — where the camera was never started — this returns
  // null and no yellow "runtimeInitialized / taking longer" notice
  // can show on page load. Upload-first shell stays fully usable.
  if (!snap.cameraRequested) return null;
  if (snap.cameraPermissionState === 'denied') return 'denied';
  const dur = typeof snap.startupDurationMs === 'number'
    ? snap.startupDurationMs : 0;
  if (dur >= ERR_MS)     return 'error';
  if (dur >= WARN_MS)    return 'warning';
  if (dur >= OPENING_MS) return 'opening';
  return null;
}

export default function ScanStartupBanner() {
  const [snap, setSnap] = useState(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      try {
        if (!alive) return;
        // Perf — don't poll the startup probe while the tab is hidden.
        if (typeof document !== 'undefined' && document.hidden) return;
        setSnap(_probe());
      } catch { /* swallow */ }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      try { clearInterval(id); } catch { /* swallow */ }
    };
  }, []);

  const phase = _phase(snap);
  if (!phase) return null;

  const dur = (snap && typeof snap.startupDurationMs === 'number')
    ? snap.startupDurationMs : 0;
  const stage = snap && snap.stage ? snap.stage : '';
  const iOS = _isIOS();

  /* ── State: PERMISSION DENIED ──────────────────────────── */
  if (phase === 'denied') {
    return (
      <div
        style={S.wrap}
        role="alert"
        data-testid="scan-startup-denied"
        data-stage={stage}
      >
        <div style={S.cardError}>
          <div style={S.icon} aria-hidden="true">🔒</div>
          <div style={S.text}>
            <div style={S.heading}>Camera access is blocked in Safari settings.</div>
            <div style={S.subtle}>
              {iOS ? (
                <>
                  Open <strong>Settings</strong> → scroll to <strong>Safari</strong>
                  {' '}→ <strong>Camera</strong> → set to <strong>Allow</strong>,
                  then return here and tap <strong>Try Again</strong>.
                </>
              ) : (
                <>
                  Open your browser's site settings for{' '}
                  <strong>farroway.app</strong>, allow camera access, then
                  tap <strong>Try Again</strong>.
                </>
              )}
            </div>
          </div>
          <div style={S.btnRow}>
            <button
              type="button"
              style={S.primary}
              onClick={_goUpload}
              data-testid="scan-startup-upload"
            >
              Upload Photo
            </button>
            <button
              type="button"
              style={S.secondary}
              onClick={_retry}
              data-testid="scan-startup-retry"
            >
              Try Again
            </button>
            <button
              type="button"
              style={S.ghost}
              onClick={_goHome}
              data-testid="scan-startup-home"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── State 3: CAMERA UNAVAILABLE (≥ 5s) ─────────────────── */
  if (phase === 'error') {
    return (
      <div
        style={S.wrap}
        role="alert"
        data-testid="scan-startup-error"
        data-stage={stage}
        data-duration-ms={dur}
      >
        <div style={S.cardError}>
          <div style={S.icon} aria-hidden="true">📷</div>
          <div style={S.text}>
            <div style={S.heading}>Camera unavailable</div>
            <div style={S.subtle}>
              Stage reached: <code style={S.code}>{stage}</code>
              {' · '}<code style={S.code}>{dur}ms</code>
            </div>
          </div>
          <div style={S.btnRow}>
            <button
              type="button"
              style={S.primary}
              onClick={_goUpload}
              data-testid="scan-startup-upload"
            >
              Upload Photo
            </button>
            <button
              type="button"
              style={S.secondary}
              onClick={_retry}
              data-testid="scan-startup-retry"
            >
              Try Again
            </button>
            <button
              type="button"
              style={S.ghost}
              onClick={_goHome}
              data-testid="scan-startup-home"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── State 2: TAKING LONGER (3-5s) ──────────────────────── */
  if (phase === 'warning') {
    return (
      <div
        style={S.wrap}
        role="status"
        data-testid="scan-startup-warning"
        data-stage={stage}
        data-duration-ms={dur}
      >
        <div style={S.cardWarn}>
          <div style={S.icon} aria-hidden="true">⏱️</div>
          <div style={S.text}>
            <div style={S.heading}>Camera is taking longer than expected</div>
            <div style={S.subtle}>
              Stage reached: <code style={S.code}>{stage}</code>
              {' · '}<code style={S.code}>{dur}ms</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── State 1: OPENING (600ms-3s) ────────────────────────── */
  return (
    <div
      style={S.wrap}
      role="status"
      data-testid="scan-startup-opening"
      data-stage={stage}
      data-duration-ms={dur}
    >
      <div style={S.cardOpening}>
        <div style={S.spinner} aria-hidden="true" />
        <div style={S.headingOpening}>Opening camera…</div>
      </div>
    </div>
  );
}

const C = {
  warnBg:   '#FEF3C7',
  warnInk:  '#92400E',
  errBg:    '#FEE2E2',
  errInk:   '#991B1B',
  openBg:   '#F6F1E7',
  openInk:  '#1F2933',
  border:   'rgba(0,0,0,0.06)',
  accent:   '#C8944D',
  ink:      '#1F2933',
};

const S = {
  wrap: {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
    zIndex: 9999,
    width: 'min(440px, 92vw)',
    pointerEvents: 'auto',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  cardOpening: {
    background: C.openBg, color: C.openInk,
    border: '1px solid '+C.border, borderRadius: 14,
    padding: '12px 16px',
    boxShadow: '0 8px 22px rgba(0,0,0,0.08)',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  cardWarn: {
    background: C.warnBg, color: C.warnInk,
    border: '1px solid '+C.border, borderRadius: 14,
    padding: '14px 16px',
    boxShadow: '0 8px 22px rgba(0,0,0,0.10)',
    display: 'flex', alignItems: 'flex-start', gap: 12,
  },
  cardError: {
    background: C.errBg, color: C.errInk,
    border: '1px solid '+C.border, borderRadius: 14,
    padding: '14px 16px',
    boxShadow: '0 8px 22px rgba(0,0,0,0.12)',
    display: 'flex', alignItems: 'flex-start', gap: 12,
    flexWrap: 'wrap',
  },
  icon: { fontSize: 22, lineHeight: '24px', flex: '0 0 24px' },
  spinner: {
    width: 20, height: 20,
    border: '3px solid rgba(31,41,51,0.15)',
    borderTopColor: C.accent,
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
    flex: '0 0 20px',
  },
  text: { flex: 1, minWidth: 0 },
  heading: { fontWeight: 700, fontSize: '0.9375rem', lineHeight: 1.35 },
  headingOpening: { fontWeight: 700, fontSize: '0.9375rem', color: C.openInk },
  subtle:  { fontSize: '0.8125rem', opacity: 0.9, marginTop: 4,
             lineHeight: 1.5 },
  code:    { fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)',
             padding: '0 0.3rem', borderRadius: 4 },
  btnRow: { display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' },
  primary: {
    padding: '8px 14px', borderRadius: 10, border: 'none',
    background: C.accent, color: '#FFFFFF',
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
    minHeight: 40,
  },
  secondary: {
    padding: '8px 14px', borderRadius: 10,
    border: '1px solid '+C.accent,
    background: 'transparent', color: C.accent,
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
    minHeight: 40,
  },
  ghost: {
    padding: '8px 14px', borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.15)',
    background: 'transparent', color: C.ink,
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
    minHeight: 40,
  },
};
