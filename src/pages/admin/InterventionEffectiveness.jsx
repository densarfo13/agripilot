import React, { useMemo } from 'react';
import { useInterventionData } from '../../hooks/useIntelligenceAdmin.js';

// ─── Helpers ────────────────────────────────────────────────

function pct(val) {
  if (val == null) return 0;
  return typeof val === 'number' && val <= 1 ? Math.round(val * 100) : Math.round(val);
}

const OUTCOME_COLORS = {
  improved: '#22C55E',
  resolved: '#3B82F6',
  same: '#F59E0B',
  worse: '#EF4444',
};

// ─── Component ──────────────────────────────────────────────

export default function InterventionEffectiveness() {
  const { data, loading, error, refetch } = useInterventionData();

  // ── Derived values ──
  const total = data?.total ?? data?.totalTreatments ?? data?.total_treatments ?? 0;
  const resolutionRate = pct(data?.resolutionRate ?? data?.resolution_rate ?? data?.overallSuccessRate ?? data?.overall_success_rate ?? 0);
  const repeatRate = pct(data?.repeatOutbreakRate ?? data?.repeat_outbreak_rate ?? 0);

  // byStatus: { improved: N, resolved: N, same: N, worse: N }
  const byStatus = data?.byStatus ?? data?.by_status ?? data?.outcomeDistribution ?? data?.outcome_distribution ?? {};
  // Normalize: could be object or array
  const statusObj = useMemo(() => {
    if (Array.isArray(byStatus)) {
      const obj = {};
      byStatus.forEach(item => {
        const key = item.name ?? item.outcome ?? item.status ?? item.label ?? 'unknown';
        obj[key] = item.count ?? item.value ?? 0;
      });
      return obj;
    }
    return byStatus;
  }, [byStatus]);

  const statusTotal = Object.values(statusObj).reduce((s, v) => s + (v || 0), 0) || 1;

  // Determine most effective treatment type
  const byType = data?.byType ?? data?.by_type ?? data?.byTreatmentType ?? data?.by_treatment_type ?? [];
  const typeList = Array.isArray(byType) ? byType : [];
  const mostEffective = useMemo(() => {
    if (typeList.length === 0) return '-';
    const sorted = [...typeList].sort((a, b) => {
      const aRate = a.successRate ?? a.success_rate ?? a.resolutionRate ?? a.resolution_rate ?? 0;
      const bRate = b.successRate ?? b.success_rate ?? b.resolutionRate ?? b.resolution_rate ?? 0;
      return bRate - aRate;
    });
    return sorted[0]?.type ?? sorted[0]?.treatmentType ?? sorted[0]?.treatment_type ?? sorted[0]?.name ?? '-';
  }, [typeList]);

  // byCrop
  const byCrop = data?.byCrop ?? data?.by_crop ?? data?.byCropType ?? data?.by_crop_type ?? [];
  const cropList = Array.isArray(byCrop) ? byCrop : [];

  return (
    <div style={S.page}>
      <h1 style={S.title}>Intervention Effectiveness</h1>
      <p style={S.subtitle}>Treatment analytics showing outcomes, resolution rates, and crop-level breakdowns.</p>

      {error && (
        <div style={S.errorBanner}>
          <span>Error: {error}</span>
          <button style={{ ...S.btn, ...S.btnOutline }} onClick={refetch}>Retry</button>
        </div>
      )}

      {loading && (
        <div style={S.emptyState}>
          <div style={S.spinner} /><br />Loading intervention data...
        </div>
      )}

      {!loading && (
        <>
          {/* Stats bar */}
          <div style={S.statsRow}>
            {[
              { label: 'Total Treatments', value: total },
              { label: 'Resolution Rate', value: `${resolutionRate}%`, color: '#22C55E' },
              { label: 'Most Effective Type', value: mostEffective, color: '#3B82F6' },
              { label: 'Repeat Outbreak Rate', value: `${repeatRate}%`, color: repeatRate > 20 ? '#EF4444' : '#FBBF24' },
            ].map((s, i) => (
              <div key={i} style={S.statCard}>
                <div style={S.statLabel}>{s.label}</div>
                <div style={{ ...S.statValue, color: s.color || '#fff', fontSize: typeof s.value === 'string' && s.value.length > 8 ? '1.1rem' : '1.5rem' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Refresh button */}
          <div style={S.filterRow}>
            <button style={{ ...S.btn, ...S.btnOutline }} onClick={refetch}>&#x21bb; Refresh</button>
          </div>

          {/* Outcome distribution - CSS stacked bar */}
          <div style={S.statCard}>
            <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '1rem' }}>Outcome Distribution</div>

            {/* Stacked horizontal bar */}
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', height: '32px', marginBottom: '0.75rem' }}>
              {['improved', 'resolved', 'same', 'worse'].map(key => {
                const count = statusObj[key] || 0;
                const widthPct = (count / statusTotal) * 100;
                if (widthPct <= 0) return null;
                return (
                  <div
                    key={key}
                    style={{
                      width: `${widthPct}%`,
                      background: OUTCOME_COLORS[key],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#fff',
                      minWidth: widthPct > 5 ? 'auto' : 0,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      transition: 'width 0.4s ease',
                    }}
                    title={`${key}: ${count} (${Math.round(widthPct)}%)`}
                  >
                    {widthPct > 8 ? `${Math.round(widthPct)}%` : ''}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {['improved', 'resolved', 'same', 'worse'].map(key => {
                const count = statusObj[key] || 0;
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: OUTCOME_COLORS[key], flexShrink: 0 }} />
                    <span style={{ color: '#CBD5E1', textTransform: 'capitalize' }}>{key}</span>
                    <span style={{ color: '#64748B' }}>({count})</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By treatment type breakdown */}
          {typeList.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>By Treatment Type</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Treatment Type</th>
                      <th style={S.th}>Count</th>
                      <th style={{ ...S.th, minWidth: 200 }}>Success Rate</th>
                      <th style={S.th}>Avg Days to Resolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeList.map((t, idx) => {
                      const typeName = t.type ?? t.treatmentType ?? t.treatment_type ?? t.name ?? '-';
                      const count = t.count ?? t.treatments ?? 0;
                      const rate = pct(t.successRate ?? t.success_rate ?? t.resolutionRate ?? t.resolution_rate ?? 0);
                      const avgDays = t.avgDaysToResolution ?? t.avg_days_to_resolution ?? t.avgDays ?? t.avg_days ?? '-';
                      return (
                        <tr key={idx}>
                          <td style={S.td}>{typeName}</td>
                          <td style={S.td}>{count}</td>
                          <td style={S.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                <div style={{ width: `${rate}%`, height: '100%', borderRadius: 4, background: rate >= 60 ? '#22C55E' : rate >= 40 ? '#FBBF24' : '#EF4444', transition: 'width 0.4s ease' }} />
                              </div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: rate >= 60 ? '#22C55E' : rate >= 40 ? '#FBBF24' : '#EF4444', minWidth: 36 }}>{rate}%</span>
                            </div>
                          </td>
                          <td style={S.td}>{typeof avgDays === 'number' ? `${avgDays} days` : avgDays}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* By crop breakdown */}
          {cropList.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>By Crop</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Crop</th>
                      <th style={S.th}>Total Treatments</th>
                      <th style={{ ...S.th, minWidth: 200 }}>Resolution Rate</th>
                      <th style={S.th}>Most Used Treatment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cropList.map((c, idx) => {
                      const crop = c.crop ?? c.cropType ?? c.crop_type ?? c.name ?? '-';
                      const count = c.treatments ?? c.count ?? c.total ?? 0;
                      const rate = pct(c.resolutionRate ?? c.resolution_rate ?? c.successRate ?? c.success_rate ?? 0);
                      const mostUsed = c.mostUsedTreatment ?? c.most_used_treatment ?? c.topTreatment ?? c.top_treatment ?? '-';
                      return (
                        <tr key={idx}>
                          <td style={S.td}>{crop}</td>
                          <td style={S.td}>{count}</td>
                          <td style={S.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                <div style={{ width: `${rate}%`, height: '100%', borderRadius: 4, background: rate >= 60 ? '#22C55E' : rate >= 40 ? '#FBBF24' : '#EF4444', transition: 'width 0.4s ease' }} />
                              </div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: rate >= 60 ? '#22C55E' : rate >= 40 ? '#FBBF24' : '#EF4444', minWidth: 36 }}>{rate}%</span>
                            </div>
                          </td>
                          <td style={S.td}>{mostUsed}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state if no data at all */}
          {!data && (
            <div style={S.emptyState}>No intervention data available.</div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const S = {
  page: { padding: '1.5rem', color: '#fff', minHeight: '100vh' },
  title: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' },
  subtitle: { color: '#94A3B8', fontSize: '0.9rem', marginBottom: '1.5rem' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  statCard: { background: '#1E293B', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)' },
  statLabel: { fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' },
  filterRow: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' },
  select: { background: '#1E293B', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  td: { padding: '10px 12px', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  btn: { padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '32px' },
  btnGreen: { background: '#22C55E', color: '#fff' },
  btnRed: { background: '#EF4444', color: '#fff' },
  btnOutline: { background: 'transparent', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.15)' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 },
  expandedRow: { background: 'rgba(255,255,255,0.03)', padding: '1rem 1.5rem' },
  spinner: { display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'spin 0.6s linear infinite' },
  emptyState: { textAlign: 'center', padding: '3rem 1rem', color: '#64748B' },
  errorBanner: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '0.75rem 1rem', color: '#FCA5A5', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
};
