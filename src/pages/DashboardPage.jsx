import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { PriorityBadge } from '../components/TrustRiskBadge.jsx';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';
import { ADMIN_ROLES } from '../utils/roles.js';

const COLORS = ['#22C55E', '#22C55E', '#F59E0B', '#EF4444', '#0891b2', '#7c3aed', '#be185d', '#059669', '#ea580c', '#6366f1'];

const TASK_NAV = {
  APPROVE_ONBOARDING: (t) => `/farmer-registrations`,
  RESOLVE_INVITE:     (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  ASSIGN_OFFICER:     (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  REVIEW_HIGH_RISK:   (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  REVIEW_BACKLOG:     (t) => t.applicationId ? `/applications/${t.applicationId}` : `/applications`,
  VALIDATE_UPDATE:    (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  FOLLOW_UP_STALE:    (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  CONFIRM_HARVEST:    (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  REVIEW_APPLICATION: (t) => t.applicationId ? `/applications/${t.applicationId}` : `/applications`,
  RESOLVE_BLOCKER:    (t) => t.applicationId ? `/applications/${t.applicationId}` : `/applications`,
  REVIEW_OVERDUE:     (t) => t.applicationId ? `/applications/${t.applicationId}` : `/applications`,
};

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [queues, setQueues] = useState({ verification: 0, fraud: 0, escalated: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [adoption, setAdoption] = useState(null);
  const [attentionCount, setAttentionCount] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [benchmarkSummary, setBenchmarkSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { selectedOrgId, selectedOrgName } = useOrgStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const canSeePilotMetrics = isAdmin || user?.role === 'investor_viewer';
  const canSeeAttention = isAdmin || user?.role === 'field_officer';
  const canSeeTasks = user?.role !== 'investor_viewer';

  useEffect(() => {
    Promise.all([
      api.get('/portfolio/summary'),
      api.get('/applications/stats'),
      isAdmin ? api.get('/users/pending-registrations').catch(() => ({ data: [] })) : Promise.resolve(null),
      canSeePilotMetrics ? api.get('/pilot/metrics').catch(() => ({ data: null })) : Promise.resolve(null),
      canSeeAttention ? api.get('/pilot/needs-attention').catch(() => ({ data: null })) : Promise.resolve(null),
      canSeeTasks ? api.get('/tasks').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      canSeePilotMetrics ? api.get('/pilot/alerts').catch(() => ({ data: null })) : Promise.resolve(null),
      canSeePilotMetrics ? api.get('/performance/dashboard').catch(() => ({ data: null })) : Promise.resolve(null),
    ]).then(([pRes, sRes, pendingRes, mRes, aRes, tRes, alertsRes, benchRes]) => {
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
      if (tRes?.data) setTasks(Array.isArray(tRes.data) ? tRes.data : []);
      if (alertsRes?.data?.alerts) setAlerts(alertsRes.data.alerts);
      if (benchRes?.data) setBenchmarkSummary(benchRes.data);
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
            <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.15rem' }}>{selectedOrgName}</div>
          )}
          {user?.role !== 'super_admin' && user?.organization?.name && (
            <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.15rem' }}>{user.organization.name}</div>
          )}
        </div>
      </div>
      <div className="page-body">
        {/* Queue alerts */}
        {(queues.verification > 0 || queues.fraud > 0 || queues.escalated > 0 || pendingCount > 0) && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {queues.verification > 0 && (
              <div onClick={() => navigate('/verification-queue')} style={{ cursor: 'pointer', background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>📋</span>
                <span><strong>{queues.verification}</strong> awaiting verification</span>
              </div>
            )}
            {queues.fraud > 0 && (
              <div onClick={() => navigate('/fraud-queue')} style={{ cursor: 'pointer', background: 'rgba(239,68,68,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🚨</span>
                <span><strong>{queues.fraud}</strong> on fraud hold</span>
              </div>
            )}
            {queues.escalated > 0 && (
              <div onClick={() => navigate('/applications?status=escalated')} style={{ cursor: 'pointer', background: 'rgba(245,158,11,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚡</span>
                <span><strong>{queues.escalated}</strong> escalated</span>
              </div>
            )}
            {pendingCount > 0 && (
              <div onClick={() => navigate('/farmer-registrations')} style={{ cursor: 'pointer', background: 'rgba(245,158,11,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>👤</span>
                <span><strong>{pendingCount}</strong> pending farmer registrations</span>
              </div>
            )}
            {attentionCount > 0 && (
              <div onClick={() => navigate('/pilot-metrics')} style={{ cursor: 'pointer', background: 'rgba(239,68,68,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <span><strong>{attentionCount}</strong> pilot items need attention</span>
              </div>
            )}
          </div>
        )}

        {adoption && canSeePilotMetrics && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#A1A1AA', flexShrink: 0 }}>
              Pilot Adoption
            </span>
            {[
              ['Approved', adoption.farmers?.approved, '#1E293B', '#243041', '#22C55E'],
              ['Invite Pending', adoption.farmers?.invitedNotActivated, '#1E293B', '#243041', '#F59E0B'],
              ['Logged In', adoption.adoption?.loggedIn, '#1E293B', '#243041', '#22C55E'],
              ['1st Update', adoption.adoption?.withFirstUpdate, '#1E293B', '#243041', '#22C55E'],
              ['Harvest', adoption.adoption?.withHarvest, '#1E293B', '#243041', '#22C55E'],
            ].map(([label, val, bg, border, color]) => (
              <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '0.4rem 0.9rem', textAlign: 'center', minWidth: 72 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{val ?? '—'}</div>
                <div style={{ fontSize: '0.7rem', color: '#A1A1AA' }}>{label}</div>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <a
                href="/api/pilot/report?format=csv"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
                style={{ textDecoration: 'none' }}
              >
                Export CSV
              </a>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/pilot-metrics')}>
                Full Metrics →
              </button>
            </div>
          </div>
        )}

        {/* Alerts panel — shown to admins when there are active alerts */}
        {canSeePilotMetrics && alerts.length > 0 && (
          <div className="card" style={{ marginBottom: '1.25rem', border: '1px solid #243041' }}>
            <div className="card-header" style={{ background: 'rgba(245,158,11,0.15)', borderBottom: '1px solid #243041', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#F59E0B' }}>Active Alerts ({alerts.length})</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/pilot-metrics')}>View Details</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {alerts.slice(0, 5).map((alert, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  padding: '0.7rem 1rem',
                  borderBottom: i < Math.min(alerts.length, 5) - 1 ? '1px solid #243041' : 'none',
                  background: alert.severity === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                }}>
                  <span style={{ fontSize: '0.85rem', marginTop: '0.1rem' }}>
                    {alert.severity === 'high' ? '🔴' : '🟡'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#FFFFFF', marginBottom: '0.15rem' }}>
                      {alert.type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#A1A1AA' }}>{alert.message}</div>
                  </div>
                </div>
              ))}
              {alerts.length > 5 && (
                <div style={{ padding: '0.5rem 1rem', fontSize: '0.78rem', color: '#A1A1AA', textAlign: 'center' }}>
                  +{alerts.length - 5} more alerts — view in Pilot Metrics
                </div>
              )}
            </div>
          </div>
        )}

        {/* Benchmark summary card — admin/pilot metrics roles */}
        {canSeePilotMetrics && benchmarkSummary && (
          <BenchmarkSummaryCard data={benchmarkSummary} onNavigate={() => navigate('/admin/notifications')} />
        )}

        {/* Daily Tasks — role-scoped, derived from workflow state */}
        {canSeeTasks && tasks.length > 0 && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Your Tasks Today</span>
              <span style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>{tasks.length} open</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {tasks.slice(0, 8).map((t, i) => {
                const navFn = TASK_NAV[t.taskType];
                const href = navFn ? navFn(t) : null;
                return (
                  <div
                    key={i}
                    onClick={href ? () => navigate(href) : undefined}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                      padding: '0.75rem 1rem', borderBottom: '1px solid #243041',
                      cursor: href ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{ fontSize: '1rem', marginTop: '0.05rem' }}>
                      {t.priority === 'High' ? '🔴' : t.priority === 'Medium' ? '🟡' : '⚪'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.15rem' }}>{t.title}</div>
                      <div style={{ fontSize: '0.78rem', color: '#A1A1AA', lineHeight: 1.4 }}>{t.reason}</div>
                    </div>
                    <PriorityBadge priority={t.priority} />
                  </div>
                );
              })}
              {tasks.length > 8 && (
                <div style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: '#A1A1AA', textAlign: 'center' }}>
                  +{tasks.length - 8} more tasks
                </div>
              )}
            </div>
          </div>
        )}

        {/* First-run empty state — shown to admins when no farmers exist yet */}
        {isAdmin && adoption && (adoption.farmers?.total === 0) && portfolio.totalApplications === 0 && (
          <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 10, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#22C55E', marginBottom: '0.5rem' }}>Welcome to Farroway — Get started in 3 steps</div>
            <ol style={{ margin: 0, paddingLeft: '1.4rem', color: '#FFFFFF', fontSize: '0.9rem', lineHeight: 1.8 }}>
              <li>
                <strong>Add your first farmers</strong> — go to{' '}
                <span onClick={() => navigate('/farmers')} style={{ color: '#22C55E', cursor: 'pointer', textDecoration: 'underline' }}>Farmers</span>{' '}
                and use <em>+ New Farmer</em> or <em>Invite Farmer</em>
              </li>
              <li>
                <strong>Create a farm season</strong> — open a farmer profile and add a season to start tracking progress
              </li>
              <li>
                <strong>Submit a loan application</strong> — once a season is active, submit an application to begin the credit workflow
              </li>
            </ol>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22C55E" radius={[4, 4, 0, 0]} />
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

// ─── Benchmark Summary Card ────────────────────────────────

function BenchmarkSummaryCard({ data }) {
  const { farmers, seasons, performance } = data;
  if (!farmers || !seasons) return null;

  const engagementRate = seasons.progressEngagementRate ?? null;
  const validationRate = seasons.validationCoverageRate ?? null;
  const avgScore = performance?.avgProgressScore ?? null;

  const engagementColor = engagementRate == null ? '#A1A1AA'
    : engagementRate >= 70 ? '#22C55E'
    : engagementRate >= 45 ? '#F59E0B'
    : '#EF4444';

  const validationColor = validationRate == null ? '#A1A1AA'
    : validationRate >= 60 ? '#22C55E'
    : validationRate >= 35 ? '#F59E0B'
    : '#EF4444';

  const cls = performance?.classDistribution ?? {};
  const atRisk = (cls.at_risk || 0) + (cls.critical || 0);
  const onTrack = (cls.on_track || 0) + (cls.slight_delay || 0);

  return (
    <div className="card" style={{ marginBottom: '1.25rem', border: '1px solid #243041' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Organization Performance Benchmarks</span>
        <a href="/reports" style={{ fontSize: '0.78rem', color: '#22C55E', textDecoration: 'none', fontWeight: 500 }}>
          Full report →
        </a>
      </div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
          <MetricPill label="Season adoption" value={`${farmers.adoptionRate}%`} sub={`${farmers.withSeasons} / ${farmers.total} farmers`} color={farmers.adoptionRate >= 60 ? '#22C55E' : '#F59E0B'} />
          <MetricPill label="Activity engagement" value={engagementRate != null ? `${engagementRate}%` : '—'} sub="seasons with updates" color={engagementColor} />
          <MetricPill label="Validation coverage" value={validationRate != null ? `${validationRate}%` : '—'} sub="seasons with officer validation" color={validationColor} />
          <MetricPill label="Avg progress score" value={avgScore != null ? `${avgScore}/100` : '—'} sub="last 12 months" color={avgScore == null ? '#A1A1AA' : avgScore >= 65 ? '#22C55E' : avgScore >= 45 ? '#F59E0B' : '#EF4444'} />
          {onTrack + atRisk > 0 && (
            <MetricPill label="On track / at risk" value={`${onTrack} / ${atRisk}`} sub="scored seasons" color={atRisk > onTrack ? '#EF4444' : '#22C55E'} />
          )}
          <MetricPill label="Active seasons" value={seasons.active} sub={`${seasons.completed} completed`} color="#16A34A" />
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value, sub, color }) {
  return (
    <div style={{ background: '#1E293B', borderRadius: 8, padding: '0.6rem 0.8rem' }}>
      <div style={{ fontSize: '0.68rem', color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: '#71717A', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
