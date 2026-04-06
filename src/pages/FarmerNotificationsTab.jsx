import React, { useEffect, useState } from 'react';
import { useFarmerContext } from './FarmerHomePage.jsx';
import api from '../api/client.js';

const TYPE_COLORS = {
  application_update: '#2563eb',
  reminder: '#d97706',
  post_harvest: '#16a34a',
  market: '#7c3aed',
  weather: '#0891b2',
  system: '#6b7280',
};

export default function FarmerNotificationsTab() {
  const { farmerId, refresh } = useFarmerContext();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadNotifications = () => {
    setLoading(true);
    setLoadError('');
    const params = { limit: 50 };
    if (filter === 'unread') params.read = 'false';
    else if (filter === 'read') params.read = 'true';
    api.get(`/notifications/farmer/${farmerId}`, { params })
      .then(r => setNotifications(r.data))
      .catch(() => setLoadError('Failed to load notifications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadNotifications(); }, [farmerId, filter]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      refresh();
    } catch { }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post(`/notifications/farmer/${farmerId}/mark-all-read`);
      loadNotifications();
      refresh();
    } catch { } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="page-body" style={{ paddingTop: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="flex gap-1">
          {['', 'unread', 'read'].map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
              {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-outline" disabled={markingAll} onClick={markAllRead}>
            {markingAll ? 'Marking...' : `Mark All Read (${unreadCount})`}
          </button>
        )}
      </div>

      {loadError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={loadNotifications}>Retry</button></div>}
      {loading ? <div className="loading">Loading notifications...</div> : notifications.length === 0 ? (
        <div className="card"><div className="card-body"><div className="empty-state">No notifications</div></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map(n => (
            <div
              key={n.id}
              className="card"
              style={{
                cursor: !n.read ? 'pointer' : 'default',
                borderLeft: `3px solid ${TYPE_COLORS[n.notificationType] || '#e5e7eb'}`,
                opacity: n.read ? 0.7 : 1,
              }}
              onClick={() => !n.read && markRead(n.id)}
            >
              <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', display: 'inline-block', flexShrink: 0 }} />}
                      <span style={{ fontWeight: n.read ? 400 : 600, fontSize: '0.95rem' }}>{n.title}</span>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 3,
                        background: `${TYPE_COLORS[n.notificationType] || '#e5e7eb'}15`,
                        color: TYPE_COLORS[n.notificationType] || '#6b7280',
                        border: `1px solid ${TYPE_COLORS[n.notificationType] || '#e5e7eb'}30`,
                      }}>
                        {n.notificationType?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>{n.message}</p>
                  </div>
                  <span className="text-sm text-muted" style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
