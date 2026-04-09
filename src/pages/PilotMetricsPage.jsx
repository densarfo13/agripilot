import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';
import { ADMIN_ROLES } from '../utils/roles.js';

const PRIORITY_COLOR = { high: 'rgba(239,68,68,0.15)', medium: 'rgba(245,158,11,0.15)', low: 'rgba(34,197,94,0.15)' };
const PRIORITY_BORDER = { high: '#243041', medium: '#243041', low: '#243041' };
const PRIORITY_DOT = { high: '#EF4444', medium: '#F59E0B', low: '#22C55E' };

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );
}

function FunnelBar({ step, label, count, pct, maxCount }) {
  const barWidth = maxCount > 0 ? Math.max(2, (count / maxCount) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
      <div style={{ width: '1.5rem', textAlign: 'right', fontSize: '0.75rem', color: '#A1A1AA', flexShrink: 0 }}>
        {step}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#FFFFFF' }}>{label}</span>
          <span style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>{count} ({pct}%)</span>
        </div>
        <div style={{ background: '#243041', borderRadius: 4, height: 8 }}>
          <div style={{ width: `${barWidth}%`, background: '#22C55E', height: 8, borderRadius: 4, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </div>
  );
}

function AttentionGroup({ group }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: PRIORITY_COLOR[group.priority] || '#1E293B',
      border: `1px solid ${PRIORITY_BORDER[group.priority] || '#243041'}`,
      borderRadius: 8, marginBottom: '0.75rem', overflow: 'hidden',
    }}>
      <div
        style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[group.priority] || '#6b7280', display: 'inline-block' }} />
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{group.label}</span>
          <span style={{ background: '#162033', border: `1px solid ${PRIORITY_BORDER[group.priority] || '#243041'}`, borderRadius: 12, padding: '0 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
            {group.count}
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>{expanded ? '▲ hide' : '▼ show'}</span>
      </div>
      {expanded && (
        <div style={{ borderTop: `1px solid ${PRIORITY_BORDER[group.priority] || '#243041'}`, padding: '0.5rem 1rem' }}>
          {group.items.slice(0, 10).map((item, i) => (
            <div key={i} style={{ padding: '0.35rem 0', borderBottom: i < group.items.length - 1 ? '1px solid #243041' : 'none', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 500 }}>{item.name || item.farmerName || item.id}</span>
              {item.region && <span style={{ color: '#A1A1AA', marginLeft: '0.5rem' }}>· {item.region}</span>}
              {item.cropType && <span style={{ color: '#A1A1AA', marginLeft: '0.5rem' }}>· {item.cropType}</span>}
              {item.lastActivity && (
                <span style={{ color: '#A1A1AA', marginLeft: '0.5rem' }}>
                  · last active {new Date(item.lastActivity).toLocaleDateString()}
                </span>
              )}
              {item.expectedHarvestDate && (
                <span style={{ color: '#EF4444', marginLeft: '0.5rem' }}>
                  · harvest expected {new Date(item.expectedHarvestDate).toLocaleDateString()}
                </span>
              )}
              {item.waitingSince && (
                <span style={{ color: '#A1A1AA', marginLeft: '0.5rem' }}>
                  · waiting since {new Date(item.waitingSince).toLocaleDateString()}
                </span>
              )}
            </div>
          ))}
          {group.count > 10 && (
            <div style={{ fontSize: '0.75rem', color: '#A1A1AA', padding: '0.35rem 0' }}>
              + {group.count - 10} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PilotMetricsPage() {
  const [metrics, setMetrics] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [attention, setAttention] = useState(null);
  const [reviewerEff, setReviewerEff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = useAuthStore(s => s.user);
  const { selectedOrgId } = useOrgStore();
  const navigate = useNavigate();
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const canSeeAttention = isAdmin || user?.role === 'field_officer';

  useEffect(() => {
    const fetches = [
      api.get('/pilot/metrics'),
      api.get('/pilot/funnel'),
      api.get('/pilot/reviewer-efficiency'),
    ];
    if (canSeeAttention) fetches.push(api.get('/pilot/needs-attention'));

    Promise.all(fetches)
      .then(([mRes, fRes, rRes, aRes]) => {
        setMetrics(mRes.data);
        setFunnel(fRes.data);
        setReviewerEff(rRes.data);
        if (aRes) setAttention(aRes.data);
      })
      .catch(() => setError('Failed to load pilot metrics'))
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  const handleExport = async () => {
    try {
      const res = await api.get('/pilot/summary');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pilot-summary-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export pilot summary');
    }
  };

  if (loading) return <div className="loading">Loading pilot metrics...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Pilot Metrics</h1>
          <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.15rem' }}>
            Actual recorded usage only — no projections
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isAdmin && (
            <button className="btn btn-outline btn-sm" onClick={handleExport}>
              Export Summary
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-danger">{error}</div>}

        {/* ── Farmer Adoption Stats ── */}
        {metrics && (
          <>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#A1A1AA', marginBottom: '0.5rem' }}>
              Farmer Adoption
            </div>
            <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
              <StatCard label="Total Farmers" value={metrics.farmers.total} />
              <StatCard label="Approved" value={metrics.farmers.approved} sub={`${metrics.farmers.pendingApproval} pending`} />
              <StatCard label="Logged In" value={metrics.adoption.loggedIn} sub="since tracking began" />
              <StatCard label="With First Update" value={metrics.adoption.withFirstUpdate} />
              <StatCard label="With Image" value={metrics.adoption.withImage} />
              <StatCard label="Harvest Reported" value={metrics.adoption.withHarvest} />
            </div>

            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#A1A1AA', marginBottom: '0.5rem' }}>
              Season & Activity
            </div>
            <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
              <StatCard label="Active Seasons" value={metrics.seasons.active} />
              <StatCard label="Harvested Seasons" value={metrics.seasons.harvested} />
              <StatCard label="Completed Seasons" value={metrics.seasons.completed} />
              <StatCard label="Progress Entries" value={metrics.activity.totalProgressEntries} />
              <StatCard label="Images Uploaded" value={metrics.activity.totalImages} />
              <StatCard label="Harvest Reports" value={metrics.activity.harvestReports} />
            </div>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* ── Completion Funnel ── */}
          {funnel && (
            <div className="card">
              <div className="card-header">Adoption Funnel</div>
              <div className="card-body">
                {funnel.funnel.map((step, i) => (
                  <FunnelBar
                    key={step.step}
                    step={step.step}
                    label={step.label}
                    count={step.count}
                    pct={step.pct}
                    maxCount={funnel.funnel[0]?.count || 1}
                  />
                ))}
                {funnel.funnel[0]?.count === 0 && (
                  <div className="empty-state" style={{ textAlign: 'center', color: '#A1A1AA', padding: '1rem' }}>
                    No approved farmers yet
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Reviewer Efficiency ── */}
          {reviewerEff && (
            <div className="card">
              <div className="card-header">Reviewer Efficiency</div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ background: '#1E293B', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{reviewerEff.queue.active}</div>
                    <div style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>Active queue</div>
                  </div>
                  <div style={{ background: '#1E293B', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                      {reviewerEff.timing.avgReviewHours != null ? `${reviewerEff.timing.avgReviewHours}h` : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>Avg review time</div>
                  </div>
                  <div style={{ background: '#1E293B', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{reviewerEff.throughput.decisionsLast30Days}</div>
                    <div style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>Decisions (30d)</div>
                  </div>
                  <div style={{ background: reviewerEff.timing.oldestPendingHours > 72 ? 'rgba(239,68,68,0.15)' : '#1E293B', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: reviewerEff.timing.oldestPendingHours > 72 ? '#EF4444' : 'inherit' }}>
                      {reviewerEff.timing.oldestPendingHours != null ? `${reviewerEff.timing.oldestPendingHours}h` : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>Oldest pending</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginBottom: '0.35rem', fontWeight: 600 }}>Queue breakdown</div>
                {[
                  ['Submitted', reviewerEff.queue.submitted],
                  ['Under Review', reviewerEff.queue.underReview],
                  ['Needs Evidence', reviewerEff.queue.needsMoreEvidence],
                  ['Field Review', reviewerEff.queue.fieldReviewRequired],
                  ['Escalated', reviewerEff.queue.escalated],
                  ['Fraud Hold', reviewerEff.queue.fraudHold],
                ].filter(([, count]) => count > 0).map(([label, count]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0' }}>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
                {reviewerEff.queue.active === 0 && (
                  <div style={{ color: '#22C55E', fontSize: '0.8rem', textAlign: 'center', padding: '0.5rem' }}>Queue is clear</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Needs Attention ── */}
        {canSeeAttention && attention && (
          <div className="card">
            <div className="card-header">
              Needs Attention
              {attention.totalItems > 0 && (
                <span style={{ background: '#EF4444', color: '#fff', borderRadius: 12, padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  {attention.totalItems}
                </span>
              )}
            </div>
            <div className="card-body">
              {attention.categories.length === 0 ? (
                <div style={{ color: '#22C55E', textAlign: 'center', padding: '1rem', fontSize: '0.875rem' }}>
                  No items needing attention right now.
                </div>
              ) : (
                attention.categories.map(group => (
                  <AttentionGroup key={group.type} group={group} />
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Applications Summary ── */}
        {metrics && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              Applications
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/applications')}>View All</button>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[
                  ['Total', metrics.applications.total, '#22C55E'],
                  ['Submitted', metrics.applications.submitted, '#F59E0B'],
                  ['Under Review', metrics.applications.underReview, '#0891b2'],
                  ['Approved', metrics.applications.approved, '#22C55E'],
                ].map(([label, count, color]) => (
                  <div key={label} style={{ background: '#1E293B', borderRadius: 8, padding: '0.75rem 1.25rem', minWidth: 100, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{count}</div>
                    <div style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
