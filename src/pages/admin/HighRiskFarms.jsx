import React, { useState, useEffect, useCallback } from 'react';
import { getHighRiskFarms, triggerFarmScoring } from '../../lib/intelligenceAdminApi';

// ─── Helpers ────────────────────────────────────────────────

function riskColor(score) {
  if (score >= 80) return '#EF4444';
  if (score >= 65) return '#F97316';
  if (score >= 40) return '#FBBF24';
  return '#22C55E';
}

function levelBadge(level) {
  if (level === 'urgent') return { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' };
  return { bg: 'rgba(249,115,22,0.15)', color: '#F97316' };
}

// ─── Styles ─────────────────────────────────────────────────

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', padding: '1.5rem' },
  container: { maxWidth: '80rem', margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700 },
  countBadge: {
    display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px',
    fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: '#FCA5A5',
  },
  filterBar: { display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' },
  select: {
    padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
    background: '#1B2330', color: '#fff', fontSize: '0.875rem',
  },
  label: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' },
  card: {
    borderRadius: '16px', background: '#1B2330', padding: 0,
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px rgba(0,0,0,0.3)', overflow: 'auto',
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
  actionBtn: {
    padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', color: '#22C55E', cursor: 'pointer', fontSize: '0.75rem', marginRight: '0.5rem',
  },
  rescoreBtn: {
    padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', color: '#FBBF24', cursor: 'pointer', fontSize: '0.75rem',
  },
  pagination: {
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.25rem',
  },
  pageBtn: {
    padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '0.875rem',
  },
  pageBtnDisabled: {
    padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)',
    background: 'transparent', color: 'rgba(255,255,255,0.3)', cursor: 'default', fontSize: '0.875rem',
  },
  riskScore: { fontSize: '1.25rem', fontWeight: 700 },
  farmLink: { color: '#22C55E', cursor: 'pointer', textDecoration: 'none', fontWeight: 500 },
  error: { color: '#FCA5A5', padding: '2rem', textAlign: 'center' },
  loading: { color: 'rgba(255,255,255,0.6)', padding: '2rem', textAlign: 'center' },
  empty: { color: 'rgba(255,255,255,0.6)', padding: '2rem', textAlign: 'center' },
};

// ─── Component ──────────────────────────────────────────────

export default function HighRiskFarms() {
  const [farms, setFarms] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [riskFilter, setRiskFilter] = useState('all');
  const [cropFilter, setCropFilter] = useState('all');
  const LIMIT = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHighRiskFarms(page, LIMIT);
      setFarms(res.farms || res.data || []);
      setTotal(res.total ?? (res.farms || res.data || []).length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived ──
  const cropTypes = [...new Set(farms.map(f => f.crop ?? f.cropType ?? f.crop_type ?? ''))].filter(Boolean);

  const filtered = farms.filter(f => {
    const score = f.riskScore ?? f.risk_score ?? 0;
    const level = f.riskLevel ?? f.risk_level ?? '';
    const crop = f.crop ?? f.cropType ?? f.crop_type ?? '';
    if (riskFilter === 'high' && level !== 'high' && score < 65) return false;
    if (riskFilter === 'urgent' && level !== 'urgent' && score < 80) return false;
    if (cropFilter !== 'all' && crop !== cropFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  async function handleRescore(profileId) {
    try {
      await triggerFarmScoring(profileId);
      fetchData();
    } catch (err) {
      alert('Rescore failed: ' + err.message);
    }
  }

  // ── Render ──
  if (loading) return <div style={S.page}><div style={S.loading}>Loading...</div></div>;
  if (error) return <div style={S.page}><div style={S.error}>Error: {error}</div></div>;

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={S.header}>
          <h1 style={S.title}>High-Risk Farms</h1>
          <span style={S.countBadge}>{total}</span>
        </div>

        {/* Filter bar */}
        <div style={S.filterBar}>
          <span style={S.label}>Risk Level:</span>
          <select style={S.select} value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <span style={S.label}>Crop:</span>
          <select style={S.select} value={cropFilter} onChange={e => setCropFilter(e.target.value)}>
            <option value="all">All Crops</option>
            {cropTypes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={S.card}>
          {filtered.length === 0 ? (
            <div style={S.empty}>No high-risk farms match the current filters.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Farm Name</th>
                  <th style={S.th}>Farmer</th>
                  <th style={S.th}>Crop</th>
                  <th style={S.th}>Risk Score</th>
                  <th style={S.th}>Risk Level</th>
                  <th style={S.th}>Hotspots</th>
                  <th style={S.th}>Last Scan</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, idx) => {
                  const score = f.riskScore ?? f.risk_score ?? 0;
                  const level = f.riskLevel ?? f.risk_level ?? 'high';
                  const lb = levelBadge(level);
                  const hotspots = f.hotspots ?? f.hotspot_count ?? 0;
                  const lastScan = f.lastScan ?? f.last_scan ?? '-';
                  const profileId = f.profileId ?? f.profile_id ?? f.id;
                  return (
                    <tr key={f.id || idx}>
                      <td style={S.td}>
                        <span style={S.farmLink} onClick={() => console.log('Navigate to farm:', profileId)}>
                          {f.farmName ?? f.farm_name ?? f.name ?? '-'}
                        </span>
                      </td>
                      <td style={S.td}>{f.farmerName ?? f.farmer_name ?? f.farmer ?? '-'}</td>
                      <td style={S.td}>{f.crop ?? f.cropType ?? f.crop_type ?? '-'}</td>
                      <td style={S.td}>
                        <span style={{ ...S.riskScore, color: riskColor(score) }}>{score}</span>
                      </td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, background: lb.bg, color: lb.color }}>{level}</span>
                      </td>
                      <td style={S.td}>{hotspots}</td>
                      <td style={S.td}>{lastScan}</td>
                      <td style={S.td}>
                        <button style={S.actionBtn} onClick={() => console.log('View details:', profileId)}>
                          View Details
                        </button>
                        <button style={S.rescoreBtn} onClick={() => handleRescore(profileId)}>
                          Trigger Rescore
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div style={S.pagination}>
          <button
            style={page <= 1 ? S.pageBtnDisabled : S.pageBtn}
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            style={page >= totalPages ? S.pageBtnDisabled : S.pageBtn}
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
