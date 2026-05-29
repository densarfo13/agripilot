/**
 * ReleaseReadiness.jsx — RC1 internal dashboard.
 *
 *   Route: /internal/release
 *
 * Renders the wave-8 release diagnostics so QA can verify the
 * App Store readiness verdict on a real device without DevTools.
 *
 *   • __farrowayBuild()    — sha + builtAt + appStoreMode
 *   • __scanRuntimeHealthV8 + probeClassifierAvailability  — provider + classifierAvailable
 *   • __queueHealth()      — registered queues + depths
 *   • __continuityHealth() — composite restore + sync + events
 *   • __offlineHealth()    — wave-8 offline runtime
 *   • __appStoreReadiness() — verdict + blockers + warnings
 *
 * Guard
 *   Mounted at /internal/release. The route is gated by
 *   RC1RouteGate('investorMetrics') for now — if that flag is off
 *   the gate redirects to /home. Internal builds set the flag
 *   via VITE_APP_STORE_MODE=true (handled in safety mode).
 *
 * Strict-rule audit
 *   • Pure render. No mutation. Reads diagnostics only.
 *   • Polls every 5 s to keep the snapshot fresh.
 *   • No secrets surfaced.
 */

import React, { useEffect, useState, useCallback } from 'react';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _safeAsync = async (fn, fb) => { try { return await fn(); } catch { return fb; } };
const _w = () => (typeof window === 'undefined' ? {} : window);

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color:      '#E5E7EB',
    fontFamily: 'system-ui, sans-serif',
    padding:    '20px 16px',
    boxSizing:  'border-box',
  },
  container: { maxWidth: 760, margin: '0 auto' },
  h1: { fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 14 },
  h2: { fontSize: 14, fontWeight: 700, color: '#94A3B8',
        textTransform: 'uppercase', letterSpacing: '0.04em',
        marginTop: 18, marginBottom: 8 },
  card: {
    background:    '#1E293B',
    border:        '1px solid #334155',
    borderRadius:  10,
    padding:       '14px 16px',
    marginBottom:  10,
    fontSize:      13,
    lineHeight:    1.6,
  },
  pre: {
    margin: 0, color: '#CBD5E1', fontFamily: 'ui-monospace, monospace',
    fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  verdictReady: {
    background:   '#065F46',
    border:       '1px solid #10B981',
    color:        '#D1FAE5',
    padding:      '12px 14px',
    borderRadius: 10,
    fontWeight:   700,
    marginBottom: 14,
  },
  verdictNotReady: {
    background:   '#7F1D1D',
    border:       '1px solid #EF4444',
    color:        '#FECACA',
    padding:      '12px 14px',
    borderRadius: 10,
    fontWeight:   700,
    marginBottom: 14,
  },
  pill: {
    display:      'inline-block',
    background:   '#0B1220',
    border:       '1px solid #334155',
    borderRadius: 999,
    padding:      '2px 8px',
    margin:       '0 4px 4px 0',
    fontSize:     11,
    fontFamily:   'ui-monospace, monospace',
  },
};

function _fmt(o) {
  try { return JSON.stringify(o, null, 2); }
  catch { return String(o); }
}

export default function ReleaseReadiness() {
  const [build, setBuild]       = useState(null);
  const [scan, setScan]         = useState(null);
  const [queue, setQueue]       = useState(null);
  const [continuity, setCont]   = useState(null);
  const [offline, setOffline]   = useState(null);
  const [readiness, setReady]   = useState(null);
  const [updatedAt, setUpdated] = useState(null);

  const refresh = useCallback(async () => {
    const w = _w();
    setBuild(_safe(() =>
      typeof w.__farrowayBuild === 'function' ? w.__farrowayBuild() : null,
    null));
    setScan(_safe(() =>
      typeof w.__scanRuntimeHealthV8 === 'function' ? w.__scanRuntimeHealthV8() : null,
    null));
    setQueue(await _safeAsync(() =>
      typeof w.__queueHealth === 'function' ? w.__queueHealth() : null,
    null));
    setCont(await _safeAsync(() =>
      typeof w.__continuityHealth === 'function' ? w.__continuityHealth() : null,
    null));
    setOffline(_safe(() =>
      typeof w.__offlineHealth === 'function' ? w.__offlineHealth() : null,
    null));
    setReady(await _safeAsync(() =>
      typeof w.__appStoreReadiness === 'function' ? w.__appStoreReadiness() : null,
    null));
    setUpdated(new Date().toISOString());
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = null;
    const tick = async () => {
      if (!alive) return;
      await refresh();
      if (!alive) return;
      timer = setTimeout(tick, 5000);
    };
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [refresh]);

  const verdict = readiness && readiness.verdict;
  const isReady = verdict === 'APP_STORE_READY';
  const blockers = (readiness && readiness.blockers) || [];
  const warnings = (readiness && readiness.warnings) || [];

  return (
    <main style={STYLES.page} data-testid="release-readiness">
      <div style={STYLES.container}>
        <h1 style={STYLES.h1}>Release Readiness · /internal/release</h1>

        <div style={isReady ? STYLES.verdictReady : STYLES.verdictNotReady}>
          Verdict: {verdict || 'unknown'}
          {' · '}
          last refresh: {updatedAt ? updatedAt.slice(11, 19) : '—'}
        </div>

        {blockers.length > 0 && (
          <div style={STYLES.card}>
            <strong style={{ color: '#FCA5A5' }}>Blockers</strong>
            <div style={{ marginTop: 8 }}>
              {blockers.map((b) => (
                <span key={b} style={STYLES.pill}>{b}</span>
              ))}
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div style={STYLES.card}>
            <strong style={{ color: '#FCD34D' }}>Warnings</strong>
            <div style={{ marginTop: 8 }}>
              {warnings.map((w) => (
                <span key={w} style={STYLES.pill}>{w}</span>
              ))}
            </div>
          </div>
        )}

        <h2 style={STYLES.h2}>Build identity</h2>
        <div style={STYLES.card}>
          <div>SHA: <strong>{(build && build.sha) || 'unknown'}</strong></div>
          <div>Built at: <strong>{(build && build.builtAt) || '—'}</strong></div>
          <div>Mode: <strong>{(build && build.mode) || '—'}</strong></div>
          <div>App Store mode: <strong>{String(build ? build.appStoreMode : '—')}</strong></div>
        </div>

        <h2 style={STYLES.h2}>Scan classifier</h2>
        <div style={STYLES.card}>
          <pre style={STYLES.pre}>{_fmt(scan)}</pre>
        </div>

        <h2 style={STYLES.h2}>Queue health</h2>
        <div style={STYLES.card}>
          <pre style={STYLES.pre}>{_fmt(queue)}</pre>
        </div>

        <h2 style={STYLES.h2}>Continuity health</h2>
        <div style={STYLES.card}>
          <pre style={STYLES.pre}>{_fmt(continuity)}</pre>
        </div>

        <h2 style={STYLES.h2}>Offline health</h2>
        <div style={STYLES.card}>
          <pre style={STYLES.pre}>{_fmt(offline)}</pre>
        </div>

        <h2 style={STYLES.h2}>App Store readiness (full)</h2>
        <div style={STYLES.card}>
          <pre style={STYLES.pre}>{_fmt(readiness)}</pre>
        </div>
      </div>
    </main>
  );
}
