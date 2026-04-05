import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFarmerContext } from './FarmerHomePage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function FarmerOverviewTab() {
  const { farmer, summary, reminderSummary, unread, farmerId } = useFarmerContext();
  const navigate = useNavigate();
  const recentApps = farmer?.applications?.slice(0, 5) || [];

  return (
    <div className="page-body" style={{ paddingTop: 0 }}>
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
