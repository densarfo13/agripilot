import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import EmptyState from '../components/EmptyState.jsx';
import {
  ErrorState, SessionExpiredState, MfaRequiredState, NetworkErrorState,
} from '../components/admin/AdminState.jsx';
import { classifyAdminError, API_ERROR_TYPES } from '../utils/adminErrors.js';

const TABS = ['Analytics', 'Export', 'Bulk Import', 'Activity'];

const S = {
  tabBar: { display: 'flex', gap: '0', borderBottom: '2px solid #E4E4E7', marginBottom: '1.5rem' },
  tab: { padding: '0.625rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#71717A', borderBottom: '2px solid transparent', marginBottom: '-2px', transition: 'color 0.15s, border-color 0.15s' },
  tabActive: { color: '#16A34A', borderBottomColor: '#16A34A' },
  exportRow: { display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' },
  exportCard: { display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' },
  textarea: { width: '100%', minHeight: '180px', fontFamily: 'monospace', fontSize: '0.8125rem', padding: '0.75rem', border: '1px solid #D4D4D8', borderRadius: '6px', resize: 'vertical', boxSizing: 'border-box' },
  resultBox: { marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.875rem' },
  resultSuccess: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' },
  resultError: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' },
  pctCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  pctValue: { fontSize: '1.75rem', fontWeight: 700, color: '#16A34A' },
  pctLabel: { fontSize: '0.75rem', color: '#71717A', marginTop: '0.25rem' },
};

/* ------------------------------------------------------------------ */
/*  Tab 1: Analytics                                                   */
/* ------------------------------------------------------------------ */
function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // classified
  const [regionFilter, setRegionFilter] = useState('');
  const [cropFilter, setCropFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (regionFilter) params.set('region', regionFilter);
    if (cropFilter) params.set('primaryCrop', cropFilter);
    const qs = params.toString();
    api.get(`/v2/analytics-summary${qs ? '?' + qs : ''}`)
      .then(r => setData(r.data))
      .catch((err) => setError(classifyAdminError(err)))
      .finally(() => setLoading(false));
  }, [regionFilter, cropFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading">Loading analytics...</div>;
  if (error) {
    if (error.errorType === API_ERROR_TYPES.SESSION_EXPIRED) {
      return <SessionExpiredState testId="admin-ops-analytics-error" />;
    }
    if (error.errorType === API_ERROR_TYPES.MFA_REQUIRED) {
      return <MfaRequiredState testId="admin-ops-analytics-error" />;
    }
    if (error.errorType === API_ERROR_TYPES.NETWORK_ERROR) {
      return <NetworkErrorState onRetry={load}
                                testId="admin-ops-analytics-error" />;
    }
    return (
      <ErrorState
        message="We could not load the analytics summary. Your data is safe — try again in a moment."
        onRetry={load}
        testId="admin-ops-analytics-error"
      />
    );
  }
  if (!data) return null;

  const pct = (num, den) => den ? ((num / den) * 100).toFixed(1) + '%' : '0%';
  const tw = data.timeWindow || {};
  const pc = data.pesticideCompliance || {};
  const comp = data.profileCompleteness || {};
  const periods = data.periodUpdates || {};
  const avail = data.filters?.available || {};

  return (
    <>
      {/* ─── Filters ─── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={AS.select}>
          <option value="">All regions</option>
          {(avail.regions || []).map(r => <option key={r.value} value={r.value}>{r.value} ({r.count})</option>)}
        </select>
        <select value={cropFilter} onChange={e => setCropFilter(e.target.value)} style={AS.select}>
          <option value="">All crops</option>
          {(avail.crops || []).map(c => <option key={c.value} value={c.value}>{c.value} ({c.count})</option>)}
        </select>
        {(regionFilter || cropFilter) && (
          <button style={AS.clearBtn} onClick={() => { setRegionFilter(''); setCropFilter(''); }}>Clear filters</button>
        )}
        <span style={{ fontSize: '0.75rem', color: '#71717A', marginLeft: 'auto' }}>
          Activity window: {tw.label || 'last 30 days'}
        </span>
      </div>

      {/* ─── Farmer counts ─── */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total Farmers</div><div className="stat-value">{data.totalFarmers ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Active <span style={AS.period}>({tw.label})</span></div><div className="stat-value" style={{ color: '#16A34A' }}>{data.activeFarmers ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Inactive <span style={AS.period}>({tw.label})</span></div><div className="stat-value" style={{ color: '#F59E0B' }}>{data.inactiveFarmers ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Setup Incomplete</div><div className="stat-value">{data.setupIncomplete ?? 0}</div></div>
      </div>

      {/* ─── Update activity by period ─── */}
      <div style={{ marginTop: '1rem', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Updates by Period</div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Last 7 days</div><div className="stat-value">{periods.last7Days ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Last 30 days</div><div className="stat-value">{periods.last30Days ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Last 90 days</div><div className="stat-value">{periods.last90Days ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">All time</div><div className="stat-value">{data.totalUpdates ?? 0}</div></div>
      </div>

      {/* ─── Validation + attention ─── */}
      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <div className="stat-card"><div className="stat-label">Validated Updates</div><div className="stat-value">{data.validatedUpdates ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Pending Validation</div><div className="stat-value">{data.pendingValidations ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Needs Attention</div><div className="stat-value" style={{ color: (data.needsAttention ?? 0) > 0 ? '#DC2626' : undefined }}>{data.needsAttention ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Duplicate Flags</div><div className="stat-value" style={{ color: (data.duplicateFlagged ?? 0) > 0 ? '#F59E0B' : undefined }}>{data.duplicateFlagged ?? 0}</div></div>
      </div>

      {/* ─── Rates ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        <div className="stat-card" style={S.pctCard}>
          <div style={S.pctValue}>{data.onboardingRate || '0%'}</div>
          <div style={S.pctLabel}>Onboarding Rate</div>
        </div>
        <div className="stat-card" style={S.pctCard}>
          <div style={S.pctValue}>{data.firstUpdateRate || '0%'}</div>
          <div style={S.pctLabel}>First Update Rate</div>
        </div>
      </div>

      {/* ─── Profile completeness ─── */}
      <div style={{ marginTop: '1.5rem', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Profile Completeness</div>
      <div className="stats-grid">
        <div className="stat-card" style={S.pctCard}>
          <div style={S.pctValue}>{comp.completePct ?? 0}%</div>
          <div style={S.pctLabel}>Complete profiles</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Complete</div><div className="stat-value" style={{ color: '#16A34A' }}>{comp.complete ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Incomplete</div><div className="stat-value" style={{ color: '#F59E0B' }}>{comp.incomplete ?? 0}</div>
        </div>
      </div>
      {comp.commonMissing && comp.commonMissing.length > 0 && (
        <div style={{ fontSize: '0.8125rem', color: '#71717A', marginTop: '0.5rem' }}>
          Common missing: {comp.commonMissing.map(m => `${m.field} (${m.count})`).join(', ')}
        </div>
      )}

      {/* ─── Pesticide compliance ─── */}
      <div style={{ marginTop: '1.5rem', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Pesticide Compliance</div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Compliant</div><div className="stat-value" style={{ color: '#16A34A' }}>{pc.compliant ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Needs Review</div><div className="stat-value" style={{ color: '#F59E0B' }}>{pc.needsReview ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Non-compliant</div><div className="stat-value" style={{ color: '#DC2626' }}>{pc.nonCompliant ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Evaluated</div><div className="stat-value">{pc.totalEvaluated ?? 0}</div></div>
      </div>

      {/* ─── Intelligence ─── */}
      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <div className="stat-card"><div className="stat-label">Land Mapped</div><div className="stat-value">{data.landBoundaryCount ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Seed Scans</div><div className="stat-value">{data.seedScanCount ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Seed Warnings</div><div className="stat-value" style={{ color: (data.seedWarningCount ?? 0) > 0 ? '#DC2626' : undefined }}>{data.seedWarningCount ?? 0}</div></div>
      </div>
    </>
  );
}

const AS = {
  select: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #D4D4D8', fontSize: '0.8125rem', background: '#fff' },
  clearBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #D4D4D8', background: '#fff', cursor: 'pointer', fontSize: '0.8125rem', color: '#71717A' },
  period: { fontSize: '0.6875rem', fontWeight: 400, color: '#A1A1AA' },
};

/* ------------------------------------------------------------------ */
/*  Tab 2: Export                                                      */
/* ------------------------------------------------------------------ */
function ExportTab() {
  const [status, setStatus] = useState({});

  const download = async (label, endpoint, filename) => {
    setStatus(s => ({ ...s, [label]: 'downloading' }));
    try {
      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(s => ({ ...s, [label]: 'done' }));
    } catch {
      setStatus(s => ({ ...s, [label]: 'error' }));
    }
  };

  const btnLabel = (label) => {
    if (status[label] === 'downloading') return 'Downloading...';
    if (status[label] === 'done') return 'Downloaded';
    if (status[label] === 'error') return 'Failed - Retry';
    return label;
  };

  return (
    <div className="card">
      <div className="card-header">Export Data as CSV</div>
      <div className="card-body">
        <div style={S.exportRow}>
          <div style={S.exportCard}>
            <button className="btn btn-primary" disabled={status['Export Farmers'] === 'downloading'} onClick={() => download('Export Farmers', '/v2/exports/farmers/csv', 'farmers.csv')}>
              {btnLabel('Export Farmers')}
            </button>
            {status['Export Farmers'] === 'done' && <span className="text-sm" style={{ color: '#16A34A' }}>Saved farmers.csv</span>}
            {status['Export Farmers'] === 'error' && <span className="text-sm" style={{ color: '#DC2626' }}>Download failed</span>}
          </div>
          <div style={S.exportCard}>
            <button className="btn btn-primary" disabled={status['Export Updates'] === 'downloading'} onClick={() => download('Export Updates', '/v2/exports/updates/csv', 'updates.csv')}>
              {btnLabel('Export Updates')}
            </button>
            {status['Export Updates'] === 'done' && <span className="text-sm" style={{ color: '#16A34A' }}>Saved updates.csv</span>}
            {status['Export Updates'] === 'error' && <span className="text-sm" style={{ color: '#DC2626' }}>Download failed</span>}
          </div>
          <div style={S.exportCard}>
            <button className="btn btn-primary" disabled={status['Export Validations'] === 'downloading'} onClick={() => download('Export Validations', '/v2/exports/validations/csv', 'validations.csv')}>
              {btnLabel('Export Validations')}
            </button>
            {status['Export Validations'] === 'done' && <span className="text-sm" style={{ color: '#16A34A' }}>Saved validations.csv</span>}
            {status['Export Validations'] === 'error' && <span className="text-sm" style={{ color: '#DC2626' }}>Download failed</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 3: Bulk Import                                                 */
/* ------------------------------------------------------------------ */
function BulkImportTab() {
  const [csv, setCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    if (!csv.trim()) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await api.post('/v2/bulk/import/farmers', { csv });
      setResult({ success: true, created: res.data.created ?? 0, skipped: res.data.skipped ?? 0, errors: res.data.errors ?? [] });
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">Bulk Import Farmers via CSV</div>
      <div className="card-body">
        <textarea
          style={S.textarea}
          placeholder={'name,phone,country\nJohn Doe,+254712345678,KE'}
          value={csv}
          onChange={e => { setCsv(e.target.value); setResult(null); }}
        />
        <div style={{ marginTop: '0.75rem' }}>
          <button className="btn btn-primary" disabled={importing || !csv.trim()} onClick={handleImport}>
            {importing ? 'Importing...' : 'Import Farmers'}
          </button>
        </div>

        {result && result.success && (
          <div style={{ ...S.resultBox, ...S.resultSuccess }}>
            <strong>{result.created}</strong> farmer{result.created !== 1 ? 's' : ''} created, <strong>{result.skipped}</strong> skipped.
            {result.errors.length > 0 && (
              <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        {result && !result.success && (
          <div style={{ ...S.resultBox, ...S.resultError }}>
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 4: Activity                                                    */
/* ------------------------------------------------------------------ */
function ActivityTab() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // classified
  const limit = 25;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/audit', { params: { page, limit } })
      .then(r => { setLogs(r.data.logs ?? r.data.items ?? []); setTotal(r.data.total ?? 0); })
      .catch((err) => setError(classifyAdminError(err)))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading">Loading activity...</div>;
  if (error) {
    if (error.errorType === API_ERROR_TYPES.SESSION_EXPIRED) {
      return <SessionExpiredState testId="admin-ops-activity-error" />;
    }
    if (error.errorType === API_ERROR_TYPES.MFA_REQUIRED) {
      return <MfaRequiredState testId="admin-ops-activity-error" />;
    }
    if (error.errorType === API_ERROR_TYPES.NETWORK_ERROR) {
      return <NetworkErrorState onRetry={load}
                                testId="admin-ops-activity-error" />;
    }
    return (
      <ErrorState
        message="We could not load the activity log. Try again in a moment."
        onRetry={load}
        testId="admin-ops-activity-error"
      />
    );
  }

  if (logs.length === 0 && page === 1) {
    return <EmptyState message="No activity recorded yet" />;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Details</th></tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="text-sm">{new Date(log.createdAt).toLocaleString()}</td>
                    <td style={{ fontWeight: 500 }}>{log.user?.fullName ?? log.userName ?? '-'}</td>
                    <td>{(log.action || '').replace(/_/g, ' ')}</td>
                    <td className="text-sm text-muted">{log.details ?? log.description ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination" style={{ marginTop: '1rem' }}>
          <span className="text-sm text-muted">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function AdminOpsPage() {
  const [tab, setTab] = useState('Analytics');

  return (
    <>
      <div className="page-header"><h1>Admin Operations</h1></div>
      <div className="page-body">
        <div style={S.tabBar}>
          {TABS.map(t => (
            <button
              key={t}
              style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Analytics' && <AnalyticsTab />}
        {tab === 'Export' && <ExportTab />}
        {tab === 'Bulk Import' && <BulkImportTab />}
        {tab === 'Activity' && <ActivityTab />}
      </div>
    </>
  );
}
