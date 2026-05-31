/**
 * NGOIntelligencePage — internal, admin-only NGO intelligence dashboard.
 *
 *   <Route path="/internal/ngo-intelligence" element={
 *     <RoleRoute roles={ADMIN_ROLES}><NGOIntelligencePage /></RoleRoute>
 *   } />
 *
 * Surfaces the REAL, ORGANIZATION-SCOPED NGO intelligence metrics from
 * __ngoIntelligenceHealth() (+ the existing __ngoImpactHealth()). No
 * fabricated metrics, no cross-tenant data, no PII — the page renders
 * exactly what the org-scoped probe returns, and shows the probe's own
 * "Not enough data yet" output when a metric has no real source.
 */

import React, { useEffect, useState } from 'react';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _call = (name) => _safe(() => {
  const w = window;
  return (w && typeof w[name] === 'function') ? w[name]() : null;
}, null);

const METRIC_LABELS = [
  ['farmersEnrolled', 'Farmers enrolled'],
  ['activeFarmers', 'Active farmers'],
  ['scansCompleted', 'Scans completed'],
  ['tasksCompleted', 'Tasks completed'],
  ['outcomesRecorded', 'Outcomes recorded'],
  ['diseaseClusters', 'Disease clusters'],
  ['pestClusters', 'Pest clusters'],
  ['highRiskFarms', 'High-risk farms'],
  ['fieldOfficerWorkload', 'Field officer workload'],
  ['programImpact', 'Program impact'],
];

export default function NGOIntelligencePage() {
  const [snap, setSnap] = useState(null);
  const refresh = () => setSnap({
    intel:  _call('__ngoIntelligenceHealth'),
    impact: _call('__ngoImpactHealth'),
  });
  useEffect(() => { const t = setTimeout(refresh, 500); return () => clearTimeout(t); }, []);

  const intel = snap && snap.intel;
  const value = _safe(() => intel.value, null) || {};
  const orgScoped = _safe(() => intel.organizationScoped === true, false);
  const noLeak = _safe(() => intel.crossTenantLeakage === false, false);

  return (
    <main style={S.page} data-testid="internal-ngo-intelligence">
      <div style={S.head}>
        <h1 style={S.title}>NGO Intelligence</h1>
        <button type="button" style={S.btn} onClick={refresh} data-testid="ngo-intel-refresh">Refresh</button>
      </div>
      <p style={S.sub}>
        Real organization-scoped <code>__ngoIntelligenceHealth()</code> —
        no cross-tenant data, no PII. Decision support, not a guarantee.
      </p>

      {!snap ? <p style={S.empty}>Loading diagnostics…</p> : (
        <>
          <section style={S.flags}>
            <span style={{ ...S.flag, color: orgScoped ? '#34D399' : '#FCA5A5' }}>
              {orgScoped ? '✓ organization-scoped' : '⚠ scope unknown'}
            </span>
            <span style={{ ...S.flag, color: noLeak ? '#34D399' : '#FCA5A5' }}>
              {noLeak ? '✓ no cross-tenant leakage' : '⚠ leakage flag unset'}
            </span>
          </section>

          <div style={S.metricGrid}>
            {METRIC_LABELS.map(([key, label]) => {
              const v = value[key];
              const shown = (v === null || v === undefined || v === '')
                ? 'Not enough data yet'
                : String(v);
              return (
                <section key={key} style={S.metricCard}>
                  <div style={S.metricLabel}>{label}</div>
                  <div style={S.metricValue}>{shown}</div>
                </section>
              );
            })}
          </div>

          <div style={S.grid}>
            {[
              ['NGO intelligence (raw)', snap.intel],
              ['NGO impact (existing)', snap.impact],
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
  flags: { display: 'flex', gap: 16, margin: '0 0 16px', flexWrap: 'wrap' },
  flag: { fontSize: 12, fontWeight: 600, fontFamily: 'system-ui' },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10,
    marginBottom: 16 },
  metricCard: { background: '#111827', border: '1px solid #1F2937', borderRadius: 12, padding: '12px 14px' },
  metricLabel: { fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 6, fontFamily: 'system-ui' },
  metricValue: { fontSize: 18, fontWeight: 800, color: '#F1F5F9', fontFamily: 'system-ui' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 },
  card: { background: '#111827', border: '1px solid #1F2937', borderRadius: 12, padding: '12px 14px' },
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'system-ui' },
  pre: { margin: 0, fontSize: 11, color: '#CBD5E1', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    maxHeight: 360, overflow: 'auto' },
};
