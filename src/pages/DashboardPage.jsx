import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';
import { ADMIN_ROLES } from '../utils/roles.js';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#be185d', '#059669', '#ea580c', '#6366f1'];

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [queues, setQueues] = useState({ verification: 0, fraud: 0, escalated: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [adoption, setAdoption] = useState(null);
  const [attentionCount, setAttentionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { selectedOrgId, selectedOrgName } = useOrgStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const canSeePilotMetrics = isAdmin || user?.role === 'investor_viewer';
  const canSeeAttention = isAdmin || user?.role === 'field_officer';

  useEffect(() => {
    Promise.all([
      api.get('/portfolio/summary'),
      api.get('/applications/stats'),
      isAdmin ? api.get('/users/pending-registrations').catch(() => ({ data: [] })) : Promise.resolve(null),
      canSeePilotMetrics ? api.get('/pilot/metrics').catch(() => ({ data: null })) : Promise.resolve(null),
      canSeeAttention ? api.get('/pilot/needs-attention').catch(() => ({ data: null })) : Promise.resolve(null),
    ]).then(([pRes, sRes, pendingRes, mRes, aRes]) => {
      if (pendingRes) setPendingCount(pendingRes.data.length || 0);
      setPortfolio(pRes.data);
      const stats = sRes.data;
      const byStatus = {};
      if (stats.statusCounts) stats.statusCounts.forEach(s => { byStatus[s.status] = s._count; });
      setQueues({
        verification: (byStatus.submitted || 0) + (byStatus.under_review || 0),
        fraud: byStatus.fraud_hold || 0,
        escalated: byStatus.escalated || 0,
      });
      if (mRes?.data) setAdoption(mRes.data);
      if (aRes?.data) setAttentionCount(aRes.data.totalItems || 0);
    }).catch(() => {
      // portfolio stays null — handled by "Unable to load" message below
    }).finally(() => setLoading(false));
  }, [selectedOrgId]);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (!portfolio) return (
    <div className="page-body">
      <div className="alert alert-danger">
        Unable to load dashboard data.
        <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  const fmt = (n) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          {user?.role === 'super_admin' && selectedOrgName && (
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>{selectedOrgName}</div>
          )}
          {user?.role !== 'super_admin' && user?.organization?.name && (
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>{user.organization.name}</div>
          )}
        </div>
      </div>
      <div className="page-body">
        {/* Queue alerts */}
        {(queues.verification > 0 || queues.fraud > 0 || queues.escalated > 0 || pendingCount > 0) && (
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
            {pendingCount > 0 && (
              <div onClick={() => navigate('/farmer-registrations')} style={{ cursor: 'pointer', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>👤</span>
                <span><strong>{pendingCount}</strong> pending farmer registrations</span>
              </div>
            )}
            {attentionCount > 0 && (
              <div onClick={() => navigate('/pilot-metrics')} style={{ cursor: 'pointer', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <span><strong>{attentionCount}</strong> pilot items need attention</span>
              </div>
            )}
          </div>
        )}

        {adoption && canSeePilotMetrics && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', flexShrink: 0 }}>
              Pilot Adoption
            </span>
            {[
              ['Approved', adoption.farmers?.approved],
              ['Logged In', adoption.adoption?.loggedIn],
              ['1st Update', adoption.adoption?.withFirstUpdate],
              ['Harvest', adoption.adoption?.withHarvest],
            ].map(([label, val]) => (
              <div key={label} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '0.4rem 0.9rem', textAlign: 'center', minWidth: 72 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0369a1' }}>{val ?? '—'}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{label}</div>
              </div>
            ))}
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/pilot-metrics')} style={{ marginLeft: 'auto' }}>
              Full Pilot Metrics →
            </button>
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
                  {portfolio.recentApplications.length > 0 ? portfolio.recentApplications.map(app => (
                    <tr key={app.id} onClick={() => navigate(`/applications/${app.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 500 }}>{app.farmer.fullName}</td>
                      <td>{app.farmer.region}</td>
                      <td>{app.cropType}</td>
                      <td>{app.currencyCode || 'KES'} {app.requestedAmount.toLocaleString()}</td>
                      <td><StatusBadge value={app.status} /></td>
                      <td className="text-muted text-sm">{new Date(app.createdAt).toLocaleDateString()}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="empty-state">No applications yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
