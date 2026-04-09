import React, { useEffect, useState, useCallback } from 'react';
import api, { formatApiError } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

const TYPE_LABELS = {
  invite_reminder:    'Invite Reminder',
  no_first_update:    'No First Update',
  stale_farmer:       'Stale Activity',
  validation_pending: 'Validation Pending',
  reviewer_backlog:   'Reviewer Backlog',
  high_risk_alert:    'High Risk Alert',
};

const CHANNEL_LABELS = {
  sms:    'SMS',
  email:  'Email',
  in_app: 'In-App',
};

const STATUS_STYLE = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  sent:    { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  failed:  { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  skipped: { bg: '#1E293B', color: '#71717A' },
};

const CHANNEL_STYLE = {
  sms:    { bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
  email:  { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  in_app: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
};

function Badge({ label, style }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: '0.75rem',
      fontWeight: 600,
      background: style.bg,
      color: style.color,
    }}>
      {label}
    </span>
  );
}

function StatsBar({ stats }) {
  if (!stats) return null;
  const cards = [
    { label: 'Sent today',    value: stats.todaySent,   color: '#22C55E' },
    { label: 'Total sent',    value: stats.totalSent,   color: '#22C55E' },
    { label: 'Total failed',  value: stats.totalFailed, color: '#EF4444' },
  ];
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
      {cards.map(c => (
        <div key={c.label} style={{
          flex: '1 1 130px', background: '#162033', border: '1px solid #243041',
          borderRadius: 8, padding: '0.75rem 1rem',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.color }}>{c.value ?? '—'}</div>
          <div style={{ fontSize: '0.78rem', color: '#A1A1AA', marginTop: 2 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function AutoNotificationsPage() {
  const user = useAuthStore(s => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [records, setRecords]           = useState([]);
  const [stats, setStats]               = useState(null);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError]               = useState('');
  const [running, setRunning]           = useState(false);
  const [runResult, setRunResult]       = useState(null);
  const [retrying, setRetrying]         = useState(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [page, setPage]                 = useState(1);
  const limit = 50;

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    api.get('/auto-notifications/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = { page, limit };
    if (statusFilter) params.status = statusFilter;
    if (typeFilter)   params.type   = typeFilter;
    api.get('/auto-notifications', { params })
      .then(r => {
        setRecords(r.data.records ?? []);
        setTotal(r.data.total ?? 0);
      })
      .catch(err => setError(formatApiError(err, 'Failed to load notifications')))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter, page]);

  useEffect(() => { load(); loadStats(); }, [load, loadStats]);

  const handleRun = async () => {
    setRunning(true);
    setRunResult(null);
    setError('');
    try {
      const r = await api.post('/auto-notifications/run');
      setRunResult(r.data);
      load();
      loadStats();
    } catch (err) {
      setError(formatApiError(err, 'Failed to run notification cycle'));
    } finally {
      setRunning(false);
    }
  };

  const handleRetry = async (id) => {
    setRetrying(id);
    try {
      await api.post(`/auto-notifications/${id}/retry`);
      load();
      loadStats();
    } catch (err) {
      setError(formatApiError(err, 'Retry failed'));
    } finally {
      setRetrying(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Automated Notifications</h1>
          <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.15rem' }}>
            Triggered messages driven by invite status, task signals, and risk alerts</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => { load(); loadStats(); }}>Refresh</button>
          {isSuperAdmin && (
            <button className="btn btn-primary" onClick={handleRun} disabled={running}>
              {running ? 'Running…' : 'Run Cycle Now'}
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button className="btn btn-sm btn-outline" style={{ marginLeft: '0.75rem', flexShrink: 0 }} onClick={load}>Retry</button>
          </div>
        )}

        {runResult && (
          <div className="alert-inline alert-inline-success" style={{ fontSize: '0.85rem' }}>
            Cycle complete — <strong>{runResult.enqueued}</strong> enqueued,{' '}
            <strong>{runResult.sent}</strong> sent,{' '}
            <strong>{runResult.skipped}</strong> rate-limited,{' '}
            <strong>{runResult.failed}</strong> failed.
            <button className="alert-dismiss" onClick={() => setRunResult(null)}>✕</button>
          </div>
        )}

        {/* Stats bar */}
        {!statsLoading && <StatsBar stats={stats} />}

        {/* Info banner */}
        <div className="alert-inline alert-inline-success" style={{ fontSize: '0.85rem' }}>
          <strong>How it works:</strong> The system runs daily at 08:00 UTC, evaluating 6 trigger rules.
          Messages are delivered via SMS → Email → In-App fallback. Each farmer is capped at 3 notifications per day.
          {isSuperAdmin && ' Use "Run Cycle Now" to trigger immediately.'}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 140 }}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>

          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 180 }}
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          {(statusFilter || typeFilter) && (
            <button className="btn btn-sm btn-outline" onClick={() => { setStatusFilter(''); setTypeFilter(''); setPage(1); }}>
              Clear filters
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: '#A1A1AA' }}>
            {total} record{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading">Loading notifications…</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#A1A1AA' }}>
            No notifications found.
            {(statusFilter || typeFilter) && (
              <span> Try clearing the filters.</span>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th>Attempts</th>
                  <th>Created</th>
                  <th>Sent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>
                      <Badge
                        label={TYPE_LABELS[r.type] ?? r.type}
                        style={{ bg: '#1E293B', color: '#FFFFFF' }}
                      />
                    </td>
                    <td>
                      <Badge
                        label={CHANNEL_LABELS[r.channel] ?? r.channel}
                        style={CHANNEL_STYLE[r.channel] ?? { bg: '#1E293B', color: '#FFFFFF' }}
                      />
                    </td>
                    <td>
                      <Badge
                        label={r.status}
                        style={STATUS_STYLE[r.status] ?? { bg: '#1E293B', color: '#FFFFFF' }}
                      />
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{ fontSize: '0.82rem', color: '#FFFFFF', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {r.message}
                      </div>
                      {r.failureReason && (
                        <div style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: 4 }}>
                          ✕ {r.failureReason}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{r.attempts}</td>
                    <td style={{ fontSize: '0.8rem', color: '#A1A1AA', whiteSpace: 'nowrap' }}>
                      {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#A1A1AA', whiteSpace: 'nowrap' }}>
                      {r.sentAt
                        ? new Date(r.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '—'}
                    </td>
                    <td>
                      {r.status === 'failed' && (
                        <button
                          className="btn btn-sm btn-outline"
                          disabled={retrying === r.id}
                          onClick={() => handleRetry(r.id)}
                          title="Retry delivery"
                        >
                          {retrying === r.id ? '…' : 'Retry'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button
              className="btn btn-sm btn-outline"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <span style={{ lineHeight: '2rem', fontSize: '0.85rem', color: '#A1A1AA' }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-sm btn-outline"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
