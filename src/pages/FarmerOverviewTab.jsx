import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFarmerContext } from './FarmerHomePage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import api from '../api/client.js';

const STAGE_META = {
  pre_planting: { label: 'Pre-Planting', color: '#6b7280', emoji: '\u{1F331}' },
  planting: { label: 'Planting', color: '#16a34a', emoji: '\u{1F33E}' },
  vegetative: { label: 'Vegetative', color: '#059669', emoji: '\u{1F33F}' },
  flowering: { label: 'Flowering', color: '#d97706', emoji: '\u{1F33B}' },
  harvest: { label: 'Harvest', color: '#ea580c', emoji: '\u{1F33D}' },
  post_harvest: { label: 'Post-Harvest', color: '#7c3aed', emoji: '\u{1F4E6}' },
};

export default function FarmerOverviewTab() {
  const { farmer, summary, reminderSummary, unread, farmerId, refresh } = useFarmerContext();
  const navigate = useNavigate();
  const recentApps = farmer?.applications?.slice(0, 5) || [];
  const [lifecycle, setLifecycle] = useState(null);
  const [lcLoading, setLcLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [lcSuccess, setLcSuccess] = useState('');

  useEffect(() => {
    api.get(`/lifecycle/farmers/${farmerId}`)
      .then(r => setLifecycle(r.data))
      .catch(() => {})
      .finally(() => setLcLoading(false));
  }, [farmerId]);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      await api.post(`/lifecycle/farmers/${farmerId}/recompute`);
      const r = await api.get(`/lifecycle/farmers/${farmerId}`);
      setLifecycle(r.data);
      refresh();
    } catch {}
    setRecomputing(false);
  };

  const handleGenerateReminders = async () => {
    try {
      const r = await api.post(`/lifecycle/farmers/${farmerId}/generate-reminders`);
      setLcSuccess(`Generated ${r.data.generated} reminder${r.data.generated === 1 ? '' : 's'} for ${lifecycle?.currentStage?.replace(/_/g, ' ')} stage.`);
      setTimeout(() => setLcSuccess(''), 5000);
      refresh();
    } catch {}
  };

  return (
    <div className="page-body" style={{ paddingTop: 0 }}>
      {/* Lifecycle Stage Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Lifecycle Stage</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={handleGenerateReminders} disabled={lcLoading || !lifecycle}>
              Generate Reminders
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.78rem', cursor: 'pointer', padding: '0.25rem 0.5rem' }}
              onClick={handleRecompute}
              disabled={recomputing || lcLoading}
              title="Recalculate lifecycle stage from latest activity data"
            >
              {recomputing ? '↻ Recalculating...' : '↻ Refresh stage'}
            </button>
          </div>
        </div>
        <div className="card-body">
          {lcSuccess && (
            <div style={{ background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#065f46', marginBottom: '0.75rem' }}>{lcSuccess}</div>
          )}
          {lcLoading ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#999' }}>Loading lifecycle...</div>
          ) : lifecycle ? (
            <>
              {/* Stage progress bar */}
              <div style={{ display: 'flex', gap: '2px', marginBottom: '1rem' }}>
                {(lifecycle.stages || Object.keys(STAGE_META)).map((stage, i) => {
                  const meta = STAGE_META[stage];
                  const isCurrent = stage === lifecycle.currentStage;
                  const isPast = i < lifecycle.stageIndex;
                  return (
                    <div key={stage} style={{
                      flex: 1, textAlign: 'center', padding: '0.5rem 0.25rem',
                      background: isCurrent ? meta.color : isPast ? `${meta.color}22` : '#f3f4f6',
                      color: isCurrent ? '#fff' : isPast ? meta.color : '#9ca3af',
                      borderRadius: i === 0 ? '6px 0 0 6px' : i === 5 ? '0 6px 6px 0' : '0',
                      fontSize: '0.7rem', fontWeight: isCurrent ? 700 : 400,
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ fontSize: '1rem' }}>{meta.emoji}</div>
                      {meta.label}
                    </div>
                  );
                })}
              </div>

              {/* Current stage detail */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Current Stage</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: STAGE_META[lifecycle.currentStage]?.color }}>
                    {STAGE_META[lifecycle.currentStage]?.emoji} {STAGE_META[lifecycle.currentStage]?.label || lifecycle.currentStage}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Crop</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>{lifecycle.cropType || 'Not set'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Trust Status</div>
                  {(() => {
                    const conf = lifecycle.stageConfidence;
                    const map = {
                      high: { label: 'Validated', cls: 'badge-approved', hint: 'Stage confirmed by farmer activity' },
                      medium: { label: 'Needs Verification', cls: 'badge-submitted', hint: 'Stage inferred — no recent confirmation' },
                      low: { label: 'Low Confidence', cls: 'badge-draft', hint: 'Insufficient data to confirm stage' },
                    };
                    const m = map[conf] || { label: conf || 'Unknown', cls: 'badge-draft', hint: '' };
                    return (
                      <span className={`badge ${m.cls}`} title={m.hint}>{m.label}</span>
                    );
                  })()}
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Source</div>
                  <span className="text-sm">{lifecycle.stageSource === 'activity' ? 'Farmer activities' : lifecycle.stageSource === 'seeded' ? 'Demo data' : lifecycle.stageSource?.replace(/_/g, ' ') || 'N/A'}</span>
                </div>
              </div>

              {/* Last activity and reason */}
              {lifecycle.reason && (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '4px', fontSize: '0.8rem', color: '#64748b' }}>
                  {lifecycle.reason}
                </div>
              )}

              {/* Recommendations */}
              {lifecycle.recommendations && lifecycle.recommendations.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Next Actions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {lifecycle.recommendations.slice(0, 4).map((rec, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                        <span style={{ color: '#16a34a', fontWeight: 600, flexShrink: 0 }}>-</span>
                        <div>
                          <span style={{ fontWeight: 500 }}>{rec.title}</span>
                          <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>{rec.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#999' }}>Unable to load lifecycle data</div>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-label">Activities This Month</div>
          <div className="stat-value">{summary?.thisMonthCount || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Reminders</div>
          <div className="stat-value" style={{ color: (reminderSummary?.overdue || 0) > 0 ? '#dc2626' : undefined }}>
            {reminderSummary?.pending || 0}
            {reminderSummary?.overdue > 0 && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginLeft: '0.5rem' }}>({reminderSummary.overdue} overdue)</span>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unread Notifications</div>
          <div className="stat-value">{unread}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Applications</div>
          <div className="stat-value">{farmer?.applications?.length || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Upcoming reminders */}
        <div className="card">
          <div className="card-header">
            Upcoming Reminders
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/farmer-home/${farmerId}/reminders`)}>View All</button>
          </div>
          <div className="card-body" style={{ padding: reminderSummary?.upcoming?.length ? 0 : undefined }}>
            {reminderSummary?.upcoming?.length > 0 ? (
              <table>
                <tbody>
                  {reminderSummary.upcoming.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.title}</td>
                      <td className="text-sm text-muted">{new Date(r.dueDate).toLocaleDateString()}</td>
                      <td><span className={`badge badge-${r.reminderType}`}>{r.reminderType?.replace(/_/g, ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No upcoming reminders</div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="card-header">
            Recent Activity
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/farmer-home/${farmerId}/activities`)}>View All</button>
          </div>
          <div className="card-body" style={{ padding: summary?.recentActivities?.length ? 0 : undefined }}>
            {summary?.recentActivities?.length > 0 ? (
              <table>
                <tbody>
                  {summary.recentActivities.map(a => (
                    <tr key={a.id}>
                      <td><span className={`badge badge-${a.activityType}`}>{a.activityType?.replace(/_/g, ' ')}</span></td>
                      <td>{a.cropType || '-'}</td>
                      <td className="text-sm text-muted">{new Date(a.activityDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No recent activities</div>
            )}
          </div>
        </div>

        {/* Applications */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            Credit Applications
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/applications/new?farmerId=${farmerId}`)}>+ New Application</button>
          </div>
          <div className="card-body" style={{ padding: recentApps.length ? 0 : undefined }}>
            {recentApps.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Crop</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {recentApps.map(app => (
                      <tr key={app.id} onClick={() => navigate(`/applications/${app.id}`)} style={{ cursor: 'pointer' }}>
                        <td>{app.cropType}</td>
                        <td>{app.currencyCode || 'KES'} {app.requestedAmount?.toLocaleString()}</td>
                        <td><StatusBadge value={app.status} /></td>
                        <td className="text-sm text-muted">{new Date(app.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No applications yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
