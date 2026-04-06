import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#be185d', '#059669', '#ea580c', '#6366f1'];

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [queues, setQueues] = useState({ verification: 0, fraud: 0, escalated: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/portfolio/summary'),
      api.get('/applications/stats'),
    ]).then(([pRes, sRes]) => {
      setPortfolio(pRes.data);
      const stats = sRes.data;
      const byStatus = {};
      if (stats.statusCounts) stats.statusCounts.forEach(s => { byStatus[s.status] = s._count; });
      setQueues({
        verification: (byStatus.submitted || 0) + (byStatus.under_review || 0),
        fraud: byStatus.fraud_hold || 0,
        escalated: byStatus.escalated || 0,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (!portfolio) return <div className="loading">Unable to load dashboard data.</div>;

  const fmt = (n) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n;

  return (
    <>
      <div className="page-header"><h1>Dashboard</h1></div>
      <div className="page-body">
        {/* Queue alerts */}
        {(queues.verification > 0 || queues.fraud > 0 || queues.escalated > 0) && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {queues.verification > 0 && (
              <div onClick={() => navigate('/verification-queue')} style={{ cursor: 'pointer', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>📋</span>
                <span><strong>{queues.verification}</strong> awaiting verification</span>
              </div>
            )}
            {queues.fraud > 0 && (
              <div onClick={() => navigate('/fraud-queue')} style={{ cursor: 'pointer', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🚨</span>
                <span><strong>{queues.fraud}</strong> on fraud hold</span>
              </div>
            )}
            {queues.escalated > 0 && (
              <div onClick={() => navigate('/applications?status=escalated')} style={{ cursor: 'pointer', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚡</span>
                <span><strong>{queues.escalated}</strong> escalated</span>
              </div>
            )}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Applications</div>
            <div className="stat-value">{portfolio.totalApplications}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Requested</div>
            <div className="stat-value">{fmt(portfolio.totalRequestedAmount)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Recommended</div>
            <div className="stat-value">{fmt(portfolio.totalRecommendedAmount)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Verification Score</div>
            <div className="stat-value">{Math.round(portfolio.avgVerificationScore)}/100</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">Applications by Status</div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={portfolio.statusBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Crop Distribution</div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={portfolio.cropBreakdown} dataKey="count" nameKey="crop" cx="50%" cy="50%" outerRadius={90} label={({ crop, count }) => `${crop} (${count})`}>
                    {portfolio.cropBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            Recent Applications
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/applications')}>View All</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Farmer</th>
                    <th>Region</th>
                    <th>Crop</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.recentApplications.map(app => (
                    <tr key={app.id} onClick={() => navigate(`/applications/${app.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 500 }}>{app.farmer.fullName}</td>
                      <td>{app.farmer.region}</td>
                      <td>{app.cropType}</td>
                      <td>{app.currencyCode || 'KES'} {app.requestedAmount.toLocaleString()}</td>
                      <td><StatusBadge value={app.status} /></td>
                      <td className="text-muted text-sm">{new Date(app.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
