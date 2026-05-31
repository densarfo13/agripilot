/**
 * src/components/scan/ScanStartupBanner.jsx — visible diagnostic
 * banner for real-device scan startup.
 *
 * Mounts globally (one place in the App tree). Self-hides unless:
 *   • the user is currently on /scan
 *   • the page has been on /scan for at least 3000ms
 *   • the scan is not yet ready (no camera + no upload fallback)
 *
 * States
 * ──────
 *   ≥ 3000ms AND < 5000ms:
 *     "Scan startup taking longer than expected"
 *     (just a yellow notice — no action yet)
 *
 *   ≥ 5000ms AND still not ready:
 *     "Camera unavailable. You can upload a photo instead."
 *     buttons: Upload photo  ·  Go Home
 *
 * Strict-rule audit
 *   • Pure read-only component. Polls __scanStartupHealth() every
 *     500ms via interval (cleaned up on unmount).
 *   • Never throws. Never modifies the scan engine.
 *   • Inline styles only.
 */

import React, { useEffect, useState } from 'react';

const POLL_MS    = 500;
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

function _goUpload() {
  _safe(() => {
    if (typeof window === 'undefined') return;
    window.location.assign('/scan?intent=upload');
  });
}
function _goHome() {
  _safe(() => {
    if (typeof window === 'undefined') return;
    window.location.assign('/home');
  });
}

export default function ScanStartupBanner() {
  const [snap, setSnap] = useState(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      try {
        if (!alive) return;
        const s = _probe();
        setSnap(s);
      } catch { /* swallow */ }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      try { clearInterval(id); } catch { /* swallow */ }
    };
  }, []);

  if (!snap) return null;
  if (!snap.initialized) return null;
  if (!snap.routeLoaded) return null;
  if (snap.scanReady) return null;
  const dur = typeof snap.startupDurationMs === 'number'
    ? snap.startupDurationMs : 0;
  if (dur < WARN_MS) return null;

  const isError = dur >= ERR_MS;
  const heading = isError
    ? 'Camera unavailable. You can upload a photo instead.'
    : 'Scan startup taking longer than expected';

  return (
    <div
      style={S.wrap}
      role={isError ? 'alert' : 'status'}
      data-testid={isError ? 'scan-startup-error' : 'scan-startup-warning'}
      data-stage={snap.stage}
      data-duration-ms={dur}
    >
      <div style={isError ? S.cardError : S.cardWarn}>
        <div style={S.icon} aria-hidden="true">
          {isError ? '📷' : '⏱️'}
        </div>
        <div style={S.text}>
          <div style={S.heading}>{heading}</div>
          <div style={S.subtle}>
            Stage reached: <code style={S.code}>{snap.stage}</code>
            {' · '}
            <code style={S.code}>{dur}ms</code>
          </div>
        </div>
        {isError && (
          <div style={S.btnRow}>
            <button
              type="button"
              style={S.primary}
              onClick={_goUpload}
              data-testid="scan-startup-upload"
            >
              Upload photo
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
        )}
      </div>
    </div>
  );
}

const C = {
  warnBg:   '#FEF3C7',
  warnInk:  '#92400E',
  errBg:    '#FEE2E2',
  errInk:   '#991B1B',
  border:   'rgba(0,0,0,0.06)',
  accent:   '#C8944D',
  ink:      '#1F2933',
  inkDim:   'rgba(31,41,51,0.65)',
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
  text: { flex: 1, minWidth: 0 },
  heading: { fontWeight: 700, fontSize: '0.9375rem', lineHeight: 1.35 },
  subtle:  { fontSize: '0.75rem', opacity: 0.85, marginTop: 4 },
  code:    { fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)',
             padding: '0 0.3rem', borderRadius: 4 },
  btnRow: { display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' },
  primary: {
    padding: '8px 14px', borderRadius: 10, border: 'none',
    background: C.accent, color: '#FFFFFF',
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
