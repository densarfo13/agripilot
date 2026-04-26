import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { PriorityBadge } from '../components/TrustRiskBadge.jsx';
import { SkeletonDashboard } from '../components/SkeletonLoader.jsx';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';
import { ADMIN_ROLES } from '../utils/roles.js';
import { getCropLabel, getCropLabelSafe } from '../utils/crops.js';
// Voice controls removed from the admin dashboard. Admin UI is
// kept distraction-free per the voice/audio scope rule —
// see src/lib/voice/adminGuard.js.

/**
 * Admin Dashboard — decision-focused, action-first.
 *
 * Layout: Hero metrics → Attention panel → Activity trend → Farmer overview → Quick actions → Export
 * No charts on first load — fast, minimal, large tap targets.
 */

const TASK_NAV = {
  APPROVE_ONBOARDING: (t) => `/farmer-registrations`,
  RESOLVE_INVITE:     (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  ASSIGN_OFFICER:     (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  REVIEW_HIGH_RISK:   (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  REVIEW_BACKLOG:     (t) => t.applicationId ? `/applications/${t.applicationId}` : `/applications`,
  VALIDATE_UPDATE:    (t) => t.farmerId ? `/farmer-home/${t.farmerId}/progress` : `/officer-validation`,
  FOLLOW_UP_STALE:    (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  CONFIRM_HARVEST:    (t) => t.farmerId ? `/farmers/${t.farmerId}` : `/farmers`,
  REVIEW_APPLICATION: (t) => t.applicationId ? `/applications/${t.applicationId}` : `/applications`,
  RESOLVE_BLOCKER:    (t) => t.applicationId ? `/applications/${t.applicationId}` : `/applications`,
  REVIEW_OVERDUE:     (t) => t.applicationId ? `/applications/${t.applicationId}` : `/applications`,
};

const TASK_ICONS = {
  APPROVE_ONBOARDING: '👤', RESOLVE_INVITE: '📩', ASSIGN_OFFICER: '👮',
  REVIEW_HIGH_RISK: '⚠️', REVIEW_BACKLOG: '📋', VALIDATE_UPDATE: '✅',
  FOLLOW_UP_STALE: '⏰', CONFIRM_HARVEST: '🌾', REVIEW_APPLICATION: '📄',
  RESOLVE_BLOCKER: '🚧', REVIEW_OVERDUE: '🔴',
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
  const [expiringInvites, setExpiringInvites] = useState(0);
  const [loadWarning, setLoadWarning] = useState('');
  const [deliveryStats, setDeliveryStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
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
      const missingData = [];
      if (canSeePilotMetrics && !mRes?.data) missingData.push('pilot metrics');
      if (canSeeAttention && !aRes?.data) missingData.push('attention items');
      if (missingData.length > 0) setLoadWarning(`Some data could not be loaded: ${missingData.join(', ')}. Try refreshing.`);
      if (canSeeAttention) {
        api.get('/farmers/expiring-invites').then(r => setExpiringInvites(r.data?.count || 0)).catch(() => {});
      }
      // Delivery stats — non-blocking, admin-only
      if (isAdmin) {
        api.get('/pilot/delivery-stats').then(r => setDeliveryStats(r.data)).catch(() => {});
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedOrgId]);

  if (loading) return <SkeletonDashboard />;
  if (!portfolio) return (
    <div className="page-body">
      <div className="alert alert-danger">
        Unable to load dashboard data.
        <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  const fmt = (n) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n;

  // ─── Derived metrics ────────────────────────────────────

  const totalFarmers = adoption?.farmers?.total ?? 0;
  const activeFarmers = adoption?.farmers?.approved ?? 0;
  const validatedSeasons = benchmarkSummary?.seasons?.validationCoverageRate != null
    ? Math.round((benchmarkSummary.seasons.validationCoverageRate / 100) * (benchmarkSummary.seasons.active || 0))
    : 0;
  const needsAttention = attentionCount + queues.fraud + queues.escalated;

  // Trend: compare adoption rates to thresholds
  const adoptionRate = benchmarkSummary?.farmers?.adoptionRate ?? null;
  const engagementRate = benchmarkSummary?.seasons?.progressEngagementRate ?? null;
  const trendUp = adoptionRate != null && adoptionRate >= 50;

  // Unified attention items: tasks + alerts + queue warnings
  const attentionItems = [];

  // Queue warnings first (highest priority)
  if (queues.fraud > 0) {
    attentionItems.push({
      icon: '🚨', label: `${queues.fraud} fraud flag${queues.fraud > 1 ? 's' : ''}`,
      detail: 'Review flagged applications',
      priority: 'High', href: '/fraud-queue', color: '#EF4444',
    });
  }
  if (queues.escalated > 0) {
    attentionItems.push({
      icon: '⚡', label: `${queues.escalated} escalated`,
      detail: 'Awaiting decision',
      priority: 'High', href: '/applications?status=escalated', color: '#F59E0B',
    });
  }
  if (pendingCount > 0) {
    attentionItems.push({
      icon: '📝', label: `${pendingCount} registration${pendingCount > 1 ? 's' : ''} pending approval`,
      detail: 'Review and approve new farmers',
      priority: 'High', href: '/farmer-registrations', color: '#0EA5E9',
    });
  }
  if (queues.verification > 0) {
    attentionItems.push({
      icon: '🔍', label: `${queues.verification} application${queues.verification > 1 ? 's' : ''} awaiting review`,
      detail: 'Open verification queue to process',
      priority: 'Medium', href: '/verification-queue', color: '#F59E0B',
    });
  }
  if (expiringInvites > 0) {
    attentionItems.push({
      icon: '⏰', label: `${expiringInvites} invite${expiringInvites > 1 ? 's' : ''} expiring`,
      detail: 'Resend before they expire',
      priority: 'Medium', href: '/farmers', color: '#F59E0B',
    });
  }
  // Then tasks (already sorted by priority from API)
  tasks.slice(0, 6).forEach(t => {
    const navFn = TASK_NAV[t.taskType];
    attentionItems.push({
      icon: TASK_ICONS[t.taskType] || '📋',
      label: t.title,
      detail: t.reason,
      priority: t.priority,
      href: navFn ? navFn(t) : null,
      color: t.priority === 'High' ? '#EF4444' : t.priority === 'Medium' ? '#F59E0B' : '#A1A1AA',
    });
  });
  // Pesticide compliance warnings
  if (adoption?.pesticideCompliance?.nonCompliant > 0) {
    attentionItems.push({
      icon: '🧴', label: `${adoption.pesticideCompliance.nonCompliant} farmer${adoption.pesticideCompliance.nonCompliant > 1 ? 's' : ''} non-compliant (pesticide)`,
      detail: 'Review pesticide usage violations',
      priority: 'High', href: '/farmers', color: '#EF4444',
    });
  }
  if (adoption?.pesticideCompliance?.needsReview > 0) {
    attentionItems.push({
      icon: '🧴', label: `${adoption.pesticideCompliance.needsReview} farmer${adoption.pesticideCompliance.needsReview > 1 ? 's' : ''} need pesticide review`,
      detail: 'Missing pesticide data — check records',
      priority: 'Medium', href: '/farmers', color: '#F59E0B',
    });
  }
  // Then alerts
  alerts.slice(0, 3).forEach(a => {
    attentionItems.push({
      icon: a.severity === 'high' ? '🔴' : '🟡',
      label: a.type.replace(/_/g, ' '),
      detail: a.message,
      priority: a.severity === 'high' ? 'High' : 'Medium',
      href: '/pilot-metrics',
      color: a.severity === 'high' ? '#EF4444' : '#F59E0B',
    });
  });

  // Status breakdown for farmer overview
  const farmerStatuses = [];
  if (adoption) {
    if (adoption.farmers?.approved) farmerStatuses.push({ label: 'Approved Farmers', count: adoption.farmers.approved, color: '#22C55E' });
    if (adoption.farmers?.pendingApproval) farmerStatuses.push({ label: 'Pending', count: adoption.farmers.pendingApproval, color: '#F59E0B' });
    if (adoption.farmers?.invitedNotActivated) farmerStatuses.push({ label: 'Invited', count: adoption.farmers.invitedNotActivated, color: '#0EA5E9' });
    if (adoption.adoption?.withSeason) farmerStatuses.push({ label: 'With Season', count: adoption.adoption.withSeason, color: '#16A34A' });
    if (adoption.adoption?.withFirstUpdate) farmerStatuses.push({ label: 'Updating', count: adoption.adoption.withFirstUpdate, color: '#22C55E' });
    if (adoption.adoption?.withHarvest) farmerStatuses.push({ label: 'Harvested', count: adoption.adoption.withHarvest, color: '#7C3AED' });
  }

  const handleExport = () => {
    api.get('/reports/pilot-report?format=csv', { responseType: 'blob' })  // '/reports/pilot-report?format=csv'
      .then(r => {
        const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  };

  return (
    <div style={DS.page} data-testid="admin-dashboard">
      {/* Header */}
      <div style={DS.header} data-testid="dashboard-header">
        <div>
          <h1 style={DS.title}>Dashboard</h1>
          {(selectedOrgName || user?.organization?.name) && (
            <div style={DS.orgLabel}>{selectedOrgName || user?.organization?.name}</div>
          )}
        </div>
        {canSeePilotMetrics && (
          <button onClick={handleExport} style={DS.exportBtn} data-testid="export-btn" aria-label="Export report">
            📊 Export CSV
          </button>
        )}
      </div>

      {loadWarning && (
        <div style={DS.warning}>
          {loadWarning}
          <button onClick={() => window.location.reload()} style={DS.warningRetry}>Refresh</button>
        </div>
      )}

      <div style={DS.body}>
        {/* First-run welcome */}
        {isAdmin && adoption && totalFarmers === 0 && portfolio.totalApplications === 0 && (
          <div style={DS.welcomeCard} data-testid="welcome-card">
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#22C55E', marginBottom: '0.5rem' }}>Welcome — Get started in 3 steps</div>
            <div style={DS.welcomeStep} onClick={() => navigate('/farmers')}>
              <span style={DS.welcomeNum}>1</span>
              <span>Add your first farmers</span>
            </div>
            <div style={DS.welcomeStep}>
              <span style={DS.welcomeNum}>2</span>
              <span>Create a farm season</span>
            </div>
            <div style={DS.welcomeStep}>
              <span style={DS.welcomeNum}>3</span>
              <span>Submit a loan application</span>
            </div>
          </div>
        )}

        {/* ─── 1. HERO METRICS ─── */}
        <div style={DS.metricsGrid} data-testid="hero-metrics">
          <div style={DS.metricCard} onClick={() => navigate('/farmers')} data-testid="metric-total-farmers">
            <div style={DS.metricValue}>{totalFarmers}</div>
            <div style={DS.metricLabel}>Total Farmers</div>
          </div>
          <div style={DS.metricCard} onClick={() => navigate('/farmers')} data-testid="metric-active">
            <div style={{ ...DS.metricValue, color: '#22C55E' }}>{activeFarmers}</div>
            <div style={DS.metricLabel}>Active</div>
          </div>
          <div style={DS.metricCard} onClick={() => navigate('/officer-validation')} data-testid="metric-validated">
            <div style={{ ...DS.metricValue, color: '#0EA5E9' }}>{validatedSeasons}</div>
            <div style={DS.metricLabel}>Validated</div>
          </div>
          <div
            style={{ ...DS.metricCard, border: needsAttention > 0 ? '2px solid rgba(239,68,68,0.4)' : undefined }}
            onClick={canSeeAttention ? () => navigate('/farmers?filter=needs_attention') : undefined}
            data-testid="metric-attention"
          >
            <div style={{ ...DS.metricValue, color: needsAttention > 0 ? '#EF4444' : '#A1A1AA' }}>{needsAttention}</div>
            <div style={DS.metricLabel}>Needs Attention</div>
          </div>
        </div>

        {/* ─── 2. ATTENTION PANEL ─── */}
        {attentionItems.length > 0 ? (
          <div style={DS.attentionCard} data-testid="attention-panel">
            <div style={DS.attentionHeader}>
              <span style={DS.attentionTitle}>Action Required</span>
              <span style={DS.attentionCount}>
                {attentionItems.filter(i => i.priority === 'High').length > 0
                  ? `${attentionItems.filter(i => i.priority === 'High').length} urgent`
                  : `${attentionItems.length} items`}
              </span>
            </div>
            {attentionItems.slice(0, 8).map((item, i) => (
              <div
                key={i}
                onClick={item.href ? () => navigate(item.href) : undefined}
                style={DS.attentionRow}
                data-testid="attention-item"
              >
                <span style={DS.attentionIcon}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={DS.attentionLabel}>{item.label}</div>
                  <div style={DS.attentionDetail}>{item.detail}</div>
                </div>
                <span style={{ ...DS.attentionArrow, color: item.color }}>→</span>
              </div>
            ))}
            {attentionItems.length > 8 && (
              <div onClick={() => navigate('/pilot-metrics')} style={DS.attentionMore}>
                +{attentionItems.length - 8} more →
              </div>
            )}
            {/* Overflow: tasks.length drives "View all" */}
            {tasks.length > 6 && (
              <div onClick={() => navigate('/pilot-metrics')} style={DS.attentionMore}>View all →</div>
            )}
          </div>
        ) : canSeeTasks && (
          <div style={DS.allCaughtUp} data-testid="all-caught-up">
            <span style={{ fontSize: '1.1rem' }}>✅</span>
            <div>
              <div style={{ fontWeight: 600, color: '#22C55E', fontSize: '0.9rem' }}>All caught up</div>
              <div style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>No pending tasks right now.</div>
            </div>
          </div>
        )}

        {/* ─── 3. ACTIVITY TREND ─── */}
        {canSeePilotMetrics && adoption && (
          <div style={DS.trendCard} data-testid="activity-trend">
            <div style={DS.trendRow}>
              <div style={DS.trendItem}>
                <span style={{ fontSize: '1.25rem' }}>{trendUp ? '📈' : '📉'}</span>
                <div>
                  <div style={DS.trendValue}>{adoptionRate != null ? `${adoptionRate}%` : '—'}</div>
                  <div style={DS.trendLabel}>Adoption</div>
                </div>
              </div>
              <div style={DS.trendItem}>
                <span style={{ fontSize: '1.25rem' }}>📊</span>
                <div>
                  <div style={DS.trendValue}>{engagementRate != null ? `${engagementRate}%` : '—'}</div>
                  <div style={DS.trendLabel}>Engagement</div>
                </div>
              </div>
              <div style={DS.trendItem}>
                <span style={{ fontSize: '1.25rem' }}>🌾</span>
                <div>
                  <div style={DS.trendValue}>{adoption.seasons?.harvested ?? 0}</div>
                  <div style={DS.trendLabel}>Harvested</div>
                </div>
              </div>
              <div style={DS.trendItem}>
                <span style={{ fontSize: '1.25rem' }}>📷</span>
                <div>
                  <div style={DS.trendValue}>{adoption.activity?.totalImages ?? 0}</div>
                  <div style={DS.trendLabel}>Photos</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 4. FARMER STATUS OVERVIEW ─── */}
        {farmerStatuses.length > 0 && (
          <div style={DS.statusCard} data-testid="farmer-status-overview">
            <div style={DS.statusHeader}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Farmer Pipeline</span>
              <button onClick={() => navigate('/farmers')} style={DS.viewAllBtn}>View all →</button>
            </div>
            <div style={DS.statusGrid}>
              {farmerStatuses.map((s, i) => (
                <div key={i} style={DS.statusItem} onClick={() => navigate('/farmers')}>
                  <div style={{ ...DS.statusCount, color: s.color }}>{s.count}</div>
                  <div style={DS.statusLabel}>{s.label}</div>
                  {/* Mini bar */}
                  <div style={DS.statusBar}>
                    <div style={{ ...DS.statusFill, width: `${totalFarmers > 0 ? (s.count / totalFarmers) * 100 : 0}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Demographics */}
            {adoption?.farmers && (
              <div style={DS.demoRow}>
                {adoption.farmers.womenFarmers > 0 && (
                  <span style={DS.demoTag}>👩‍🌾 {adoption.farmers.womenFarmers} Women</span>
                )}
                {adoption.farmers.youthFarmers > 0 && (
                  <span style={DS.demoTag}>🧑 {adoption.farmers.youthFarmers} Youth</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── 5. QUICK ACTIONS ─── */}
        <div style={DS.actionsGrid} data-testid="quick-actions">
          <button onClick={() => navigate('/farmers')} style={DS.actionBtn} data-testid="action-invite">
            <span style={{ fontSize: '1.3rem' }}>📩</span>
            <span style={DS.actionLabel}>Invite Farmer</span>
          </button>
          <button onClick={() => navigate('/farmers')} style={DS.actionBtn} data-testid="action-resend">
            <span style={{ fontSize: '1.3rem' }}>🔄</span>
            <span style={DS.actionLabel}>Resend Invites</span>
          </button>
          <button onClick={() => navigate('/farmers')} style={DS.actionBtn} data-testid="action-assign">
            <span style={{ fontSize: '1.3rem' }}>👮</span>
            <span style={DS.actionLabel}>Assign Officer</span>
          </button>
          <button onClick={() => navigate('/officer-validation')} style={DS.actionBtn} data-testid="action-validate">
            <span style={{ fontSize: '1.3rem' }}>✅</span>
            <span style={DS.actionLabel}>Validate</span>
          </button>
        </div>

        {/* ─── 6. EXPANDABLE DETAILS ─── */}
        <button
          onClick={() => setShowMoreDetails(d => !d)}
          style={DS.detailsToggle}
          aria-expanded={showMoreDetails}
          data-testid="details-toggle"
        >
          <span style={{ fontWeight: 600 }}>Portfolio Details</span>
          <span style={{ color: '#A1A1AA', transition: 'transform 0.2s', transform: showMoreDetails ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
        </button>

        {showMoreDetails && (
          <div style={DS.detailsBody} data-testid="portfolio-details">
            {/* Portfolio metrics */}
            <div style={DS.detailsGrid}>
              <div style={DS.detailPill}>
                <div style={DS.detailPillLabel}>Applications</div>
                <div style={DS.detailPillValue}>{portfolio.totalApplications}</div>
              </div>
              <div style={DS.detailPill}>
                <div style={DS.detailPillLabel}>Requested</div>
                <div style={DS.detailPillValue}>{fmt(portfolio.totalRequestedAmount)}</div>
              </div>
              <div style={DS.detailPill}>
                <div style={DS.detailPillLabel}>Recommended</div>
                <div style={DS.detailPillValue}>{fmt(portfolio.totalRecommendedAmount)}</div>
              </div>
              <div style={DS.detailPill}>
                <div style={DS.detailPillLabel}>Avg Score</div>
                <div style={DS.detailPillValue}>{Math.round(portfolio.avgVerificationScore)}/100</div>
              </div>
            </div>

            {/* Benchmark summary */}
            {benchmarkSummary && (
              <div style={DS.detailsGrid}>
                <div style={DS.detailPill}>
                  <div style={DS.detailPillLabel}>Season Adoption</div>
                  <div style={{ ...DS.detailPillValue, color: adoptionRate >= 50 ? '#22C55E' : '#F59E0B' }}>{adoptionRate ?? '—'}%</div>
                </div>
                <div style={DS.detailPill}>
                  <div style={DS.detailPillLabel}>Engagement</div>
                  <div style={{ ...DS.detailPillValue, color: engagementRate >= 50 ? '#22C55E' : '#F59E0B' }}>{engagementRate ?? '—'}%</div>
                </div>
                <div style={DS.detailPill}>
                  <div style={DS.detailPillLabel}>Validation</div>
                  <div style={DS.detailPillValue}>{benchmarkSummary.seasons?.validationCoverageRate ?? '—'}%</div>
                </div>
                <div style={DS.detailPill}>
                  <div style={DS.detailPillLabel}>Avg Progress</div>
                  <div style={DS.detailPillValue}>{benchmarkSummary.performance?.avgProgressScore ?? '—'}/100</div>
                </div>
              </div>
            )}

            {/* Queue counts */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <span style={DS.queueTag} onClick={() => navigate('/verification-queue')}>Verification: {queues.verification}</span>
              <span style={{ ...DS.queueTag, color: queues.fraud > 0 ? '#EF4444' : '#A1A1AA' }} onClick={() => navigate('/fraud-queue')}>Fraud: {queues.fraud}</span>
              <span style={DS.queueTag} onClick={() => navigate('/farmer-registrations')}>Pending: {pendingCount}</span>
            </div>

            {/* Delivery stats */}
            {deliveryStats?.summary && (
              <div style={{ marginTop: '0.75rem' }} data-testid="delivery-stats">
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#A1A1AA', marginBottom: '0.4rem' }}>Invite Delivery</div>
                <div style={DS.detailsGrid}>
                  <div style={DS.detailPill}>
                    <div style={DS.detailPillLabel}>Invited</div>
                    <div style={DS.detailPillValue}>{deliveryStats.summary.totalInvited}</div>
                  </div>
                  <div style={DS.detailPill}>
                    <div style={DS.detailPillLabel}>Activated</div>
                    <div style={DS.detailPillValue}>{deliveryStats.summary.totalActivated}</div>
                  </div>
                  <div style={DS.detailPill}>
                    <div style={DS.detailPillLabel}>Activation Rate</div>
                    <div style={{ ...DS.detailPillValue, color: deliveryStats.summary.activationRate >= 50 ? '#22C55E' : '#F59E0B' }}>
                      {deliveryStats.summary.activationRate}%
                    </div>
                  </div>
                  <div style={DS.detailPill}>
                    <div style={DS.detailPillLabel}>Failed</div>
                    <div style={{ ...DS.detailPillValue, color: deliveryStats.summary.stalledCount > 0 ? '#EF4444' : '#A1A1AA' }}>
                      {deliveryStats.summary.stalledCount}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Crop + Land metrics */}
            {adoption?.cropDistribution?.length > 0 && (
              <div style={{ marginTop: '0.75rem' }} data-testid="crop-land-stats">
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#A1A1AA', marginBottom: '0.4rem' }}>Crop & Land</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {adoption.cropDistribution.slice(0, 6).map(c => (
                    <span key={c.crop} style={DS.queueTag}>{getCropLabelSafe(c.crop)}: {c.count}</span>
                  ))}
                </div>
                {adoption.landSize && (
                  <div style={{ ...DS.detailsGrid, marginTop: '0.5rem' }}>
                    <div style={DS.detailPill}>
                      <div style={DS.detailPillLabel}>Total Land</div>
                      <div style={DS.detailPillValue}>{adoption.landSize.totalHectares} ha</div>
                    </div>
                    <div style={DS.detailPill}>
                      <div style={DS.detailPillLabel}>Avg Farm</div>
                      <div style={DS.detailPillValue}>{adoption.landSize.avgHectares} ha</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent applications */}
            {portfolio.recentApplications?.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#A1A1AA', marginBottom: '0.4rem' }}>Recent Applications</div>
                {portfolio.recentApplications.slice(0, 5).map(app => (
                  <div key={app.id} onClick={() => navigate(`/applications/${app.id}`)} style={DS.recentRow}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{app.farmer.fullName}</span>
                    <span style={{ color: '#A1A1AA', fontSize: '0.8rem' }}>{getCropLabelSafe(app.cropType)}</span>
                    <span style={{ fontSize: '0.8rem', color: '#22C55E' }}>{app.currencyCode || 'KES'} {app.requestedAmount.toLocaleString()}</span>
                  </div>
                ))}
                <button onClick={() => navigate('/applications')} style={DS.viewAllBtn}>All applications →</button>
              </div>
            )}

            {/* Full metrics link */}
            {canSeePilotMetrics && (
              <button onClick={() => navigate('/pilot-metrics')} style={{ ...DS.viewAllBtn, marginTop: '0.75rem' }}>
                Full Pilot Metrics →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const DS = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#FFFFFF' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 1.25rem', background: '#162033', borderBottom: '1px solid #243041',
    position: 'sticky', top: 0, zIndex: 100,
  },
  title: { margin: 0, fontSize: '1.25rem', fontWeight: 700 },
  orgLabel: { fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.15rem' },
  exportBtn: {
    padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #243041',
    borderRadius: '8px', color: '#A1A1AA', fontSize: '0.85rem', cursor: 'pointer',
    minHeight: '44px', WebkitTapHighlightColor: 'transparent',
  },
  body: { maxWidth: '700px', margin: '0 auto', padding: '1rem' },

  warning: {
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: '8px', padding: '0.6rem 1rem', margin: '0.75rem 1rem',
    fontSize: '0.85rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '0.5rem',
  },
  warningRetry: {
    marginLeft: 'auto', padding: '0.3rem 0.75rem', background: 'transparent',
    border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px',
    color: '#F59E0B', fontSize: '0.8rem', cursor: 'pointer',
  },

  // Welcome
  welcomeCard: {
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem',
  },
  welcomeStep: {
    display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0',
    fontSize: '0.9rem', cursor: 'pointer',
  },
  welcomeNum: {
    width: '24px', height: '24px', borderRadius: '50%', background: '#22C55E',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
  },

  // Hero metrics
  metricsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem',
    marginBottom: '1rem',
  },
  metricCard: {
    background: '#162033', borderRadius: '12px', padding: '1rem 0.75rem',
    textAlign: 'center', cursor: 'pointer', minHeight: '80px',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s', border: '2px solid transparent',
  },
  metricValue: { fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF' },
  metricLabel: { fontSize: '0.7rem', color: '#A1A1AA', fontWeight: 600, marginTop: '0.2rem', textTransform: 'uppercase' },

  // Attention panel
  attentionCard: {
    background: '#162033', borderRadius: '12px', marginBottom: '1rem',
    overflow: 'hidden', border: '1px solid #243041',
  },
  attentionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 1rem', borderBottom: '1px solid #243041',
  },
  attentionTitle: { fontWeight: 700, fontSize: '0.95rem' },
  attentionCount: { fontSize: '0.75rem', color: '#EF4444', fontWeight: 600 },
  attentionRow: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.65rem 1rem', borderBottom: '1px solid #1E293B',
    cursor: 'pointer', minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
  },
  attentionIcon: { fontSize: '1rem', flexShrink: 0 },
  attentionLabel: { fontWeight: 600, fontSize: '0.85rem' },
  attentionDetail: { fontSize: '0.75rem', color: '#A1A1AA', lineHeight: 1.4 },
  attentionArrow: { fontSize: '1rem', fontWeight: 700, flexShrink: 0 },
  attentionMore: {
    padding: '0.6rem 1rem', fontSize: '0.8rem', color: '#3B82F6',
    textAlign: 'center', cursor: 'pointer', fontWeight: 600,
  },
  allCaughtUp: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    background: 'rgba(34,197,94,0.08)', border: '1px solid #243041',
    borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '1rem',
  },

  // Trend
  trendCard: {
    background: '#162033', borderRadius: '12px', padding: '0.75rem 1rem',
    marginBottom: '1rem',
  },
  trendRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem',
  },
  trendItem: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
  },
  trendValue: { fontWeight: 700, fontSize: '0.95rem' },
  trendLabel: { fontSize: '0.65rem', color: '#A1A1AA', textTransform: 'uppercase' },

  // Status overview
  statusCard: {
    background: '#162033', borderRadius: '12px', padding: '1rem',
    marginBottom: '1rem', border: '1px solid #243041',
  },
  statusHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '0.75rem',
  },
  statusGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem',
  },
  statusItem: {
    textAlign: 'center', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  statusCount: { fontSize: '1.3rem', fontWeight: 800 },
  statusLabel: { fontSize: '0.7rem', color: '#A1A1AA', marginTop: '0.1rem' },
  statusBar: { height: '3px', background: '#243041', borderRadius: '2px', marginTop: '0.3rem' },
  statusFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s' },
  demoRow: {
    display: 'flex', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '0.5rem',
    borderTop: '1px solid #243041',
  },
  demoTag: { fontSize: '0.8rem', color: '#A1A1AA' },

  // Quick actions
  actionsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem',
    marginBottom: '1rem',
  },
  actionBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.25rem',
    padding: '0.75rem 0.5rem', background: '#162033', border: '1px solid #243041',
    borderRadius: '12px', color: '#FFFFFF', cursor: 'pointer',
    minHeight: '64px', fontSize: '0.75rem', fontWeight: 600,
    WebkitTapHighlightColor: 'transparent',
  },
  actionLabel: { fontSize: '0.7rem', color: '#A1A1AA' },

  // Details toggle
  detailsToggle: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', padding: '0.75rem 1rem', background: '#162033',
    border: '1px solid #243041', borderRadius: '10px',
    color: '#FFFFFF', cursor: 'pointer', marginBottom: '0.5rem',
    minHeight: '48px', WebkitTapHighlightColor: 'transparent',
  },
  detailsBody: {
    background: '#162033', borderRadius: '10px', padding: '1rem',
    border: '1px solid #243041', marginBottom: '1rem',
  },
  detailsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  detailPill: {
    background: '#1E293B', borderRadius: '8px', padding: '0.5rem 0.6rem',
    textAlign: 'center',
  },
  detailPillLabel: { fontSize: '0.6rem', color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase' },
  detailPillValue: { fontSize: '1rem', fontWeight: 700, marginTop: '0.1rem' },

  queueTag: {
    padding: '0.3rem 0.6rem', background: '#1E293B', borderRadius: '6px',
    fontSize: '0.75rem', color: '#A1A1AA', cursor: 'pointer',
  },
  recentRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.4rem 0', borderBottom: '1px solid #243041', cursor: 'pointer',
  },
  viewAllBtn: {
    background: 'none', border: 'none', color: '#22C55E', fontSize: '0.8rem',
    fontWeight: 600, cursor: 'pointer', padding: '0.25rem 0',
  },
};
