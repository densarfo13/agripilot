import React from 'react';
import { useFarmerContext } from './FarmerHomePage.jsx';
import { useFarmerNotificationsRuntime }
  from '../hooks/useFarmerNotificationsRuntime.js';
import EmptyState from '../components/EmptyState.jsx';
import { useTranslation } from '../i18n/index.js';
import { formatDate } from '../i18n/format.js';

/**
 * FarmerNotificationsTab — pure subscriber to
 * `useFarmerNotificationsRuntime`.
 *
 * Behavior contract (preserved from pre-wave-3):
 *   • Loads on mount + on filter change.
 *   • Three-way filter chip row: All / Unread / Read.
 *   • Mark-single-read uses optimistic update.
 *   • Mark-all-read button shows only when unreadCount > 0.
 *   • After mark-read, `refresh()` from the farmer context is
 *     fired (wired through the runtime's `onChange`) so the
 *     header badge re-fetches its own count.
 *   • Inline error banners with Retry button for load failures;
 *     separate banner for action failures.
 *   • Empty state when nothing matches.
 *
 * What changed (wave 3 — runtime ownership):
 *   • This file no longer calls `api.*` directly.
 *   • Loading flag, error state, fetch lifecycle, optimistic
 *     update, request cancellation, and retry-on-transient now
 *     live in `src/hooks/useFarmerNotificationsRuntime.js`.
 *   • This component is now a PURE renderer over the runtime.
 */

const TYPE_COLORS = {
  application_update: '#C8944D',
  reminder: '#d97706',
  post_harvest: '#B9853F',
  market: '#7c3aed',
  weather: '#0891b2',
  system: '#A1A1AA',
};

export default function FarmerNotificationsTab() {
  const { lang } = useTranslation();
  const { farmerId, refresh: refreshFarmerContext } = useFarmerContext();
  const {
    notifications, loading, loadError,
    filter, setFilter,
    markRead, markAllRead,
    markingAll, actionError,
    unreadCount, refresh,
  } = useFarmerNotificationsRuntime({
    farmerId,
    // Propagate mark-read events back to the farmer context so its
    // own unread-badge count re-fetches. Preserves the previous
    // wiring (the page used to call `refresh()` after every mutation).
    onChange: refreshFarmerContext,
  });

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

      {loadError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={refresh}>Retry</button></div>}
      {actionError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{actionError}</div>}
      {loading ? <div className="loading">Loading notifications...</div> : notifications.length === 0 ? (
        <div className="card"><div className="card-body"><EmptyState icon="🔕" title="No notifications" message="You're all caught up. Notifications about your farm will appear here." compact variant="success" /></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map(n => (
            <div
              key={n.id}
              className="card"
              style={{
                cursor: !n.read ? 'pointer' : 'default',
                borderLeft: `3px solid ${TYPE_COLORS[n.notificationType] || '#243041'}`,
                opacity: n.read ? 0.7 : 1,
              }}
              onClick={() => !n.read && markRead(n.id)}
            >
              <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C8944D', display: 'inline-block', flexShrink: 0 }} />}
                      <span style={{ fontWeight: n.read ? 400 : 600, fontSize: '0.95rem' }}>{n.title}</span>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 3,
                        background: `${TYPE_COLORS[n.notificationType] || '#243041'}15`,
                        color: TYPE_COLORS[n.notificationType] || '#A1A1AA',
                        border: `1px solid ${TYPE_COLORS[n.notificationType] || '#243041'}30`,
                      }}>
                        {n.notificationType?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#A1A1AA' }}>{n.message}</p>
                  </div>
                  <span className="text-sm text-muted" style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                    {formatDate(n.createdAt, lang, { dateStyle: 'medium' })}
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
