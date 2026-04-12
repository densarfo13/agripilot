import React, { useState, useEffect, useCallback } from 'react';
import { getRegionalRisk, getOutbreakClusters } from '../../lib/intelligenceAdminApi';

// ─── Helpers ────────────────────────────────────────────────

function riskColor(score) {
  if (score >= 80) return '#EF4444';
  if (score >= 65) return '#F97316';
  if (score >= 40) return '#FBBF24';
  return '#22C55E';
}

function trendIcon(direction) {
  if (direction === 'increasing') return { symbol: '↑', color: '#EF4444' };
  if (direction === 'stable') return { symbol: '→', color: '#FBBF24' };
  return { symbol: '↓', color: '#22C55E' };
}

function clusterStatusColor(status) {
  if (status === 'active') return { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' };
  if (status === 'monitoring') return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
  return { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' };
}

// ─── Styles ─────────────────────────────────────────────────

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', padding: '1.5rem' },
  container: { maxWidth: '80rem', margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700 },
  refreshBtn: {
    padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '0.875rem',
  },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  card: {
    borderRadius: '16px', background: '#1B2330', padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  statLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' },
  statValue: { fontSize: '1.75rem', fontWeight: 700 },
  filterBar: {
    display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem',
  },
  select: {
    padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
    background: '#1B2330', color: '#fff', fontSize: '0.875rem',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: {
    textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)', fontWeight: 600,
  },
  td: { padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  badge: {
    display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '9999px',
    fontSize: '0.75rem', fontWeight: 600,
  },
  sectionTitle: { fontSize: '1.125rem', fontWeight: 600, margin: '2rem 0 1rem' },
  clusterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' },
  actionBtn: {
    padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', color: '#22C55E', cursor: 'pointer', fontSize: '0.75rem',
  },
  error: { color: '#FCA5A5', padding: '2rem', textAlign: 'center' },
  loading: { color: 'rgba(255,255,255,0.6)', padding: '2rem', textAlign: 'center' },
  empty: { color: 'rgba(255,255,255,0.6)', padding: '2rem', textAlign: 'center' },
};

// ─── Component ──────────────────────────────────────────────

export default function RegionalRiskMap() {
  const [regions, setRegions] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [riskFilter, setRiskFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [riskRes, clusterRes] = await Promise.all([getRegionalRisk(), getOutbreakClusters()]);
      setRegions(riskRes.regions || riskRes.data || []);
      setClusters(clusterRes.clusters || clusterRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived stats ──
  const highRiskCount = regions.filter(r => (r.riskScore ?? r.risk_score ?? 0) >= 65).length;
  const activeClusters = clusters.filter(c => c.status === 'active').length;
  const activeAlerts = regions.reduce((sum, r) => sum + (r.activeAlerts ?? r.active_alerts ?? 0), 0);

  // ── Filtered regions ──
  const filtered = regions.filter(r => {
    if (riskFilter === 'all') return true;
    const score = r.riskScore ?? r.risk_score ?? 0;
    if (riskFilter === 'high') return score >= 65;
    if (riskFilter === 'medium') return score >= 40 && score < 65;
    if (riskFilter === 'low') return score < 40;
    return true;
  });

  // ── Render ──
  if (loading) return <div style={S.page}><div style={S.loading}>Loading...</div></div>;
  if (error) return <div style={S.page}><div style={S.error}>Error: {error}</div></div>;

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={S.header}>
          <h1 style={S.title}>Regional Risk Intelligence</h1>
          <button style={S.refreshBtn} onClick={fetchData}>&#x21bb; Refresh</button>
        </div>

        {/* Stat cards */}
        <div style={S.statGrid}>
          {[
            { label: 'Total Regions Monitored', value: regions.length },
            { label: 'High Risk Regions', value: highRiskCount, color: '#FCA5A5' },
            { label: 'Active Clusters', value: activeClusters, color: '#FBBF24' },
            { label: 'Active Alerts', value: activeAlerts, color: '#F97316' },
          ].map((s, i) => (
            <div key={i} style={S.card}>
              <div style={S.statLabel}>{s.label}</div>
              <div style={{ ...S.statValue, color: s.color || '#fff' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={S.filterBar}>
          <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>Risk Level:</span>
          <select style={S.select} value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="high">High (65+)</option>
            <option value="medium">Medium (40-64)</option>
            <option value="low">Low (&lt;40)</option>
          </select>
        </div>

        {/* Regions table */}
        <div style={{ ...S.card, padding: 0, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={S.empty}>No regions match the current filter.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Region</th>
                  <th style={S.th}>Risk Score</th>
                  <th style={S.th}>Outbreak Probability</th>
                  <th style={S.th}>Dominant Risk</th>
                  <th style={S.th}>Trend</th>
                  <th style={S.th}>Active Clusters</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const score = r.riskScore ?? r.risk_score ?? 0;
                  const prob = r.outbreakProbability ?? r.outbreak_probability ?? 0;
                  const dominant = r.dominantRisk ?? r.dominant_risk ?? '-';
                  const trend = trendIcon(r.trend ?? r.direction ?? 'stable');
                  const clusterCount = r.activeClusters ?? r.active_clusters ?? 0;
                  return (
                    <tr key={r.id || idx}>
                      <td style={S.td}>{r.region ?? r.name ?? '-'}</td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, background: `${riskColor(score)}22`, color: riskColor(score) }}>
                          {score}
                        </span>
                      </td>
                      <td style={S.td}>{typeof prob === 'number' ? `${(prob * 100).toFixed(0)}%` : prob}</td>
                      <td style={S.td}>{dominant}</td>
                      <td style={S.td}>
                        <span style={{ color: trend.color, fontWeight: 700, fontSize: '1.1rem' }}>{trend.symbol}</span>
                      </td>
                      <td style={S.td}>{clusterCount}</td>
                      <td style={S.td}>
                        <button style={S.actionBtn}>View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Outbreak clusters */}
        <h2 style={S.sectionTitle}>Active Outbreak Clusters</h2>
        {clusters.length === 0 ? (
          <div style={S.empty}>No outbreak clusters detected.</div>
        ) : (
          <div style={S.clusterGrid}>
            {clusters.map((c, idx) => {
              const st = clusterStatusColor(c.status || 'active');
              return (
                <div key={c.id || idx} style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>{c.region ?? c.regionKey ?? '-'}</span>
                    <span style={{ ...S.badge, background: st.bg, color: st.color }}>{c.status || 'active'}</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Likely issue: {c.likelyIssue ?? c.likely_issue ?? '-'}
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    <span>Farms: <strong>{c.farmCount ?? c.farm_count ?? 0}</strong></span>
                    <span>Score: <strong>{c.clusterScore ?? c.cluster_score ?? 0}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
