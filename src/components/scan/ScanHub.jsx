/**
 * ScanHub.jsx — production-ready action-first scan landing.
 *
 *   <ScanHub onTakePhoto={...} onUploadPhoto={...} />
 *
 * What this is
 * ────────────
 *   The /scan idle-state landing. Replaces the previous
 *   blank/auto-camera surface with a calm scan hub that:
 *
 *     • Renders an info-dense hero ("Scan Your Plant" + 5
 *       capability chips: disease / pest / crop / flower / garden)
 *     • Offers TWO explicit CTAs — "Take photo" (primary) and
 *       "Upload photo" (secondary). No camera initialization
 *       happens until the user gestures.
 *     • Shows recent scans (composes existing ScanHistory
 *       component, which subscribes via useScanHistory)
 *     • Surfaces a live online/offline + queue-depth indicator
 *     • Surfaces a camera-permission status indicator (uses the
 *       Permissions API — no prompt fired)
 *     • Mounts a dev-only diagnostics panel reading
 *       __scanUIHealth() / __scanRuntimeHealthV8() / __queueHealth()
 *
 *   Strict-rule audit
 *     • Pure render. SSR-safe (every browser API guarded).
 *     • Never calls getUserMedia / Capacitor Camera / startCapture
 *       / openCamera at any point — those fire only inside
 *       LiveCameraScanner / CameraRuntimeManager after the user
 *       taps "Take photo" (parent transitions phase to 'capture').
 *     • No direct API calls (Plant.id integration is preserved
 *       through the existing ScanRuntime → /api/scan/analyze path
 *       owned by the parent).
 *     • Localized via tSafe with sensible English defaults.
 *     • Permission probe is best-effort and never throws.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { useScanHistory } from '../../hooks/useScanHistory.js';
import ScanHistory from './ScanHistory.jsx';

const _isFn = (v) => typeof v === 'function';
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

const STYLES = {
  page: {
    minHeight:     '100vh',
    background:    '#F6F1E7',
    fontFamily:    'system-ui, -apple-system, sans-serif',
    padding:       '20px 16px 96px',
    maxWidth:      720,
    margin:        '0 auto',
    boxSizing:     'border-box',
  },
  hero: {
    position:      'relative',
    background:    'linear-gradient(135deg, #15803D 0%, #16A34A 55%, #22C55E 100%)',
    color:         '#FFFFFF',
    borderRadius:  20,
    padding:       '32px 24px 26px',
    marginBottom:  18,
    overflow:      'hidden',
    boxShadow:     '0 10px 24px rgba(21,128,61,0.18)',
  },
  heroEmoji: {
    fontSize:      52,
    margin:        '0 0 12px',
    lineHeight:    1,
  },
  heroTitle: {
    margin:        '0 0 6px',
    fontSize:      26,
    fontWeight:    800,
    letterSpacing: '-0.01em',
  },
  heroSubtitle: {
    margin:        0,
    fontSize:      14,
    lineHeight:    1.5,
    opacity:       0.92,
    maxWidth:      460,
  },
  chipRow: {
    display:       'flex',
    flexWrap:      'wrap',
    gap:           6,
    marginTop:     18,
  },
  chip: {
    fontSize:      12,
    fontWeight:    600,
    padding:       '5px 10px',
    borderRadius:  999,
    background:    'rgba(255,255,255,0.18)',
    color:         '#FFFFFF',
    border:        '1px solid rgba(255,255,255,0.22)',
    whiteSpace:    'nowrap',
  },
  ctaCard: {
    background:    '#FFFFFF',
    borderRadius:  18,
    padding:       '18px 18px 14px',
    marginBottom:  18,
    boxShadow:     '0 2px 6px rgba(31,41,51,0.06)',
    border:        '1px solid rgba(31,41,51,0.06)',
  },
  ctaPrimary: {
    appearance:    'none',
    border:        'none',
    background:    '#16A34A',
    color:         '#FFFFFF',
    fontWeight:    700,
    fontSize:      16,
    padding:       '14px 18px',
    borderRadius:  14,
    cursor:        'pointer',
    width:         '100%',
    fontFamily:    'inherit',
    boxShadow:     '0 2px 4px rgba(22,163,74,0.30)',
  },
  ctaSecondary: {
    appearance:    'none',
    border:        '1.5px solid rgba(31,41,51,0.18)',
    background:    '#FFFFFF',
    color:         '#1F2933',
    fontWeight:    700,
    fontSize:      15,
    padding:       '13px 18px',
    borderRadius:  14,
    cursor:        'pointer',
    width:         '100%',
    marginTop:     10,
    fontFamily:    'inherit',
  },
  // Permanent-stability fix — quiet tertiary "Go Home" escape on
  // the safe shell.
  ctaGhost: {
    appearance:    'none',
    border:        '1px solid rgba(31,41,51,0.12)',
    background:    'transparent',
    color:         '#64748B',
    fontWeight:    600,
    fontSize:      14,
    padding:       '11px 18px',
    borderRadius:  14,
    cursor:        'pointer',
    width:         '100%',
    marginTop:     10,
    fontFamily:    'inherit',
  },
  ctaHint: {
    margin:        '14px 0 0',
    fontSize:      12,
    color:         '#94A3B8',
    textAlign:     'center',
  },
  statusRow: {
    display:       'flex',
    gap:           10,
    marginBottom:  18,
  },
  statusCard: {
    flex:          '1 1 0',
    background:    '#FFFFFF',
    borderRadius:  14,
    padding:       '12px 12px',
    border:        '1px solid rgba(31,41,51,0.06)',
    boxShadow:     '0 1px 2px rgba(31,41,51,0.03)',
    fontSize:      12,
    color:         '#475569',
  },
  statusLabel: {
    fontSize:      11,
    fontWeight:    600,
    color:         '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom:  4,
  },
  statusValue: {
    fontSize:      13,
    fontWeight:    700,
    color:         '#1F2933',
  },
  statusDot: {
    display:       'inline-block',
    width:         8,
    height:        8,
    borderRadius:  '50%',
    marginRight:   6,
    verticalAlign: 'middle',
  },
  sectionHeader: {
    fontSize:      13,
    fontWeight:    700,
    color:         '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom:  10,
    marginTop:     6,
  },
  devPanel: {
    background:    '#0F172A',
    color:         '#CBD5E1',
    borderRadius:  12,
    padding:       '12px 14px',
    fontSize:      11,
    fontFamily:    'ui-monospace, monospace',
    marginTop:     18,
    border:        '1px solid #1E293B',
    whiteSpace:    'pre-wrap',
    wordBreak:     'break-all',
  },
  devLabel: {
    color:         '#94A3B8',
    fontSize:      10,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom:  6,
  },
};

const CAPABILITIES = Object.freeze([
  { key: 'disease',   defaultLabel: 'Diseases',              icon: '🦠' },
  { key: 'pest',      defaultLabel: 'Pests',                 icon: '🐛' },
  { key: 'nutrient',  defaultLabel: 'Nutrient deficiencies', icon: '🧪' },
  { key: 'crop',      defaultLabel: 'Crops',                 icon: '🌾' },
  { key: 'flower',    defaultLabel: 'Flowers',               icon: '🌸' },
  { key: 'garden',    defaultLabel: 'Garden plants',         icon: '🪴' },
  { key: 'weed',      defaultLabel: 'Weeds',                 icon: '🌱' },
]);

// ───────────────────────────────────────────────────────────
// Camera permission probe — uses the Permissions API which does
// NOT trigger a permission prompt. Returns one of:
//   'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown'
// ───────────────────────────────────────────────────────────

function _readCameraPermissionStatus() {
  return _safe(() => {
    if (typeof navigator === 'undefined') return 'unsupported';
    if (!navigator.permissions || !navigator.permissions.query) return 'unsupported';
    // The query returns a Promise so we can't read synchronously; the
    // hook calls this within a useEffect and awaits the result.
    return 'pending';
  }, 'unknown');
}

function _useCameraPermission() {
  const [status, setStatus] = useState('unknown');
  useEffect(() => {
    let cancelled = false;
    _safe(() => {
      if (typeof navigator === 'undefined'
          || !navigator.permissions
          || !navigator.permissions.query) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      navigator.permissions.query({ name: 'camera' })
        .then((res) => {
          if (cancelled) return;
          setStatus(res && res.state ? res.state : 'unknown');
          if (res && typeof res.addEventListener === 'function') {
            res.addEventListener('change', () => {
              if (cancelled) return;
              setStatus(res.state || 'unknown');
            });
          }
        })
        .catch(() => { if (!cancelled) setStatus('unknown'); });
    }, null);
    return () => { cancelled = true; };
  }, []);
  return status;
}

// ───────────────────────────────────────────────────────────
// Online / queue depth probe — composes wave-7 queueRegistry
// via Function-constructed dynamic import so the Hub doesn't
// bundle the offline runtime graph into its chunk.
// ───────────────────────────────────────────────────────────

function _useOfflineStatus() {
  const [online, setOnline] = useState(() =>
    _safe(() => (typeof navigator !== 'undefined' ? navigator.onLine : true), true));
  const [queueDepth, setQueueDepth] = useState(0);
  const refresh = useCallback(async () => {
    const depth = await _safe(async () => {
      const dyn = new Function('s', 'return import(s)');
      const mod = await dyn('../../runtime/offline/queueRegistry.js');
      if (!mod || typeof mod.getRegistrySnapshot !== 'function') return 0;
      const snap = await mod.getRegistrySnapshot();
      let total = 0;
      if (snap && snap.queues) {
        for (const q of Object.values(snap.queues)) {
          if (q && typeof q.depth === 'number') total += q.depth;
        }
      }
      return total;
    }, 0);
    setQueueDepth(typeof depth === 'number' ? depth : 0);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onUp   = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online',  onUp);
    window.addEventListener('offline', onDown);
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => {
      window.removeEventListener('online',  onUp);
      window.removeEventListener('offline', onDown);
      clearInterval(t);
    };
  }, [refresh]);
  return { online, queueDepth };
}

// ───────────────────────────────────────────────────────────
// Dev diagnostics — read once on mount, refresh on demand.
// ───────────────────────────────────────────────────────────

function _useDevDiagnostics(devMode) {
  const [snap, setSnap] = useState(null);
  useEffect(() => {
    if (!devMode) return undefined;
    let cancelled = false;
    (async () => {
      const out = await _safe(async () => {
        const w = typeof window !== 'undefined' ? window : {};
        const ui      = _isFn(w.__scanUIHealth)        ? w.__scanUIHealth() : null;
        const v8      = _isFn(w.__scanRuntimeHealthV8) ? w.__scanRuntimeHealthV8() : null;
        const queue   = _isFn(w.__queueHealth)         ? await w.__queueHealth() : null;
        return { ui, v8, queue };
      }, null);
      if (!cancelled) setSnap(out);
    })();
    return () => { cancelled = true; };
  }, [devMode]);
  return snap;
}

// ───────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────

const PERMISSION_COLOR = {
  granted:     '#10B981',
  denied:      '#EF4444',
  prompt:      '#F59E0B',
  unsupported: '#94A3B8',
  unknown:     '#94A3B8',
  pending:     '#94A3B8',
};

const PERMISSION_LABEL_KEY = {
  granted:     'scan.hub.permission.granted',
  denied:      'scan.hub.permission.denied',
  prompt:      'scan.hub.permission.prompt',
  unsupported: 'scan.hub.permission.unsupported',
  unknown:     'scan.hub.permission.unknown',
  pending:     'scan.hub.permission.unknown',
};

const PERMISSION_LABEL_DEFAULT = {
  granted:     'Allowed',
  denied:      'Blocked',
  prompt:      'Not asked',
  unsupported: 'Not available',
  unknown:     'Unknown',
  pending:     'Checking…',
};

export default function ScanHub({ onTakePhoto, onUploadPhoto, recentLimit = 4 }) {
  const permission = _useCameraPermission();
  const { online, queueDepth } = _useOfflineStatus();
  const { entries: history } = useScanHistory();
  const devMode = _safe(() =>
    !!(typeof import.meta !== 'undefined'
       && import.meta.env
       && (import.meta.env.DEV || import.meta.env.MODE === 'development')),
  false);
  const devDiag = _useDevDiagnostics(devMode);

  const recentCount = Array.isArray(history) ? history.length : 0;

  return (
    <main style={STYLES.page} data-testid="scan-hub" data-scan-default-mode="idle">
      {/* Hero */}
      <section style={STYLES.hero} data-testid="scan-hub-hero">
        <div style={STYLES.heroEmoji} aria-hidden="true">🌿</div>
        <h1 style={STYLES.heroTitle}>
          {tSafe('scan.hub.title', 'Scan Your Plant')}
        </h1>
        <p style={STYLES.heroSubtitle}>
          {tSafe(
            'scan.hub.subtitle',
            'Identify diseases, pests, nutrient deficiencies, crops, '
            + 'flowers, garden plants and weeds from a single clear photo.',
          )}
        </p>
        <div style={STYLES.chipRow}>
          {CAPABILITIES.map((c) => (
            <span
              key={c.key}
              style={STYLES.chip}
              data-testid={`scan-hub-capability-${c.key}`}
            >
              {c.icon} {tSafe('scan.hub.capability.' + c.key, c.defaultLabel)}
            </span>
          ))}
        </div>
      </section>

      {/* Primary + secondary CTAs */}
      <section style={STYLES.ctaCard} data-testid="scan-hub-ctas">
        <button
          type="button"
          style={STYLES.ctaPrimary}
          onClick={_isFn(onTakePhoto) ? onTakePhoto : undefined}
          disabled={!_isFn(onTakePhoto)}
          data-testid="scan-hub-take-photo"
        >
          📸 {tSafe('scan.hub.takePhoto', 'Take photo')}
        </button>
        <button
          type="button"
          style={STYLES.ctaSecondary}
          onClick={_isFn(onUploadPhoto) ? onUploadPhoto : undefined}
          disabled={!_isFn(onUploadPhoto)}
          data-testid="scan-hub-upload-photo"
        >
          🖼 {tSafe('scan.hub.uploadPhoto', 'Upload photo')}
        </button>
        {/* Permanent-stability fix — Go Home is always available on
            the safe shell so the user is never trapped on /scan
            even if camera + upload both stall. Pure navigation,
            no dependency on camera/runtime/permission. */}
        <button
          type="button"
          style={STYLES.ctaGhost}
          onClick={() => {
            try {
              if (typeof window !== 'undefined') window.location.assign('/home');
            } catch { /* swallow */ }
          }}
          data-testid="scan-hub-go-home"
        >
          🏠 {tSafe('scan.hub.goHome', 'Go Home')}
        </button>
        <p style={STYLES.ctaHint}>
          {tSafe(
            'scan.hub.hint',
            'For best results, fill the frame with the affected leaf or plant.',
          )}
        </p>
      </section>

      {/* Live status row REMOVED per Scan UX Final Fix —
          grower-facing UI must not surface developer status
          cards (CAMERA Allowed / CONNECTION Online). The
          underlying probes still run; their data is reachable
          via /internal/godmode (__scanUIHealth + __queueHealth)
          for QA / admin diagnostics only.

          The component bodies (_useCameraPermission +
          _useOfflineStatus) are intentionally kept above so the
          subscriptions continue to power the boot-time
          diagnostics — they just do not render any grower UI. */}

      {/* Recent scans — composes the existing ScanHistory component
          which self-hides when there are no entries. */}
      {recentCount > 0 ? (
        <section data-testid="scan-hub-recent">
          <div style={STYLES.sectionHeader}>
            {tSafe('scan.hub.recent', 'Recent scans')}
          </div>
          <ScanHistory limit={recentLimit} />
        </section>
      ) : null}

      {/* Dev-mode diagnostics. Hidden in production builds. */}
      {devMode ? (
        <details style={STYLES.devPanel} data-testid="scan-hub-dev-diagnostics">
          <summary style={{ cursor: 'pointer', color: '#E5E7EB' }}>
            scan-runtime diagnostics (dev)
          </summary>
          <div style={STYLES.devLabel}>__scanUIHealth()</div>
          <div>{_safe(() => JSON.stringify(devDiag && devDiag.ui, null, 2), '—')}</div>
          <div style={{ ...STYLES.devLabel, marginTop: 10 }}>__scanRuntimeHealthV8()</div>
          <div>{_safe(() => JSON.stringify(devDiag && devDiag.v8, null, 2), '—')}</div>
          <div style={{ ...STYLES.devLabel, marginTop: 10 }}>__queueHealth()</div>
          <div>{_safe(() => JSON.stringify(devDiag && devDiag.queue, null, 2), '—')}</div>
        </details>
      ) : null}
    </main>
  );
}
