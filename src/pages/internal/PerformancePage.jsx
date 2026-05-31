/**
 * PerformancePage — internal, admin-only performance diagnostics.
 *
 *   <Route path="/internal/performance" element={
 *     <RoleRoute roles={ADMIN_ROLES}><PerformancePage /></RoleRoute>
 *   } />
 *
 * Renders the REAL window.__performanceHealth() composite (startup /
 * scan / polling / bundle / memory / backend / database + verdict).
 * No fabricated scores — every value comes from the live probes.
 *
 * Strict-rule audit
 *   • Read-only. Inline styles. Never throws. SSR-safe.
 */

import React, { useEffect, useState } from 'react';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _read() {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window;
    return typeof w.__performanceHealth === 'function' ? w.__performanceHealth() : null;
  }, null);
}

const VERDICT_COLOR = { GOOD: '#16A34A', NEEDS_WORK: '#C8944D', CRITICAL: '#DC2626' };

export default function PerformancePage() {
  const [snap, setSnap] = useState(() => _read());

  useEffect(() => {
    // Refresh once after mount so probes installed slightly after this
    // page renders are reflected. No interval — this is a manual,
    // operator-opened diagnostic (not a production poller).
    const t = setTimeout(() => setSnap(_read()), 400);
    return () => clearTimeout(t);
  }, []);

  const refresh = () => setSnap(_read());
  const verdict = (snap && snap.verdict) || 'UNKNOWN';

  return (
    <main style={S.page} data-testid="internal-performance">
      <div style={S.head}>
        <h1 style={S.title}>Performance diagnostics</h1>
        <span style={{ ...S.verdict, background: VERDICT_COLOR[verdict] || '#64748B' }}>
          {verdict}
        </span>
      </div>
      <p style={S.sub}>
        Live <code>window.__performanceHealth()</code> — real probe data, no scores.
      </p>
      <button type="button" style={S.btn} onClick={refresh} data-testid="perf-refresh">
        Refresh
      </button>

      {!snap ? (
        <p style={S.empty}>Probes not installed yet. Tap Refresh in a moment.</p>
      ) : (
        <div style={S.grid}>
          {[
            ['Scan',     snap.scan],
            ['Polling',  snap.polling],
            ['Bundle',   snap.bundle],
            ['Memory',   snap.memory],
            ['Backend',  snap.backend],
            ['Database', snap.database],
            ['Startup',  snap.startup],
          ].map(([label, obj]) => (
            <section key={label} style={S.card}>
              <div style={S.cardTitle}>{label}</div>
              <pre style={S.pre}>{_safe(() => JSON.stringify(obj, null, 2), '—')}</pre>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0B1220', color: '#E5E7EB',
    padding: '24px 16px 80px', fontFamily: 'ui-monospace, monospace', maxWidth: 920, margin: '0 auto' },
  head: { display: 'flex', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: 800, margin: 0, color: '#FFFFFF', fontFamily: 'system-ui' },
  verdict: { fontSize: 12, fontWeight: 800, color: '#FFFFFF', padding: '4px 12px', borderRadius: 999 },
  sub: { fontSize: 13, color: '#94A3B8', margin: '8px 0 12px', fontFamily: 'system-ui' },
  btn: { appearance: 'none', border: '1px solid #334155', background: '#1E293B', color: '#E5E7EB',
    fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', marginBottom: 16 },
  empty: { fontSize: 13, color: '#94A3B8', fontFamily: 'system-ui' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 },
  card: { background: '#111827', border: '1px solid #1F2937', borderRadius: 12, padding: '12px 14px' },
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'system-ui' },
  pre: { margin: 0, fontSize: 11, color: '#CBD5E1', whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
};
