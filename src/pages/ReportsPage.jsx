import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../api/client.js';
import ChartErrorBoundary from '../components/ChartErrorBoundary.jsx';

/**
 * ReportsPage — NGO / admin portfolio report.
 *
 * Polish pass:
 *   • Replaced raw enum display (`s.status?.replace(/_/g, ' ')`) with a
 *     stable STATUS_LABEL map — no more "pending approval" lowercased.
 *   • Every card + table now has an explicit empty state instead of
 *     rendering an undefined / null children tree.
 *   • Error state surfaces a calm, useful message and a verb-noun
 *     "Reload report" button (was plain "Retry").
 *   • Card subtitles clarify the units that were implied by the
 *     layout (e.g. "Average score out of 100").
 */

const STATUS_LABEL = {
  DRAFT:             'Draft',
  SUBMITTED:         'Submitted',
  PENDING_APPROVAL:  'Pending approval',
  UNDER_REVIEW:      'Under review',
  APPROVED:          'Approved',
  REJECTED:          'Rejected',
  DISBURSED:         'Disbursed',
  CLOSED:            'Closed',
};

// Fallback that never shows the raw enum back to the user.
const formatStatus = (code) => {
  if (!code) return '—';
  if (STATUS_LABEL[code]) return STATUS_LABEL[code];
  // Title-case the code rather than leaving "pending_approval" bare.
  return String(code).toLowerCase().split('_').map(
    (w) => w.charAt(0).toUpperCase() + w.slice(1),
  ).join(' ');
};

const fmtCount = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return n.toLocaleString();
};

const fmtAmount = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return fmtCount(Number(n));
};

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const loadReport = () => {
    setLoading(true);
    setErrored(false);
    api.get('/reports/portfolio')
      .then((r) => { setReport(r.data); })
      .catch(() => { setErrored(true); setReport(null); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(); }, []);

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Reports</h1></div>
        <div className="page-body">
          <div className="loading">Loading the latest portfolio figures…</div>
        </div>
      </>
    );
  }

  if (errored || !report) {
    return (
      <>
        <div className="page-header"><h1>Reports</h1></div>
        <div className="page-body">
          <div className="alert alert-danger" role="alert">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              We could not load the report right now.
            </div>
            <div style={{ fontSize: '0.875rem', opacity: 0.85 }}>
              This is usually temporary. Try again in a moment.
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ marginTop: '0.75rem' }}
              onClick={loadReport}
            >
              Reload report
            </button>
          </div>
        </div>
      </>
    );
  }

  const statusBreakdown  = Array.isArray(report.statusBreakdown)  ? report.statusBreakdown  : [];
  const cropBreakdown    = Array.isArray(report.cropBreakdown)    ? report.cropBreakdown    : [];
  const regionBreakdown  = Array.isArray(report.regionBreakdown)  ? report.regionBreakdown  : [];
  const monthlyTrend     = Array.isArray(report.monthlyTrend)     ? report.monthlyTrend     : [];

  return (
    <>
      <div className="page-header">
        <h1>Portfolio report</h1>
        <span className="text-sm text-muted">
          Generated {new Date(report.generatedAt).toLocaleString()}
        </span>
      </div>

      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Average verification score</div>
            <div className="stat-value">
              {report.avgVerificationScore ? Math.round(report.avgVerificationScore) : 0}
              <span style={{ fontSize: '0.7em', color: '#9FB3C8', fontWeight: 500 }}> / 100</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total verified</div>
            <div className="stat-value">{fmtCount(report.totalVerified || 0)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">Applications by status</div>
            <div className="card-body" style={{ padding: 0 }}>
              {statusBreakdown.length === 0 ? (
                <EmptyHint text="No applications to group by status yet." />
              ) : (
                <table>
                  <thead>
                    <tr><th>Status</th><th>Count</th><th>Total amount</th></tr>
                  </thead>
                  <tbody>
                    {statusBreakdown.map((s) => (
                      <tr key={s.status || 'unknown'}>
                        <td style={{ fontWeight: 500 }}>{formatStatus(s.status)}</td>
                        <td>{fmtCount(s._count)}</td>
                        <td>{fmtAmount(s._sum?.requestedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">Applications by crop</div>
            <div className="card-body">
              {cropBreakdown.length === 0 ? (
                <EmptyHint text="No crop breakdown available yet." />
              ) : (
                <ChartErrorBoundary>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={cropBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                      <XAxis dataKey="cropType" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="_count" fill="#22C55E" radius={[4, 4, 0, 0]} name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartErrorBoundary>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">Applications by region</div>
            <div className="card-body" style={{ padding: 0 }}>
              {regionBreakdown.length === 0 ? (
                <EmptyHint text="No regional data for this period." />
              ) : (
                <table>
                  <thead>
                    <tr><th>Region</th><th>Count</th><th>Total amount</th></tr>
                  </thead>
                  <tbody>
                    {regionBreakdown.map((r) => (
                      <tr key={r.region || 'unknown'}>
                        <td style={{ fontWeight: 500 }}>{r.region || '—'}</td>
                        <td>{fmtCount(r.count)}</td>
                        <td>{fmtAmount(r.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">Monthly trend</div>
            <div className="card-body">
              {monthlyTrend.length === 0 ? (
                <EmptyHint text="Not enough history yet for a monthly trend." />
              ) : (
                <ChartErrorBoundary>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyTrend.map((m) => ({
                      month: new Date(m.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                      count: m.count,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#22C55E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartErrorBoundary>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyHint({ text }) {
  return (
    <div style={{
      padding: '1.25rem', textAlign: 'center',
      color: '#9FB3C8', fontSize: '0.875rem', lineHeight: 1.5,
    }}>
      {text}
    </div>
  );
}
