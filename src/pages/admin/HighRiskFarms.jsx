import React, { useState, useMemo } from 'react';
import { useHighRiskFarms } from '../../hooks/useIntelligenceAdmin.js';
import RiskLevelBadge from '../../components/intelligence/RiskLevelBadge.jsx';
import SeverityBar from '../../components/intelligence/SeverityBar.jsx';

// ─── Helpers ────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return String(d); }
}

const SCORE_COMPONENTS = [
  { key: 'boundary', label: 'Boundary Risk' },
  { key: 'scan', label: 'Scan Analysis' },
  { key: 'weather', label: 'Weather Impact' },
  { key: 'historical', label: 'Historical Pattern' },
  { key: 'crop', label: 'Crop Vulnerability' },
  { key: 'regional', label: 'Regional Pressure' },
  { key: 'temporal', label: 'Temporal Risk' },
];

// ─── Component ──────────────────────────────────────────────

export default function HighRiskFarms() {
  const { farms, loading, error, refetch, rescore, filters, setFilters, pagination } = useHighRiskFarms();
  const [expandedId, setExpandedId] = useState(null);
  const [rescoring, setRescoring] = useState(null);
  const [localRisk, setLocalRisk] = useState('all');
  const [localCrop, setLocalCrop] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const farmList = Array.isArray(farms) ? farms : [];

  // ── Crop types derived from data ──
  const cropTypes = useMemo(() => {
    const set = new Set();
    farmList.forEach(f => {
      const crop = f.crop ?? f.cropType ?? f.crop_type ?? '';
      if (crop) set.add(crop);
    });
    return [...set].sort();
  }, [farmList]);

  // ── Client-side filtering ──
  const filtered = useMemo(() => {
    return farmList.filter(f => {
      const level = f.riskLevel ?? f.risk_level ?? '';
      const crop = f.crop ?? f.cropType ?? f.crop_type ?? '';
      const name = (f.farmName ?? f.farm_name ?? f.name ?? '').toLowerCase();
      const id = String(f.profileId ?? f.profile_id ?? f.id ?? '').toLowerCase();
      if (localRisk !== 'all' && level !== localRisk) return false;
      if (localCrop !== 'all' && crop !== localCrop) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!name.includes(q) && !id.includes(q)) return false;
      }
      return true;
    });
  }, [farmList, localRisk, localCrop, searchTerm]);

  // ── Stats ──
  const totalFarms = pagination?.total ?? farmList.length;
  const urgentCount = farmList.filter(f => (f.riskLevel ?? f.risk_level) === 'urgent').length;
  const highCount = farmList.filter(f => (f.riskLevel ?? f.risk_level) === 'high').length;
  const avgScore = farmList.length > 0
    ? Math.round(farmList.reduce((s, f) => s + (f.riskScore ?? f.risk_score ?? 0), 0) / farmList.length)
    : 0;

  // ── Pagination ──
  const currentPage = pagination?.page ?? filters.page ?? 1;
  const totalPages = pagination?.totalPages ?? (pagination?.total ? Math.ceil(pagination.total / (filters.limit || 20)) : 1);

  function goPage(p) {
    setFilters({ page: p });
  }

  // ── Rescore handler ──
  async function handleRescore(profileId) {
    setRescoring(profileId);
    try { await rescore(profileId); }
    catch { /* error surfaced by hook */ }
    finally { setRescoring(null); }
  }

  // ── Render ──
  return (
    <div style={S.page}>
      <h1 style={S.title}>High-Risk Farms</h1>
      <p style={S.subtitle}>Monitor and rescore farms with elevated risk levels.</p>

      {error && (
        <div style={S.errorBanner}>
          <span>Error: {error}</span>
          <button style={{ ...S.btn, ...S.btnOutline }} onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {loading && (
        <div style={S.emptyState}>
          <div style={S.spinner} /><br />Loading farm data...
        </div>
      )}

      {!loading && (
        <>
          {/* Stats bar */}
          <div style={S.statsRow}>
            {[
              { label: 'Total Farms', value: totalFarms },
              { label: 'Urgent', value: urgentCount, color: '#EF4444' },
              { label: 'High', value: highCount, color: '#FB923C' },
              { label: 'Average Score', value: avgScore, color: avgScore >= 65 ? '#EF4444' : avgScore >= 40 ? '#FBBF24' : '#22C55E' },
            ].map((s, i) => (
              <div key={i} style={S.statCard}>
                <div style={S.statLabel}>{s.label}</div>
                <div style={{ ...S.statValue, color: s.color || '#fff' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div style={S.filterRow}>
            <select style={S.select} value={localRisk} onChange={e => setLocalRisk(e.target.value)}>
              <option value="all">All Risk Levels</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select style={S.select} value={localCrop} onChange={e => setLocalCrop(e.target.value)}>
              <option value="all">All Crops</option>
              {cropTypes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              style={{ ...S.select, minWidth: 180 }}
              type="text"
              placeholder="Search farm name or ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button style={{ ...S.btn, ...S.btnOutline }} onClick={() => refetch()}>&#x21bb; Refresh</button>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div style={S.emptyState}>No farms match the current filters.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Farm Name / ID</th>
                    <th style={S.th}>Crop</th>
                    <th style={{ ...S.th, minWidth: 130 }}>Risk Score</th>
                    <th style={S.th}>Risk Level</th>
                    <th style={S.th}>Hotspots</th>
                    <th style={S.th}>Last Scored</th>
                    <th style={S.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f, idx) => {
                    const score = f.riskScore ?? f.risk_score ?? 0;
                    const level = f.riskLevel ?? f.risk_level ?? 'high';
                    const profileId = f.profileId ?? f.profile_id ?? f.id;
                    const hotspots = f.hotspots ?? f.hotspot_count ?? f.hotspotCount ?? 0;
                    const lastScored = f.lastScored ?? f.last_scored ?? f.lastScan ?? f.last_scan ?? null;
                    const farmName = f.farmName ?? f.farm_name ?? f.name ?? '-';
                    const crop = f.crop ?? f.cropType ?? f.crop_type ?? '-';
                    const isExpanded = expandedId === profileId;
                    const components = f.scoreComponents ?? f.score_components ?? f.components ?? {};

                    return (
                      <React.Fragment key={profileId || idx}>
                        <tr
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedId(isExpanded ? null : profileId)}
                        >
                          <td style={S.td}>
                            <div style={{ fontWeight: 600 }}>{farmName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{profileId}</div>
                          </td>
                          <td style={S.td}>{crop}</td>
                          <td style={S.td}><SeverityBar score={score} /></td>
                          <td style={S.td}><RiskLevelBadge level={level} score={score} size="sm" /></td>
                          <td style={S.td}>{hotspots}</td>
                          <td style={S.td}>{formatDate(lastScored)}</td>
                          <td style={S.td}>
                            <button
                              style={{ ...S.btn, ...S.btnGreen }}
                              disabled={rescoring === profileId}
                              onClick={e => { e.stopPropagation(); handleRescore(profileId); }}
                            >
                              {rescoring === profileId ? <span style={S.spinner} /> : 'Rescore'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} style={S.expandedRow}>
                              <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>Scoring Components</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                {SCORE_COMPONENTS.map(comp => {
                                  const val = components[comp.key] ?? components[comp.key.replace(/([A-Z])/g, '_$1').toLowerCase()] ?? null;
                                  return (
                                    <div key={comp.key}>
                                      <SeverityBar score={val ?? 0} label={comp.label} />
                                    </div>
                                  );
                                })}
                              </div>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                style={{ ...S.btn, ...S.btnOutline, opacity: currentPage <= 1 ? 0.4 : 1 }}
                disabled={currentPage <= 1}
                onClick={() => goPage(currentPage - 1)}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .map((p, i, arr) => (
                  <React.Fragment key={p}>
                    {i > 0 && arr[i - 1] !== p - 1 && <span style={{ color: '#64748B' }}>...</span>}
                    <button
                      style={{ ...S.btn, ...(p === currentPage ? S.btnGreen : S.btnOutline), minWidth: 36 }}
                      onClick={() => goPage(p)}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))
              }
              <button
                style={{ ...S.btn, ...S.btnOutline, opacity: currentPage >= totalPages ? 0.4 : 1 }}
                disabled={currentPage >= totalPages}
                onClick={() => goPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
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
