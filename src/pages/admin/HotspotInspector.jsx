import React, { useState, useEffect, useCallback } from 'react';
import { getAdminHotspots } from '../../lib/intelligenceAdminApi';

// ─── Helpers ────────────────────────────────────────────────

function severityStyle(severity) {
  switch (severity) {
    case 'critical': return { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' };
    case 'high':     return { bg: 'rgba(249,115,22,0.15)', color: '#F97316' };
    case 'moderate': return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
    default:         return { bg: 'rgba(34,197,94,0.15)',  color: '#22C55E' };
  }
}

function statusStyle(status) {
  switch (status) {
    case 'active':      return { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' };
    case 'inspected':   return { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' };
    case 'resolved':    return { bg: 'rgba(34,197,94,0.15)',  color: '#22C55E' };
    case 'false_alarm': return { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' };
    default:            return { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' };
  }
}

// ─── Styles ─────────────────────────────────────────────────

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', padding: '1.5rem' },
  container: { maxWidth: '80rem', margin: '0 auto' },
  header: { marginBottom: '1.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700 },
  filterBar: { display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' },
  label: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' },
  select: {
    padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
    background: '#1B2330', color: '#fff', fontSize: '0.875rem',
  },
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
  expandBtn: {
    padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', color: '#22C55E', cursor: 'pointer', fontSize: '0.75rem',
  },
  detailRow: {
    background: 'rgba(255,255,255,0.03)',
  },
  detailCell: { padding: '1rem 1rem 1rem 2rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' },
  metaGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem',
  },
  metaLabel: { fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.15rem' },
  metaValue: { fontWeight: 500 },
  error: { color: '#FCA5A5', padding: '2rem', textAlign: 'center' },
  loading: { color: 'rgba(255,255,255,0.6)', padding: '2rem', textAlign: 'center' },
  empty: { color: 'rgba(255,255,255,0.6)', padding: '2rem', textAlign: 'center' },
};

// ─── Component ──────────────────────────────────────────────

export default function HotspotInspector() {
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminHotspots();
      setHotspots(res.hotspots || res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = hotspots.filter(h => {
    const sev = h.severity || 'low';
    const st = h.status || 'active';
    if (severityFilter !== 'all' && sev !== severityFilter) return false;
    if (statusFilter !== 'all' && st !== statusFilter) return false;
    return true;
  });

  if (loading) return <div style={S.page}><div style={S.loading}>Loading...</div></div>;
  if (error) return <div style={S.page}><div style={S.error}>Error: {error}</div></div>;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <h1 style={S.title}>Hotspot Inspector</h1>
        </div>

        {/* Filter bar */}
        <div style={S.filterBar}>
          <span style={S.label}>Severity:</span>
          <select style={S.select} value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <span style={S.label}>Status:</span>
          <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inspected">Inspected</option>
            <option value="resolved">Resolved</option>
            <option value="false_alarm">False Alarm</option>
          </select>
        </div>

        {/* Table */}
        <div style={S.card}>
          {filtered.length === 0 ? (
            <div style={S.empty}>No hotspots match the current filters.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Farm</th>
                  <th style={S.th}>Source Type</th>
                  <th style={S.th}>Severity</th>
                  <th style={S.th}>Hotspot Score</th>
                  <th style={S.th}>Inspection Priority</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Created</th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, idx) => {
                  const id = h.id || idx;
                  const sev = h.severity || 'low';
                  const st = h.status || 'active';
                  const sevS = severityStyle(sev);
                  const stS = statusStyle(st);
                  const isExpanded = expandedId === id;
                  const meta = h.metadata ?? h.zone_metadata ?? {};
                  const droneScans = h.droneScans ?? h.drone_scans ?? [];

                  return (
                    <React.Fragment key={id}>
                      <tr>
                        <td style={S.td}>{h.farmName ?? h.farm_name ?? h.farm ?? '-'}</td>
                        <td style={S.td}>{h.sourceType ?? h.source_type ?? '-'}</td>
                        <td style={S.td}>
                          <span style={{ ...S.badge, background: sevS.bg, color: sevS.color }}>{sev}</span>
                        </td>
                        <td style={S.td}>{h.hotspotScore ?? h.hotspot_score ?? h.score ?? '-'}</td>
                        <td style={S.td}>{h.inspectionPriority ?? h.inspection_priority ?? '-'}</td>
                        <td style={S.td}>
                          <span style={{ ...S.badge, background: stS.bg, color: stS.color }}>{st.replace('_', ' ')}</span>
                        </td>
                        <td style={S.td}>{h.createdAt ?? h.created_at ?? '-'}</td>
                        <td style={S.td}>
                          <button style={S.expandBtn} onClick={() => setExpandedId(isExpanded ? null : id)}>
                            {isExpanded ? 'Collapse' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={S.detailRow}>
                          <td colSpan={8} style={S.detailCell}>
                            <div style={S.metaGrid}>
                              {Object.entries(meta).map(([key, val]) => (
                                <div key={key}>
                                  <div style={S.metaLabel}>{key}</div>
                                  <div style={S.metaValue}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
                                </div>
                              ))}
                              {Object.keys(meta).length === 0 && (
                                <div style={{ color: 'rgba(255,255,255,0.4)' }}>No metadata available</div>
                              )}
                            </div>
                            {droneScans.length > 0 && (
                              <div style={{ marginTop: '0.75rem' }}>
                                <div style={{ ...S.metaLabel, marginBottom: '0.35rem' }}>Linked Drone Scans</div>
                                {droneScans.map((scan, si) => (
                                  <div key={si} style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                                    Scan {scan.id ?? si + 1} — {scan.status ?? 'pending'} — {scan.date ?? scan.createdAt ?? '-'}
                                  </div>
                                ))}
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
          )}
        </div>
      </div>
    </div>
  );
}
