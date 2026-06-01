/**
 * PilotReadinessPage — internal, admin-only pilot readiness dashboard.
 *
 *   <Route path="/internal/pilot-readiness" element={
 *     <RoleRoute roles={ADMIN_ROLES}><PilotReadinessPage /></RoleRoute>
 *   } />
 *
 * 12-subsystem GREEN / YELLOW / RED board from __pilotReadiness(), plus the
 * live pilot metrics (scan / retention / outcome / NGO / language /
 * reliability). No fabricated data — each panel renders exactly what its
 * window probe returns; honest NEEDS_DATA until the pilot accrues data.
 */

import React, { useEffect, useState } from 'react';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _call = (name) => _safe(() => {
  const w = window;
  return (w && typeof w[name] === 'function') ? w[name]() : null;
}, null);

const DOT = { GREEN: '#10B981', YELLOW: '#FBBF24', RED: '#F87171' };
const VERDICT = { GO: '#10B981', GO_WITH_LIMITATIONS: '#FBBF24', BLOCKED: '#F87171' };

export default function PilotReadinessPage() {
  const [snap, setSnap] = useState(null);
  const refresh = () => setSnap({
    readiness:   _call('__pilotReadiness'),
    scan:        _call('__scanMetrics'),
    retention:   _call('__retentionMetrics'),
    outcome:     _call('__outcomeMetrics'),
    ngo:         _call('__ngoPilotMetrics'),
    language:    _call('__languageQualityHealth'),
    reliability: _call('__reliabilityHealth'),
  });
  useEffect(() => { const t = setTimeout(refresh, 500); return () => clearTimeout(t); }, []);

  const r = snap && snap.readiness;
  const subsystems = _safe(() => r.subsystems, null) || {};
  const verdict = _safe(() => r.verdict, null);

  return (
    <main style={S.page} data-testid="internal-pilot-readiness">
      <div style={S.head}>
        <h1 style={S.title}>Pilot Readiness</h1>
        <button type="button" style={S.btn} onClick={refresh} data-testid="pilot-readiness-refresh">Refresh</button>
      </div>
      <p style={S.sub}>
        Real <code>__pilotReadiness()</code> — GREEN validated · YELLOW needs
        monitoring · RED release blocker.
      </p>

      {!snap ? <p style={S.empty}>Loading diagnostics…</p> : (
        <>
          <section style={S.verdictRow}>
            <span style={S.verdictLabel}>Release recommendation</span>
            <span style={{ ...S.badge, background: VERDICT[verdict] || '#475569' }}>{verdict || 'UNKNOWN'}</span>
          </section>

          <div style={S.board}>
            {Object.entries(subsystems).map(([name, status]) => (
              <div key={name} style={S.cell}>
                <span style={{ ...S.dot, background: DOT[status] || '#475569' }} />
                <span style={S.cellName}>{name}</span>
                <span style={{ ...S.cellStatus, color: DOT[status] || '#94A3B8' }}>{String(status)}</span>
              </div>
            ))}
          </div>

          <div style={S.grid}>
            {[
              ['Scan operations', snap.scan],
              ['Retention (DAU/WAU/MAU · D1/D7/D30)', snap.retention],
              ['Outcome capture', snap.outcome],
              ['NGO pilot metrics', snap.ngo],
              ['Language quality', snap.language],
              ['Reliability', snap.reliability],
            ].map(([label, obj]) => (
              <section key={label} style={S.card}>
                <div style={S.cardTitle}>{label}</div>
                {obj == null
                  ? <p style={S.empty}>Not enough data yet.</p>
                  : <pre style={S.pre}>{_safe(() => JSON.stringify(obj, null, 2), '—')}</pre>}
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0B1220', color: '#E5E7EB', padding: '24px 16px 80px',
    fontFamily: 'ui-monospace, monospace', maxWidth: 1040, margin: '0 auto' },
  head: { display: 'flex', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: 800, margin: 0, color: '#FFFFFF', fontFamily: 'system-ui' },
  sub: { fontSize: 13, color: '#94A3B8', margin: '8px 0 16px', fontFamily: 'system-ui' },
  btn: { appearance: 'none', border: '1px solid #334155', background: '#1E293B', color: '#E5E7EB',
    fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, cursor: 'pointer' },
  empty: { fontSize: 13, color: '#94A3B8', fontFamily: 'system-ui' },
  verdictRow: { display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 16px' },
  verdictLabel: { fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'system-ui' },
  badge: { fontSize: 13, fontWeight: 800, color: '#0B1220', padding: '6px 14px', borderRadius: 999, fontFamily: 'system-ui' },
  board: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 16 },
  cell: { display: 'flex', alignItems: 'center', gap: 8, background: '#111827', border: '1px solid #1F2937',
    borderRadius: 10, padding: '10px 12px' },
  dot: { width: 10, height: 10, borderRadius: 999, flex: '0 0 auto' },
  cellName: { fontSize: 13, color: '#E5E7EB', fontFamily: 'system-ui', flex: 1 },
  cellStatus: { fontSize: 11, fontWeight: 700, fontFamily: 'system-ui' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 },
  card: { background: '#111827', border: '1px solid #1F2937', borderRadius: 12, padding: '12px 14px' },
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'system-ui' },
  pre: { margin: 0, fontSize: 11, color: '#CBD5E1', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    maxHeight: 320, overflow: 'auto' },
};
