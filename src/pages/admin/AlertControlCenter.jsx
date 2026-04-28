import React, { useState, useMemo } from 'react';
import { useAdminAlerts } from '../../hooks/useIntelligenceAdmin.js';
import { ErrorState } from '../../components/admin/AdminState.jsx';

// ─── Helpers ────────────────────────────────────────────────

function levelColor(level) {
  switch (level) {
    case 'urgent':    return { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' };
    case 'high_risk': return { bg: 'rgba(249,115,22,0.15)', color: '#FB923C' };
    case 'elevated':  return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
    case 'watch':     return { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' };
    default:          return { bg: 'rgba(255,255,255,0.08)', color: '#94A3B8' };
  }
}

function statusStyle(status) {
  switch (status) {
    case 'pending':    return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
    case 'sent':       return { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' };
    case 'suppressed': return { bg: 'rgba(255,255,255,0.08)', color: '#64748B' };
    case 'expired':    return { bg: 'rgba(255,255,255,0.05)', color: '#475569' };
    default:           return { bg: 'rgba(255,255,255,0.08)', color: '#94A3B8' };
  }
}

function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(d); }
}

function shortId(id) {
  if (!id) return '-';
  const s = String(id);
  return s.length > 12 ? s.slice(0, 8) + '...' : s;
}

function truncate(str, len = 60) {
  if (!str) return '-';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// ─── Component ──────────────────────────────────────────────

export default function AlertControlCenter() {
  const { alerts, loading, error, refetch, suppressAlert, pagination, stats, filters, setFilters } = useAdminAlerts();
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [suppressingId, setSuppressingId] = useState(null);
  const [suppressReason, setSuppressReason] = useState('');
  const [suppressConfirmId, setSuppressConfirmId] = useState(null);

  const alertList = Array.isArray(alerts) ? alerts : [];

  // ── Client-side filtering ──
  const filtered = useMemo(() => {
    return alertList.filter(a => {
      const level = a.level ?? a.alertLevel ?? a.alert_level ?? '';
      const status = a.status ?? a.sentStatus ?? a.sent_status ?? '';
      if (levelFilter !== 'all' && level !== levelFilter) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      return true;
    });
  }, [alertList, levelFilter, statusFilter]);

  // ── Stats from hook ──
  const activeAlerts = stats?.active ?? alertList.filter(a => {
    const st = a.status ?? a.sentStatus ?? '';
    return st === 'pending' || st === 'sent';
  }).length;
  const pendingCount = alertList.filter(a => (a.status ?? a.sentStatus ?? '') === 'pending').length;
  const suppressedCount = stats?.suppressed ?? alertList.filter(a => (a.status ?? a.sentStatus ?? '') === 'suppressed').length;
  const totalAlerts = stats?.total ?? pagination?.total ?? alertList.length;

  // ── Pagination ──
  const currentPage = pagination?.page ?? filters.page ?? 1;
  const totalPages = pagination?.totalPages ?? (pagination?.total ? Math.ceil(pagination.total / (filters.limit || 20)) : 1);

  // ── Suppress handler ──
  async function handleSuppress(alertId) {
    if (!suppressReason.trim()) return;
    setSuppressingId(alertId);
    try {
      await suppressAlert(alertId, suppressReason.trim());
      setSuppressConfirmId(null);
      setSuppressReason('');
    } catch { /* error surfaced by hook */ }
    finally { setSuppressingId(null); }
  }

  function canSuppress(status) {
    return status !== 'suppressed' && status !== 'expired';
  }

  return (
    <div style={S.page}>
      <h1 style={S.title}>Alert Control Center</h1>
      <p style={S.subtitle}>Manage, review, and suppress intelligence alerts.</p>

      {error && (
        <div style={{ marginBottom: '1rem' }}>
          {/* useAdminAlerts surfaces a flat string error; we show
              the calm v3 ErrorState with retry so the rest of
              the page (stats, filters, table) keeps rendering. */}
          <ErrorState
            message="We could not load the alerts list. Try again in a moment."
            onRetry={() => refetch()}
            testId="alerts-load-error"
          />
        </div>
      )}

      {loading && (
        <div style={S.emptyState}>
          <div style={S.spinner} /><br />Loading alerts...
        </div>
      )}

      {!loading && (
        <>
          {/* Stats bar */}
          <div style={S.statsRow}>
            {[
              { label: 'Active Alerts', value: activeAlerts, color: '#22C55E' },
              { label: 'Pending', value: pendingCount, color: '#FBBF24' },
              { label: 'Suppressed', value: suppressedCount, color: '#64748B' },
              { label: 'Total', value: totalAlerts },
            ].map((s, i) => (
              <div key={i} style={S.statCard}>
                <div style={S.statLabel}>{s.label}</div>
                <div style={{ ...S.statValue, color: s.color || '#fff' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div style={S.filterRow}>
            <select style={S.select} value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
              <option value="all">All Levels</option>
              <option value="watch">Watch</option>
              <option value="elevated">Elevated</option>
              <option value="high_risk">High Risk</option>
              <option value="urgent">Urgent</option>
            </select>
            <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="suppressed">Suppressed</option>
              <option value="expired">Expired</option>
            </select>
            <button style={{ ...S.btn, ...S.btnOutline }} onClick={() => refetch()}>&#x21bb; Refresh</button>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div style={S.emptyState}>No alerts match the current filters.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>ID</th>
                    <th style={S.th}>Level</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Target</th>
                    <th style={S.th}>Confidence</th>
                    <th style={{ ...S.th, minWidth: 180 }}>Message</th>
                    <th style={S.th}>Created</th>
                    <th style={S.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, idx) => {
                    const id = a.id || a.alertId || a.alert_id || idx;
                    const level = a.level ?? a.alertLevel ?? a.alert_level ?? 'watch';
                    const status = a.status ?? a.sentStatus ?? a.sent_status ?? 'pending';
                    const lc = levelColor(level);
                    const sc = statusStyle(status);
                    const target = a.target ?? a.targetName ?? a.target_name ?? '-';
                    const confidence = a.confidence ?? a.confidenceScore ?? a.confidence_score ?? null;
                    const message = a.message ?? a.fullMessage ?? a.full_message ?? a.actionGuidance ?? a.action_guidance ?? '';
                    const createdAt = a.createdAt ?? a.created_at ?? null;
                    const isExpanded = expandedId === id;
                    const meta = a.metadata ?? {};
                    const suppressionReason = a.suppressionReason ?? a.suppression_reason ?? null;
                    const expiresAt = a.expiresAt ?? a.expires_at ?? null;
                    const isConfirming = suppressConfirmId === id;

                    return (
                      <React.Fragment key={id}>
                        <tr
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedId(isExpanded ? null : id)}
                        >
                          <td style={S.td}><span title={String(id)}>{shortId(id)}</span></td>
                          <td style={S.td}>
                            <span style={{ ...S.badge, background: lc.bg, color: lc.color }}>{level.replace('_', ' ')}</span>
                          </td>
                          <td style={S.td}>
                            <span style={{ ...S.badge, background: sc.bg, color: sc.color }}>{status}</span>
                          </td>
                          <td style={S.td}>{target}</td>
                          <td style={S.td}>{confidence != null ? `${Math.round(typeof confidence === 'number' && confidence <= 1 ? confidence * 100 : confidence)}%` : '-'}</td>
                          <td style={{ ...S.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {truncate(message)}
                          </td>
                          <td style={S.td}>{formatDate(createdAt)}</td>
                          <td style={S.td}>
                            {canSuppress(status) && !isConfirming && (
                              <button
                                style={{ ...S.btn, ...S.btnRed }}
                                onClick={e => { e.stopPropagation(); setSuppressConfirmId(id); setSuppressReason(''); }}
                              >
                                Suppress
                              </button>
                            )}
                            {isConfirming && (
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                <input
                                  style={{ ...S.select, minWidth: 120, fontSize: '0.75rem' }}
                                  type="text"
                                  placeholder="Reason..."
                                  value={suppressReason}
                                  onChange={e => setSuppressReason(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') handleSuppress(id); }}
                                />
                                <button
                                  style={{ ...S.btn, ...S.btnRed, opacity: suppressReason.trim() ? 1 : 0.5 }}
                                  disabled={!suppressReason.trim() || suppressingId === id}
                                  onClick={() => handleSuppress(id)}
                                >
                                  {suppressingId === id ? <span style={S.spinner} /> : 'Confirm'}
                                </button>
                                <button
                                  style={{ ...S.btn, ...S.btnOutline }}
                                  onClick={() => { setSuppressConfirmId(null); setSuppressReason(''); }}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} style={S.expandedRow}>
                              {/* Full message */}
                              <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>Full Message</div>
                              <div style={{ fontSize: '0.85rem', color: '#CBD5E1', marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                {message || 'No message content available.'}
                              </div>

                              {/* Timestamps */}
                              <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                                <span><span style={{ color: '#64748B' }}>Created:</span> {formatDate(createdAt)}</span>
                                {expiresAt && <span><span style={{ color: '#64748B' }}>Expires:</span> {formatDate(expiresAt)}</span>}
                              </div>

                              {/* Suppression reason */}
                              {suppressionReason && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#FCA5A5', marginBottom: '0.25rem' }}>Suppression Reason</div>
                                  <div style={{ fontSize: '0.85rem', color: '#CBD5E1' }}>{suppressionReason}</div>
                                </div>
                              )}

                              {/* Metadata */}
                              {Object.keys(meta).length > 0 && (
                                <div>
                                  <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>Metadata</div>
                                  <pre style={{ fontSize: '0.75rem', color: '#94A3B8', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.75rem', margin: 0 }}>
                                    {JSON.stringify(meta, null, 2)}
                                  </pre>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                style={{ ...S.btn, ...S.btnOutline, opacity: currentPage <= 1 ? 0.4 : 1 }}
                disabled={currentPage <= 1}
                onClick={() => setFilters({ page: currentPage - 1 })}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                style={{ ...S.btn, ...S.btnOutline, opacity: currentPage >= totalPages ? 0.4 : 1 }}
                disabled={currentPage >= totalPages}
                onClick={() => setFilters({ page: currentPage + 1 })}
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
