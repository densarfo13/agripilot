import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { getInterventionEffectiveness } from '../../lib/intelligenceAdminApi';

// ─── Constants ──────────────────────────────────────────────

const OUTCOME_COLORS = {
  resolved: '#22C55E',
  improved: '#60A5FA',
  same: '#FBBF24',
  worse: '#EF4444',
};

const PIE_COLORS = ['#22C55E', '#60A5FA', '#FBBF24', '#EF4444'];

// ─── Styles ─────────────────────────────────────────────────

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', padding: '1.5rem' },
  container: { maxWidth: '80rem', margin: '0 auto' },
  header: { marginBottom: '1.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  card: {
    borderRadius: '16px', background: '#1B2330', padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  statLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' },
  statValue: { fontSize: '1.75rem', fontWeight: 700 },
  sectionTitle: { fontSize: '1.125rem', fontWeight: 600, margin: '1.5rem 0 1rem' },
  chartContainer: {
    borderRadius: '16px', background: '#1B2330', padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    marginBottom: '1.5rem',
  },
  chartsRow: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.5rem' },
  tableCard: {
    borderRadius: '16px', background: '#1B2330', padding: 0,
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px rgba(0,0,0,0.3)', overflow: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: {
    textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)', fontWeight: 600,
  },
  td: { padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  error: { color: '#FCA5A5', padding: '2rem', textAlign: 'center' },
  loading: { color: 'rgba(255,255,255,0.6)', padding: '2rem', textAlign: 'center' },
  empty: { color: 'rgba(255,255,255,0.6)', padding: '2rem', textAlign: 'center' },
};

// ─── Custom Tooltip ─────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload) return null;
  return (
    <div style={{ background: '#1B2330', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: '0.15rem' }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────

export default function InterventionEffectiveness() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInterventionEffectiveness();
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={S.page}><div style={S.loading}>Loading...</div></div>;
  if (error) return <div style={S.page}><div style={S.error}>Error: {error}</div></div>;
  if (!data) return <div style={S.page}><div style={S.empty}>No data available.</div></div>;

  // ── Derive values ──
  const successRate = data.overallSuccessRate ?? data.overall_success_rate ?? data.successRate ?? 0;
  const totalTreatments = data.totalTreatments ?? data.total_treatments ?? 0;
  const repeatRate = data.repeatOutbreakRate ?? data.repeat_outbreak_rate ?? 0;

  // Outcome distribution for bar and pie charts
  const outcomes = data.outcomeDistribution ?? data.outcome_distribution ?? data.outcomes ?? [];
  // Normalize: expect array of { name, count } or { outcome, count }
  const barData = outcomes.map(o => ({
    name: o.name ?? o.outcome ?? o.label ?? '-',
    count: o.count ?? o.value ?? 0,
  }));

  const pieData = barData.map(d => ({ name: d.name, value: d.count }));

  // By crop
  const byCrop = data.byCropType ?? data.by_crop_type ?? data.byCrop ?? [];

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <h1 style={S.title}>Intervention Effectiveness</h1>
        </div>

        {/* Stat cards */}
        <div style={S.statGrid}>
          <div style={S.card}>
            <div style={S.statLabel}>Overall Success Rate</div>
            <div style={{ ...S.statValue, color: '#22C55E' }}>
              {typeof successRate === 'number' ? `${Math.round(successRate * (successRate < 1 ? 100 : 1))}%` : successRate}
            </div>
          </div>
          <div style={S.card}>
            <div style={S.statLabel}>Total Treatments</div>
            <div style={S.statValue}>{totalTreatments}</div>
          </div>
          <div style={S.card}>
            <div style={S.statLabel}>Repeat Outbreak Rate</div>
            <div style={{ ...S.statValue, color: '#FCA5A5' }}>
              {typeof repeatRate === 'number' ? `${Math.round(repeatRate * (repeatRate < 1 ? 100 : 1))}%` : repeatRate}
            </div>
          </div>
        </div>

        {/* Charts */}
        {barData.length > 0 ? (
          <div style={S.chartsRow}>
            {/* Bar chart */}
            <div style={S.chartContainer}>
              <h3 style={S.sectionTitle}>Outcome Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                  <Bar dataKey="count" name="Treatments" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={OUTCOME_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart */}
            <div style={S.chartContainer}>
              <h3 style={S.sectionTitle}>Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={OUTCOME_COLORS[pieData[i].name] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div style={S.empty}>No outcome distribution data available.</div>
        )}

        {/* By crop table */}
        <h3 style={S.sectionTitle}>By Crop Type</h3>
        {byCrop.length === 0 ? (
          <div style={S.empty}>No crop-level data available.</div>
        ) : (
          <div style={S.tableCard}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Crop</th>
                  <th style={S.th}>Treatments</th>
                  <th style={S.th}>Success Rate</th>
                  <th style={S.th}>Avg Outcome Score</th>
                </tr>
              </thead>
              <tbody>
                {byCrop.map((c, idx) => {
                  const rate = c.successRate ?? c.success_rate ?? 0;
                  const rateDisplay = typeof rate === 'number'
                    ? `${Math.round(rate * (rate < 1 ? 100 : 1))}%`
                    : rate;
                  return (
                    <tr key={idx}>
                      <td style={S.td}>{c.crop ?? c.cropType ?? c.crop_type ?? '-'}</td>
                      <td style={S.td}>{c.treatments ?? c.count ?? 0}</td>
                      <td style={S.td}>
                        <span style={{ color: rate >= 0.6 || rate >= 60 ? '#22C55E' : '#FBBF24', fontWeight: 600 }}>
                          {rateDisplay}
                        </span>
                      </td>
                      <td style={S.td}>{c.avgOutcomeScore ?? c.avg_outcome_score ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
