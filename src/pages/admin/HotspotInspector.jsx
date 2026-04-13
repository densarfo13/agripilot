import React, { useState, useMemo } from 'react';
import { useAdminHotspots } from '../../hooks/useIntelligenceAdmin.js';
import SeverityBar from '../../components/intelligence/SeverityBar.jsx';

// ─── Helpers ────────────────────────────────────────────────

function severityColor(sev) {
  switch (sev) {
    case 'critical': return { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' };
    case 'high':     return { bg: 'rgba(249,115,22,0.15)', color: '#FB923C' };
    case 'moderate': return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
    default:         return { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' };
  }
}

function statusColor(st) {
  switch (st) {
    case 'active':      return { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' };
    case 'inspected':   return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
    case 'resolved':    return { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' };
    case 'false_alarm': return { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' };
    default:            return { bg: 'rgba(255,255,255,0.08)', color: '#94A3B8' };
  }
}

function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return String(d); }
}

function shortId(id) {
  if (!id) return '-';
  const s = String(id);
  return s.length > 12 ? s.slice(0, 8) + '...' : s;
}

// ─── Component ──────────────────────────────────────────────

export default function HotspotInspector() {
  const { hotspots, loading, error, refetch, markStatus } = useAdminHotspots();
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // "id:status"

  const list = Array.isArray(hotspots) ? hotspots : [];

  // ── Filtered ──
  const filtered = useMemo(() => {
    return list.filter(h => {
      const sev = h.severity || 'low';
      const st = h.status || 'active';
      if (severityFilter !== 'all' && sev !== severityFilter) return false;
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      return true;
    });
  }, [list, severityFilter, statusFilter]);

  // ── Stats ──
  const totalHotspots = list.length;
  const activeCount = list.filter(h => (h.status || 'active') === 'active').length;
  const criticalCount = list.filter(h => h.severity === 'critical').length;
  const resolvedCount = list.filter(h => h.status === 'resolved').length;

  // ── Mark status handler ──
  async function handleMarkStatus(hotspotId, status) {
    const key = `${hotspotId}:${status}`;
    setActionLoading(key);
    try { await markStatus(hotspotId, status); }
    catch { /* error surfaced by hook */ }
    finally { setActionLoading(null); }
  }

  return (
    <div style={S.page}>
      <h1 style={S.title}>Hotspot Inspector</h1>
      <p style={S.subtitle}>Review, inspect, and manage detected hotspots across all farms.</p>

      {error && (
        <div style={S.errorBanner}>
          <span>Error: {error}</span>
          <button style={{ ...S.btn, ...S.btnOutline }} onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {loading && (
        <div style={S.emptyState}>
          <div style={S.spinner} /><br />Loading hotspot data...
        </div>
      )}

      {!loading && (
        <>
          {/* Stats bar */}
          <div style={S.statsRow}>
            {[
              { label: 'Total Hotspots', value: totalHotspots },
              { label: 'Active', value: activeCount, color: '#60A5FA' },
              { label: 'Critical', value: criticalCount, color: '#EF4444' },
              { label: 'Resolved', value: resolvedCount, color: '#22C55E' },
            ].map((s, i) => (
              <div key={i} style={S.statCard}>
                <div style={S.statLabel}>{s.label}</div>
                <div style={{ ...S.statValue, color: s.color || '#fff' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div style={S.filterRow}>
            <select style={S.select} value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
              <option value="all">All Severities</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inspected">Inspected</option>
              <option value="resolved">Resolved</option>
              <option value="false_alarm">False Alarm</option>
            </select>
            <button style={{ ...S.btn, ...S.btnOutline }} onClick={() => refetch()}>&#x21bb; Refresh</button>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div style={S.emptyState}>No hotspots match the current filters.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Zone ID</th>
                    <th style={S.th}>Severity</th>
                    <th style={S.th}>Status</th>
                    <th style={{ ...S.th, minWidth: 120 }}>Score</th>
                    <th style={S.th}>Area</th>
                    <th style={S.th}>Detected</th>
                    <th style={S.th}>Profile ID</th>
                    <th style={S.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h, idx) => {
                    const id = h.id || h.hotspotId || h.hotspot_id || idx;
                    const sev = h.severity || 'low';
                    const st = h.status || 'active';
                    const sevC = severityColor(sev);
                    const stC = statusColor(st);
                    const score = h.hotspotScore ?? h.hotspot_score ?? h.score ?? 0;
                    const area = h.area ?? h.areaHa ?? h.area_ha ?? '-';
                    const detected = h.detectedAt ?? h.detected_at ?? h.createdAt ?? h.created_at ?? null;
                    const profileId = h.profileId ?? h.profile_id ?? '-';
                    const isExpanded = expandedId === id;
                    const meta = h.metadata ?? h.zone_metadata ?? {};
                    const droneScans = h.droneScans ?? h.drone_scans ?? [];

                    return (
                      <React.Fragment key={id}>
                        <tr
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedId(isExpanded ? null : id)}
                        >
                          <td style={S.td}><span title={String(id)}>{shortId(id)}</span></td>
                          <td style={S.td}>
                            <span style={{ ...S.badge, background: sevC.bg, color: sevC.color }}>{sev}</span>
                          </td>
                          <td style={S.td}>
                            <span style={{ ...S.badge, background: stC.bg, color: stC.color }}>{st.replace('_', ' ')}</span>
                          </td>
                          <td style={S.td}><SeverityBar score={score} /></td>
                          <td style={S.td}>{typeof area === 'number' ? `${area} ha` : area}</td>
                          <td style={S.td}>{formatDate(detected)}</td>
                          <td style={S.td}><span title={String(profileId)}>{shortId(profileId)}</span></td>
                          <td style={S.td}>
                            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{isExpanded ? '\u25B2' : '\u25BC'}</span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} style={S.expandedRow}>
                              {/* Metadata */}
                              <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Metadata</div>
                              {Object.keys(meta).length === 0 ? (
                                <div style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '0.75rem' }}>No metadata available.</div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                  {Object.entries(meta).map(([key, val]) => (
                                    <div key={key}>
                                      <div style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>{key}</div>
                                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Drone scans */}
                              {droneScans.length > 0 && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Linked Drone Scans</div>
                                  <table style={{ ...S.table, fontSize: '0.8rem' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ ...S.th, fontSize: '0.7rem' }}>Scan Date</th>
                                        <th style={{ ...S.th, fontSize: '0.7rem' }}>Imagery URL</th>
                                        <th style={{ ...S.th, fontSize: '0.7rem' }}>Validation Score</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {droneScans.map((scan, si) => (
                                        <tr key={si}>
                                          <td style={S.td}>{formatDate(scan.date ?? scan.scanDate ?? scan.scan_date ?? scan.createdAt ?? scan.created_at)}</td>
                                          <td style={S.td}>
                                            {scan.imageryUrl ?? scan.imagery_url ?? scan.url
                                              ? <a href={scan.imageryUrl ?? scan.imagery_url ?? scan.url} target="_blank" rel="noopener noreferrer" style={{ color: '#60A5FA', textDecoration: 'underline' }}>View</a>
                                              : '-'}
                                          </td>
                                          <td style={S.td}>{scan.validationScore ?? scan.validation_score ?? '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Action buttons */}
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {st !== 'inspected' && st !== 'resolved' && st !== 'false_alarm' && (
                                  <button
                                    style={{ ...S.btn, ...S.btnOutline, color: '#FBBF24', borderColor: '#FBBF24' }}
                                    disabled={actionLoading === `${id}:inspected`}
                                    onClick={e => { e.stopPropagation(); handleMarkStatus(id, 'inspected'); }}
                                  >
                                    {actionLoading === `${id}:inspected` ? <span style={S.spinner} /> : 'Mark Inspected'}
                                  </button>
                                )}
                                {st !== 'resolved' && (
                                  <button
                                    style={{ ...S.btn, ...S.btnGreen }}
                                    disabled={actionLoading === `${id}:resolved`}
                                    onClick={e => { e.stopPropagation(); handleMarkStatus(id, 'resolved'); }}
                                  >
                                    {actionLoading === `${id}:resolved` ? <span style={S.spinner} /> : 'Mark Resolved'}
                                  </button>
                                )}
                                {st !== 'false_alarm' && st !== 'resolved' && (
                                  <button
                                    style={{ ...S.btn, ...S.btnRed }}
                                    disabled={actionLoading === `${id}:false_alarm`}
                                    onClick={e => { e.stopPropagation(); handleMarkStatus(id, 'false_alarm'); }}
                                  >
                                    {actionLoading === `${id}:false_alarm` ? <span style={S.spinner} /> : 'Mark False Alarm'}
                                  </button>
                                )}
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
