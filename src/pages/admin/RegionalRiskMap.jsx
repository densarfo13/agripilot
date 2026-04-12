import React, { useState, useMemo } from 'react';
import { useRegionalRisk } from '../../hooks/useIntelligenceAdmin.js';
import SeverityBar from '../../components/intelligence/SeverityBar.jsx';

// ─── Helpers ────────────────────────────────────────────────

function trendDisplay(direction) {
  if (direction === 'increasing') return { symbol: '\u2191', color: '#EF4444', label: 'Increasing' };
  if (direction === 'decreasing') return { symbol: '\u2193', color: '#22C55E', label: 'Decreasing' };
  return { symbol: '\u2192', color: '#FBBF24', label: 'Stable' };
}

function clusterStatusColor(status) {
  if (status === 'active') return { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' };
  if (status === 'monitoring') return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
  return { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' };
}

function confidenceLevelDisplay(level) {
  if (level === 'confirmed') return { label: 'Confirmed', bg: 'rgba(34,197,94,0.15)', color: '#22C55E' };
  if (level === 'probable') return { label: 'Probable', bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
  return { label: 'Low Confidence', bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' };
}

function riskLevel(score) {
  if (score >= 80) return 'urgent';
  if (score >= 65) return 'high';
  if (score >= 40) return 'moderate';
  return 'low';
}

function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return String(d); }
}

// ─── Component ──────────────────────────────────────────────

export default function RegionalRiskMap() {
  const { regions, clusters, loading, error, refetch, rescore } = useRegionalRisk();
  const [riskFilter, setRiskFilter] = useState('all');
  const [expandedKey, setExpandedKey] = useState(null);
  const [rescoring, setRescoring] = useState(null);

  // ── Sorted + filtered regions ──
  const sorted = useMemo(() => {
    const list = Array.isArray(regions) ? [...regions] : [];
    list.sort((a, b) => (b.riskScore ?? b.risk_score ?? 0) - (a.riskScore ?? a.risk_score ?? 0));
    return list;
  }, [regions]);

  const filtered = useMemo(() => {
    return sorted.filter(r => {
      if (riskFilter === 'all') return true;
      const score = r.riskScore ?? r.risk_score ?? 0;
      return riskLevel(score) === riskFilter;
    });
  }, [sorted, riskFilter]);

  // ── Stats ──
  const totalRegions = sorted.length;
  const highRiskCount = sorted.filter(r => (r.riskScore ?? r.risk_score ?? 0) >= 65).length;
  const activeClusters = Array.isArray(clusters) ? clusters.filter(c => c.status === 'active').length : 0;
  const avgRisk = totalRegions > 0
    ? Math.round(sorted.reduce((sum, r) => sum + (r.riskScore ?? r.risk_score ?? 0), 0) / totalRegions)
    : 0;

  // ── Rescore handler ──
  async function handleRescore(regionKey) {
    setRescoring(regionKey);
    try { await rescore(regionKey); }
    catch { /* error handled by hook */ }
    finally { setRescoring(null); }
  }

  // ── Clusters for an expanded region ──
  function clustersForRegion(regionKey) {
    if (!Array.isArray(clusters)) return [];
    return clusters.filter(c => (c.regionKey ?? c.region_key ?? c.region) === regionKey);
  }

  // ── Render ──
  return (
    <div style={S.page}>
      <h1 style={S.title}>Regional Risk Intelligence</h1>
      <p style={S.subtitle}>Overview of risk levels, trends, and outbreak clusters across all monitored regions.</p>

      {/* Error banner */}
      {error && (
        <div style={S.errorBanner}>
          <span>Error: {error}</span>
          <button style={{ ...S.btn, ...S.btnOutline }} onClick={refetch}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={S.emptyState}>
          <div style={S.spinner} /><br />Loading regional data...
        </div>
      )}

      {!loading && (
        <>
          {/* Stats bar */}
          <div style={S.statsRow}>
            {[
              { label: 'Total Regions', value: totalRegions },
              { label: 'High Risk', value: highRiskCount, color: '#EF4444' },
              { label: 'Active Clusters', value: activeClusters, color: '#FBBF24' },
              { label: 'Avg Risk Score', value: avgRisk, color: avgRisk >= 65 ? '#EF4444' : avgRisk >= 40 ? '#FBBF24' : '#22C55E' },
            ].map((s, i) => (
              <div key={i} style={S.statCard}>
                <div style={S.statLabel}>{s.label}</div>
                <div style={{ ...S.statValue, color: s.color || '#fff' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div style={S.filterRow}>
            <select style={S.select} value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
              <option value="all">All Risk Levels</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <button style={{ ...S.btn, ...S.btnOutline }} onClick={refetch}>&#x21bb; Refresh</button>
          </div>

          {/* Regions table */}
          {filtered.length === 0 ? (
            <div style={S.emptyState}>No regions match the selected filter.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Region</th>
                    <th style={{ ...S.th, minWidth: 140 }}>Risk Score</th>
                    <th style={S.th}>Confidence</th>
                    <th style={S.th}>Trend</th>
                    <th style={S.th}>Outbreak Prob.</th>
                    <th style={S.th}>Dominant Threat</th>
                    <th style={S.th}>Last Updated</th>
                    <th style={S.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => {
                    const score = r.riskScore ?? r.risk_score ?? 0;
                    const regionKey = r.regionKey ?? r.region_key ?? r.id ?? r.region ?? `region-${idx}`;
                    const trend = trendDisplay(r.trend ?? r.direction ?? 'stable');
                    const prob = r.outbreakProbability ?? r.outbreak_probability ?? 0;
                    const dominant = r.dominantThreat ?? r.dominant_threat ?? r.dominantRisk ?? r.dominant_risk ?? '-';
                    const updated = r.lastUpdated ?? r.last_updated ?? r.updatedAt ?? r.updated_at ?? null;
                    const isExpanded = expandedKey === regionKey;
                    const regionClusters = clustersForRegion(regionKey);

                    const confLevel = r.confidenceLevel ?? r.confidence_level ?? null;
                    const confDisplay = confLevel ? confidenceLevelDisplay(confLevel) : null;
                    const signalCount = r.signalCount ?? r.signal_count ?? null;

                    return (
                      <React.Fragment key={regionKey}>
                        <tr
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedKey(isExpanded ? null : regionKey)}
                        >
                          <td style={S.td}>{r.region ?? r.name ?? regionKey}</td>
                          <td style={S.td}>
                            <SeverityBar score={score} />
                          </td>
                          <td style={S.td}>
                            {confDisplay ? (
                              <span style={{ ...S.badge, background: confDisplay.bg, color: confDisplay.color }}>
                                {confDisplay.label}
                              </span>
                            ) : (
                              <span style={{ color: '#64748B', fontSize: '0.8rem' }}>-</span>
                            )}
                            {signalCount != null && (
                              <span style={{ fontSize: '0.7rem', color: '#64748B', marginLeft: 6 }}>
                                ({signalCount} signals)
                              </span>
                            )}
                          </td>
                          <td style={S.td}>
                            <span style={{ color: trend.color, fontWeight: 700, fontSize: '1.1rem', marginRight: 6 }}>{trend.symbol}</span>
                            <span style={{ color: trend.color, fontSize: '0.8rem' }}>{trend.label}</span>
                          </td>
                          <td style={S.td}>{typeof prob === 'number' ? `${Math.round(prob > 1 ? prob : prob * 100)}%` : prob}</td>
                          <td style={S.td}>{dominant}</td>
                          <td style={S.td}>{formatDate(updated)}</td>
                          <td style={S.td}>
                            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{isExpanded ? '\u25B2' : '\u25BC'}</span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} style={S.expandedRow}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Clusters for {r.region ?? r.name ?? regionKey}</span>
                                <button
                                  style={{ ...S.btn, ...S.btnGreen }}
                                  disabled={rescoring === regionKey}
                                  onClick={e => { e.stopPropagation(); handleRescore(regionKey); }}
                                >
                                  {rescoring === regionKey ? <span style={S.spinner} /> : 'Rescore Region'}
                                </button>
                              </div>
                              {regionClusters.length === 0 ? (
                                <div style={{ color: '#64748B', fontSize: '0.85rem' }}>No clusters detected in this region.</div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                                  {regionClusters.map((c, ci) => {
                                    const cst = clusterStatusColor(c.status || 'active');
                                    return (
                                      <div key={c.id || ci} style={{ ...S.statCard, padding: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.dominantCrop ?? c.dominant_crop ?? 'Unknown crop'}</span>
                                          <span style={{ ...S.badge, background: cst.bg, color: cst.color }}>{c.status || 'active'}</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '0.25rem' }}>
                                          Likely issue: {c.likelyIssue ?? c.likely_issue ?? '-'}
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                                          <span>Farms: <strong style={{ color: '#fff' }}>{c.farmCount ?? c.farm_count ?? 0}</strong></span>
                                          <span>Confidence: <strong style={{ color: '#fff' }}>{c.confidenceScore ?? c.confidence_score ?? c.clusterScore ?? c.cluster_score ?? 0}</strong></span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Clusters section */}
          {Array.isArray(clusters) && clusters.length > 0 && (
            <>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '2rem 0 1rem' }}>All Outbreak Clusters</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {clusters.map((c, ci) => {
                  const cst = clusterStatusColor(c.status || 'active');
                  return (
                    <div key={c.id || ci} style={S.statCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 600 }}>{c.region ?? c.regionKey ?? c.region_key ?? '-'}</span>
                        <span style={{ ...S.badge, background: cst.bg, color: cst.color }}>{c.status || 'active'}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '0.25rem' }}>
                        Crop: {c.dominantCrop ?? c.dominant_crop ?? '-'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '0.25rem' }}>
                        Likely issue: {c.likelyIssue ?? c.likely_issue ?? '-'}
                      </div>
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        <span>Farms: <strong style={{ color: '#fff' }}>{c.farmCount ?? c.farm_count ?? 0}</strong></span>
                        <span>Confidence: <strong style={{ color: '#fff' }}>{c.confidenceScore ?? c.confidence_score ?? c.clusterScore ?? c.cluster_score ?? 0}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
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
