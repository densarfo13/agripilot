import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/client.js';

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/portfolio').then(r => setReport(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <><div className="page-header"><h1>Reports</h1></div><div className="page-body"><div className="loading">Loading report...</div></div></>;
  if (!report) return <><div className="page-header"><h1>Reports</h1></div><div className="page-body"><div className="alert alert-danger">Failed to load report data. <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => window.location.reload()}>Retry</button></div></div></>;

  const fmt = (n) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n?.toLocaleString() || '0';

  return (
    <>
      <div className="page-header"><h1>Portfolio Report</h1><span className="text-sm text-muted">Generated {new Date(report.generatedAt).toLocaleString()}</span></div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">Avg Verification Score</div><div className="stat-value">{report.avgVerificationScore ? Math.round(report.avgVerificationScore) : 0}/100</div></div>
          <div className="stat-card"><div className="stat-label">Total Verified</div><div className="stat-value">{report.totalVerified}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">Applications by Status</div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>Status</th><th>Count</th><th>Total Amount</th></tr></thead>
                <tbody>
                  {report.statusBreakdown.map(s => (
                    <tr key={s.status}><td style={{ fontWeight: 500 }}>{s.status?.replace(/_/g, ' ')}</td><td>{s._count}</td><td>{fmt(s._sum?.requestedAmount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Applications by Crop</div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={report.cropBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="cropType" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="_count" fill="#16a34a" radius={[4, 4, 0, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">Applications by Region</div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>Region</th><th>Count</th><th>Total Amount</th></tr></thead>
                <tbody>
                  {report.regionBreakdown.map(r => (
                    <tr key={r.region}><td style={{ fontWeight: 500 }}>{r.region}</td><td>{r.count}</td><td>{fmt(r.total_amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {report.monthlyTrend?.length > 0 && (
            <div className="card">
              <div className="card-header">Monthly Trend</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={report.monthlyTrend.map(m => ({ month: new Date(m.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), count: m.count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
