/**
 * V13CommandCenterPage — internal, admin-only V13 platform command center.
 *
 *   <Route path="/internal/v13" element={
 *     <RoleRoute roles={ADMIN_ROLES}><V13CommandCenterPage /></RoleRoute>
 *   } />
 *
 * Surfaces the REAL live V13 readiness diagnostics — event sourcing, outcome
 * learning, regional network, voice-first, yield-prediction readiness,
 * warehouse, feature store, model registry, analytics exports, governance —
 * plus OODA, artifacts, and the unified verdict / blockers / warnings. No
 * fabricated data: each panel renders exactly what its window probe returns,
 * and shows the probe's own honest "Not enough data yet." when thin.
 */

import React, { useEffect, useState } from 'react';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _call = (name) => _safe(() => {
  const w = window;
  return (w && typeof w[name] === 'function') ? w[name]() : null;
}, null);

const VERDICT_COLORS = {
  INSTITUTIONAL_READY: '#10B981',
  PROGRAM_READY: '#34D399',
  PILOT_READY: '#FBBF24',
  NEEDS_DATA: '#60A5FA',
  BLOCKED: '#F87171',
};

export default function V13CommandCenterPage() {
  const [snap, setSnap] = useState(null);
  const refresh = () => setSnap({
    v13:           _call('__v13Health'),
    events:        _call('__eventSourcingHealth'),
    outcome:       _call('__outcomeLearningHealth'),
    regional:      _call('__regionalNetworkHealth'),
    voice:         _call('__voiceFirstHealth'),
    yield:         _call('__yieldPredictionReadinessHealth'),
    warehouse:     _call('__warehouseHealth'),
    featureStore:  _call('__featureStoreHealth'),
    modelRegistry: _call('__modelRegistryHealth'),
    exports:       _call('__analyticsExportHealth'),
    governance:    _call('__v13GovernanceHealth'),
    ooda:          _call('__v13OODAHealth'),
    artifacts:     _call('__v13ArtifactHealth'),
  });
  useEffect(() => { const t = setTimeout(refresh, 500); return () => clearTimeout(t); }, []);

  const v13 = snap && snap.v13;
  const verdict = _safe(() => v13.verdict, null);
  const blockers = _safe(() => (Array.isArray(v13.blockers) ? v13.blockers : []), []);
  const warnings = _safe(() => (Array.isArray(v13.warnings) ? v13.warnings : []), []);

  return (
    <main style={S.page} data-testid="internal-v13">
      <div style={S.head}>
        <h1 style={S.title}>V13 Command Center</h1>
        <button type="button" style={S.btn} onClick={refresh} data-testid="v13-refresh">Refresh</button>
      </div>
      <p style={S.sub}>
        Real <code>__v13Health()</code> composite — event sourcing, outcome
        learning, regional network, voice, yield/warehouse/feature/model
        readiness, exports, governance. Decision support, not a guarantee.
      </p>

      {!snap ? <p style={S.empty}>Loading diagnostics…</p> : (
        <>
          <section style={S.verdictRow}>
            <span style={S.verdictLabel}>Platform verdict</span>
            <span style={{ ...S.verdictBadge, background: VERDICT_COLORS[verdict] || '#475569' }}>
              {verdict || 'UNKNOWN'}
            </span>
          </section>

          {(blockers.length > 0 || warnings.length > 0) && (
            <div style={S.grid}>
              <section style={{ ...S.card, borderColor: blockers.length ? '#7F1D1D' : '#1F2937' }}>
                <div style={S.cardTitle}>Blockers ({blockers.length})</div>
                {blockers.length === 0
                  ? <p style={S.ok}>None.</p>
                  : <ul style={S.list}>{blockers.map((b, i) => <li key={i} style={S.bad}>{String(b)}</li>)}</ul>}
              </section>
              <section style={S.card}>
                <div style={S.cardTitle}>Warnings ({warnings.length})</div>
                {warnings.length === 0
                  ? <p style={S.ok}>None.</p>
                  : <ul style={S.list}>{warnings.map((w, i) => <li key={i} style={S.warn}>{String(w)}</li>)}</ul>}
              </section>
            </div>
          )}

          <div style={S.grid}>
            {[
              ['Unified V13 health', snap.v13],
              ['Event sourcing', snap.events],
              ['Outcome learning', snap.outcome],
              ['Regional network', snap.regional],
              ['Voice-first readiness', snap.voice],
              ['Yield prediction readiness', snap.yield],
              ['Data warehouse readiness', snap.warehouse],
              ['Feature store readiness', snap.featureStore],
              ['Model registry readiness', snap.modelRegistry],
              ['Analytics exports', snap.exports],
              ['Data governance', snap.governance],
              ['OODA health', snap.ooda],
              ['Artifact health', snap.artifacts],
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
  ok: { fontSize: 12, color: '#34D399', fontFamily: 'system-ui', margin: 0 },
  verdictRow: { display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 16px' },
  verdictLabel: { fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em',
    fontFamily: 'system-ui' },
  verdictBadge: { fontSize: 13, fontWeight: 800, color: '#0B1220', padding: '6px 14px', borderRadius: 999,
    fontFamily: 'system-ui' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12,
    marginBottom: 12 },
  card: { background: '#111827', border: '1px solid #1F2937', borderRadius: 12, padding: '12px 14px' },
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'system-ui' },
  list: { margin: 0, paddingLeft: 18 },
  bad: { fontSize: 12, color: '#FCA5A5', fontFamily: 'system-ui', marginBottom: 4 },
  warn: { fontSize: 12, color: '#FCD34D', fontFamily: 'system-ui', marginBottom: 4 },
  pre: { margin: 0, fontSize: 11, color: '#CBD5E1', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    maxHeight: 360, overflow: 'auto' },
};
