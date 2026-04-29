/**
 * Notifications — full-page list of recent notifications.
 *
 *   <Route path="/notifications" element={<Notifications />} />
 *
 * Spec contract (Notification System, § 6 + § 7)
 *   * Renders the latest 5–10 notifications (cap enforced
 *     by the store).
 *   * Tap → markAsRead + navigate to type-specific route.
 *   * "Mark all read" action.
 *   * Empty state never crashes.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getNotifications, markAsRead, markAllAsRead,
} from '../notifications/notificationStore.js';
import { tSafe } from '../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import BrandLogo from '../components/BrandLogo.jsx';

const C = FARROWAY_BRAND.colors;

const TYPE_META = {
  TASK:    { icon: '📋', label: 'Task',    route: '/dashboard'     },
  FUNDING: { icon: '🎯', label: 'Funding', route: '/opportunities' },
  BUYER:   { icon: '🛒', label: 'Buyer',   route: '/marketplace'   },
  PROGRAM: { icon: '📨', label: 'Program', route: '/dashboard'     },
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.sub || null;

  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  // Refresh on storage events from other tabs.
  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'farroway_notifications') refresh();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
    return undefined;
  }, []);

  const list = useMemo(() => getNotifications(userId), [userId, tick]);

  function handleOpen(item) {
    if (item.id) markAsRead(item.id);
    refresh();
    const route = (TYPE_META[item.type] && TYPE_META[item.type].route)
                  || '/dashboard';
    navigate(route);
  }

  function handleMarkAll() {
    markAllAsRead(userId);
    refresh();
  }

  return (
    <main style={S.page} data-testid="notifications-page">
      <div style={S.container}>
        <header style={S.header}>
          <BrandLogo variant="light" size="md" />
          <h1 style={S.h1}>
            {tSafe('notifications.pageTitle', 'Notifications')}
          </h1>
          <p style={S.lead}>
            {tSafe('notifications.pageLead',
              'The latest updates from your tasks, programs, funding matches, and buyer interest.')}
          </p>
        </header>

        {list.length === 0 ? (
          <div style={S.empty} data-testid="notifications-empty">
            <span style={S.emptyIcon} aria-hidden="true">📭</span>
            <p style={S.emptyText}>
              {tSafe('notifications.empty', 'No notifications yet.')}
            </p>
            <p style={S.emptyHint}>
              {tSafe('notifications.emptyHint',
                'New tasks, funding matches, buyer interest, and NGO programs will appear here.')}
            </p>
          </div>
        ) : (
          <>
            <div style={S.toolbar}>
              <span style={S.count}>
                {list.length} {tSafe('notifications.itemCount',
                  list.length === 1 ? 'item' : 'items')}
              </span>
              {list.some((n) => !n.read) && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  style={S.btnGhost}
                  data-testid="notifications-mark-all"
                >
                  {tSafe('notifications.markAll', 'Mark all read')}
                </button>
              )}
            </div>

            <ul style={S.list} data-testid="notifications-list">
              {list.map((n) => {
                const meta = TYPE_META[n.type] || { icon: '•', label: n.type };
                return (
                  <li
                    key={n.id}
                    onClick={() => handleOpen(n)}
                    style={{
                      ...S.row,
                      ...(n.read ? S.rowRead : S.rowUnread),
                    }}
                    data-testid={`notifications-row-${n.id}`}
                  >
                    <span style={S.rowIcon} aria-hidden="true">{meta.icon}</span>
                    <div style={S.rowBody}>
                      <div style={S.rowHeader}>
                        <span style={S.rowTitle}>{n.title}</span>
                        <span style={S.rowType}>{meta.label}</span>
                      </div>
                      {n.message && (
                        <div style={S.rowMsg}>{n.message}</div>
                      )}
                      <div style={S.rowTime}>
                        {String(n.createdAt || '').replace('T', ' ').slice(0, 16)}
                      </div>
                    </div>
                    {!n.read && <span style={S.unreadDot} />}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.navy} 0%, ${C.darkPanel} 100%)`,
    color: C.white,
    padding: '1.5rem 1rem 4rem',
  },
  container: {
    maxWidth: '38rem', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  h1:     { margin: '0.4rem 0 0', fontSize: '1.5rem',
            fontWeight: 800, letterSpacing: '-0.01em' },
  lead:   { margin: 0, color: 'rgba(255,255,255,0.7)',
            fontSize: '0.9375rem' },

  toolbar: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem', flexWrap: 'wrap',
  },
  count: { color: 'rgba(255,255,255,0.65)',
           fontSize: '0.8125rem' },
  btnGhost: {
    padding: '0.45rem 0.85rem', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: C.white,
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },

  list: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  row: {
    display: 'flex', gap: '0.65rem',
    padding: '0.85rem 1rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    alignItems: 'flex-start',
  },
  rowUnread: { background: 'rgba(34,197,94,0.08)' },
  rowRead:   { background: 'rgba(255,255,255,0.04)' },
  rowIcon:   { fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 },
  rowBody:   { flex: 1, minWidth: 0 },
  rowHeader: {
    display: 'flex', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center',
  },
  rowTitle:  { color: C.white, fontWeight: 800,
               fontSize: '0.9375rem' },
  rowType:   { color: C.lightGreen, fontSize: '0.6875rem',
               fontWeight: 800, textTransform: 'uppercase',
               letterSpacing: '0.06em' },
  rowMsg:    { color: 'rgba(255,255,255,0.78)',
               fontSize: '0.875rem', marginTop: '0.2rem' },
  rowTime:   { color: 'rgba(255,255,255,0.5)',
               fontSize: '0.75rem', marginTop: '0.25rem' },
  unreadDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: C.lightGreen,
    alignSelf: 'center', flexShrink: 0,
  },

  empty: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.10)',
    borderRadius: '14px',
    padding: '2rem 1.25rem',
    textAlign: 'center',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '0.4rem',
  },
  emptyIcon: { fontSize: '2rem' },
  emptyText: { margin: 0, color: C.white, fontWeight: 700,
               fontSize: '0.9375rem' },
  emptyHint: { margin: 0, color: 'rgba(255,255,255,0.65)',
               fontSize: '0.875rem', maxWidth: '28rem' },
};
