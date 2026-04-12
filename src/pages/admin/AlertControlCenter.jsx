import React, { useState, useEffect, useCallback } from 'react';
import { getAdminAlerts } from '../../lib/intelligenceAdminApi';

// ─── Helpers ────────────────────────────────────────────────

function levelStyle(level) {
  switch (level) {
    case 'urgent':    return { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' };
    case 'high_risk': return { bg: 'rgba(249,115,22,0.15)', color: '#F97316' };
    case 'elevated':  return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
    case 'watch':     return { bg: 'rgba(59,130,246,0.15)',  color: '#60A5FA' };
    default:          return { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' };
  }
}

function statusColor(status) {
  switch (status) {
    case 'pending':    return '#FBBF24';
    case 'sent':       return '#22C55E';
    case 'suppressed': return 'rgba(255,255,255,0.4)';
    default:           return 'rgba(255,255,255,0.6)';
  }
}

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
  filterBar: { display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' },
  label: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' },
  select: {
    padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
    background: '#1B2330', color: '#fff', fontSize: '0.875rem',
  },
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
  badge: {
    display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '9999px',
    fontSize: '0.75rem', fontWeight: 600,
  },
  actionBtn: {
    padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', marginRight: '0.5rem',
  },
  expandBtn: {
    padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', color: '#22C55E', cursor: 'pointer', fontSize: '0.75rem',
  },
  detailRow: { background: 'rgba(255,255,255,0.03)' },
  detailCell: { padding: '1rem 1rem 1rem 2rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' },
  error: { color: '#FCA5A5', padding: '2rem', textAlign: 'center' },
  loading: { color: 'rgba(255,255,255,0.6)', padding: '2rem', textAlign: 'center' },
  empty: { color: 'rgba(255,255,255,0.6)', padding: '2rem', textAlign: 'center' },
};

// ─── Component ──────────────────────────────────────────────

export default function AlertControlCenter() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminAlerts();
      setAlerts(res.alerts || res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Stats ──
  const activeCount = alerts.filter(a => (a.status || '') !== 'suppressed').length;
  const suppressedCount = alerts.filter(a => a.status === 'suppressed').length;
  const pendingCount = alerts.filter(a => a.status === 'pending').length;

  // ── Filtered ──
  const filtered = alerts.filter(a => {
    const level = a.level ?? a.alertLevel ?? a.alert_level ?? '';
    const status = a.status ?? '';
    if (levelFilter !== 'all' && level !== levelFilter) return false;
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    return true;
  });

  function handleSuppress(alertId) {
    console.log('Suppress alert:', alertId);
    setAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, status: 'suppressed' } : a)));
  }

  function handleReview(alertId) {
    console.log('Review alert:', alertId);
  }

  if (loading) return <div style={S.page}><div style={S.loading}>Loading...</div></div>;
  if (error) return <div style={S.page}><div style={S.error}>Error: {error}</div></div>;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <h1 style={S.title}>Alert Control Center</h1>
        </div>

        {/* Stat cards */}
        <div style={S.statGrid}>
          {[
            { label: 'Active Alerts', value: activeCount, color: '#22C55E' },
            { label: 'Suppressed', value: suppressedCount, color: 'rgba(255,255,255,0.4)' },
            { label: 'Pending Review', value: pendingCount, color: '#FBBF24' },
          ].map((s, i) => (
            <div key={i} style={S.card}>
              <div style={S.statLabel}>{s.label}</div>
              <div style={{ ...S.statValue, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={S.filterBar}>
          <span style={S.label}>Level:</span>
          <select style={S.select} value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="watch">Watch</option>
            <option value="elevated">Elevated</option>
            <option value="high_risk">High Risk</option>
            <option value="urgent">Urgent</option>
          </select>
          <span style={S.label}>Status:</span>
          <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="suppressed">Suppressed</option>
          </select>
        </div>

        {/* Table */}
        <div style={S.tableCard}>
          {filtered.length === 0 ? (
            <div style={S.empty}>No alerts match the current filters.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Target</th>
                  <th style={S.th}>Level</th>
                  <th style={S.th}>Reason</th>
                  <th style={S.th}>Confidence</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Action Guidance</th>
                  <th style={S.th}>Sent At</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, idx) => {
                  const id = a.id || idx;
                  const level = a.level ?? a.alertLevel ?? a.alert_level ?? 'watch';
                  const ls = levelStyle(level);
                  const status = a.status ?? 'pending';
                  const isExpanded = expandedId === id;

                  return (
                    <React.Fragment key={id}>
                      <tr>
                        <td style={S.td}>{a.target ?? a.targetName ?? a.target_name ?? '-'}</td>
                        <td style={S.td}>
                          <span style={{ ...S.badge, background: ls.bg, color: ls.color }}>
                            {level.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={S.td}>{a.reason ?? '-'}</td>
                        <td style={S.td}>
                          {a.confidence != null ? `${Math.round(a.confidence * 100)}%` : '-'}
                        </td>
                        <td style={S.td}>
                          <span style={{ color: statusColor(status), fontWeight: 600 }}>{status}</span>
                        </td>
                        <td style={{ ...S.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.actionGuidance ?? a.action_guidance ?? '-'}
                        </td>
                        <td style={S.td}>{a.sentAt ?? a.sent_at ?? '-'}</td>
                        <td style={S.td}>
                          {(status === 'pending' || status === 'sent') && (
                            <button
                              style={{ ...S.actionBtn, color: '#FCA5A5' }}
                              onClick={() => handleSuppress(a.id)}
                            >
                              Suppress
                            </button>
                          )}
                          {status === 'pending' && (
                            <button
                              style={{ ...S.actionBtn, color: '#FBBF24' }}
                              onClick={() => handleReview(a.id)}
                            >
                              Review
                            </button>
                          )}
                          <button style={S.expandBtn} onClick={() => setExpandedId(isExpanded ? null : id)}>
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={S.detailRow}>
                          <td colSpan={8} style={S.detailCell}>
                            <div style={{ marginBottom: '0.5rem' }}>
                              <strong>Full Message:</strong>
                            </div>
                            <div style={{ marginBottom: '0.75rem' }}>
                              {a.message ?? a.fullMessage ?? a.full_message ?? 'No message content available.'}
                            </div>
                            {a.metadata && (
                              <>
                                <div style={{ marginBottom: '0.25rem' }}><strong>Metadata:</strong></div>
                                <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.5)' }}>
                                  {JSON.stringify(a.metadata, null, 2)}
                                </pre>
                              </>
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
