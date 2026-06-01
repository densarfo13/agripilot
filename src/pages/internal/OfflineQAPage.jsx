/**
 * OfflineQAPage — internal, admin-only offline sync field-test board.
 *
 *   <Route path="/internal/qa/offline" element={
 *     <RoleRoute roles={ADMIN_ROLES}><OfflineQAPage /></RoleRoute>
 *   } />
 *
 * Shows the REAL offline-sync proof: offline add plant / complete task /
 * create artifact → reconnect → sync once → no duplicates. Each step is
 * NEEDS_TEST until a real field test is recorded via __recordProofRun — no
 * fake green. Also surfaces the underlying queue + offline-validation probes.
 */

import React, { useEffect, useState } from 'react';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _call = (name) => _safe(() => {
  const w = window;
  return (w && typeof w[name] === 'function') ? w[name]() : null;
}, null);

const SD = { PASS: '#10B981', FAIL: '#F87171', NEEDS_TEST: '#FBBF24', UNKNOWN: '#475569' };
const STEPS = [
  ['Offline add plant', 'offlineAddPlantTested'],
  ['Offline complete task', 'offlineTaskCompleteTested'],
  ['Offline create artifact', 'offlineArtifactTested'],
  ['Reconnect → sync once', 'reconnectSyncTested'],
  ['No duplicates', 'duplicatePreventionVerified'],
];

export default function OfflineQAPage() {
  const [snap, setSnap] = useState(null);
  const refresh = () => setSnap({
    proof:   _call('__offlineSyncProofHealth'),
    queue:   _call('__queueHealth'),
    offline: _call('__offlineValidationHealth'),
  });
  useEffect(() => { const t = setTimeout(refresh, 400); return () => clearTimeout(t); }, []);

  const pf = snap && snap.proof;

  return (
    <main style={S.page} data-testid="internal-qa-offline">
      <div style={S.head}>
        <h1 style={S.title}>Offline Sync Field Test</h1>
        <button type="button" style={S.btn} onClick={refresh} data-testid="offline-qa-refresh">Refresh</button>
      </div>
      <p style={S.sub}>
        Real <code>__offlineSyncProofHealth()</code>. Each step stays NEEDS_TEST until a real
        field test is recorded with{' '}
        <code>__recordProofRun('offline_add_plant', 'qa:you')</code> — no fake green.
      </p>

      {!snap ? <p style={S.empty}>Loading diagnostics…</p> : (
        <>
          <section style={S.proofHead}>
            <span style={S.verdictLabel}>Offline proof</span>
            <span style={{ ...S.badge, background: SD[(pf && pf.proofStatus) || 'UNKNOWN'] }}>
              {(pf && pf.proofStatus) || 'UNKNOWN'}
            </span>
          </section>
          <div style={S.board}>
            {STEPS.map(([label, key]) => {
              const ok = !!(pf && pf[key]);
              return (
                <div key={key} style={S.cell}>
                  <span style={{ ...S.dot, background: ok ? '#10B981' : '#FBBF24' }} />
                  <span style={S.cellName}>{label}</span>
                  <span style={{ ...S.cellStatus, color: ok ? '#10B981' : '#FBBF24' }}>{ok ? 'TESTED' : 'NEEDS_TEST'}</span>
                </div>
              );
            })}
          </div>
          <div style={S.grid}>
            {[['Offline sync proof (raw)', snap.proof], ['Queue health', snap.queue], ['Offline validation', snap.offline]].map(([label, obj]) => (
              <section key={label} style={S.card}>
                <div style={S.cardTitle}>{label}</div>
                {obj == null ? <p style={S.empty}>Not loaded.</p>
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
    fontFamily: 'ui-monospace, monospace', maxWidth: 960, margin: '0 auto' },
  head: { display: 'flex', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: 800, margin: 0, color: '#FFFFFF', fontFamily: 'system-ui' },
  sub: { fontSize: 13, color: '#94A3B8', margin: '8px 0 16px', fontFamily: 'system-ui' },
  btn: { appearance: 'none', border: '1px solid #334155', background: '#1E293B', color: '#E5E7EB',
    fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, cursor: 'pointer' },
  empty: { fontSize: 13, color: '#94A3B8', fontFamily: 'system-ui' },
  proofHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  verdictLabel: { fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'system-ui' },
  badge: { fontSize: 13, fontWeight: 800, color: '#0B1220', padding: '6px 14px', borderRadius: 999, fontFamily: 'system-ui' },
  board: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 16 },
  cell: { display: 'flex', alignItems: 'center', gap: 8, background: '#111827', border: '1px solid #1F2937', borderRadius: 10, padding: '10px 12px' },
  dot: { width: 10, height: 10, borderRadius: 999, flex: '0 0 auto' },
  cellName: { fontSize: 13, color: '#E5E7EB', fontFamily: 'system-ui', flex: 1 },
  cellStatus: { fontSize: 11, fontWeight: 700, fontFamily: 'system-ui' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 },
  card: { background: '#111827', border: '1px solid #1F2937', borderRadius: 12, padding: '12px 14px' },
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'system-ui' },
  pre: { margin: 0, fontSize: 11, color: '#CBD5E1', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 320, overflow: 'auto' },
};
