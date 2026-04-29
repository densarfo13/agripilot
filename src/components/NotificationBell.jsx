/**
 * NotificationBell — bell icon + unread badge + popover.
 *
 *   <NotificationBell userId={user.sub} />
 *
 * Spec contract (Notification System, § 3 + § 5)
 *   * Shows the unread count as a small red dot (or
 *     numeric badge when ≥ 1).
 *   * Tap opens a dropdown with the latest 5–10 entries
 *     (cap enforced by the store; we render up to 10).
 *   * Each row → tap → markAsRead + navigate to a
 *     contextual route based on type.
 *
 * Strict-rule audit
 *   * Local-first — reads `getNotifications()` directly.
 *   * Forward-only state — `read` flag never reverts.
 *   * Closes on outside click + on Escape; safe for
 *     mobile (the popover is fixed-position and won't
 *     overflow tiny viewports).
 *   * Calm copy — "No notifications yet" empty state
 *     instead of an alarmist "0 alerts".
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getNotifications, getUnreadCount, markAsRead, markAllAsRead,
  NOTIFICATION_TYPES,
} from '../notifications/notificationStore.js';
import { tSafe } from '../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

// Type → emoji + nav route. The Dashboard renders most of
// these surfaces inline so the route still lands the user
// in the right place.
const TYPE_META = {
  TASK:    { icon: '📋', route: '/dashboard'      },
  FUNDING: { icon: '🎯', route: '/opportunities'  },
  BUYER:   { icon: '🛒', route: '/marketplace'    },
  PROGRAM: { icon: '📨', route: '/dashboard'      },
};

export default function NotificationBell({
  userId,
  testId = 'notification-bell',
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  // Re-read store every time the dropdown opens AND every
  // 30 s in the background so a fresh notification fired
  // by another part of the app surfaces without a navigate.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const id = window.setInterval(refresh, 30 * 1000);
    function onStorage(e) {
      if (e.key === 'farroway_notifications') refresh();
    }
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const list   = useMemo(() => getNotifications(userId), [userId, tick]);
  const unread = useMemo(() => getUnreadCount(userId),   [userId, tick]);

  // Close on outside click + on Escape.
  const wrapperRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    function onClick(e) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleOpen(item) {
    if (item.id) markAsRead(item.id);
    setOpen(false);
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
    <span
      ref={wrapperRef}
      style={S.wrap}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={tSafe('notifications.aria',
          'Open notifications')}
        aria-haspopup="true"
        aria-expanded={open}
        style={S.btn}
        data-testid={`${testId}-toggle`}
      >
        <span aria-hidden="true" style={S.bellIcon}>🔔</span>
        {unread > 0 && (
          <span style={S.badge} aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={S.popover} role="menu" data-testid={`${testId}-popover`}>
          <header style={S.head}>
            <span style={S.title}>
              {tSafe('notifications.title', 'Notifications')}
            </span>
            {list.length > 0 && unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                style={S.markAll}
                data-testid={`${testId}-mark-all`}
              >
                {tSafe('notifications.markAll', 'Mark all read')}
              </button>
            )}
          </header>

          {list.length === 0 ? (
            <div style={S.empty}>
              <span style={S.emptyIcon} aria-hidden="true">📭</span>
              <p style={S.emptyText}>
                {tSafe('notifications.empty',
                  'No notifications yet.')}
              </p>
            </div>
          ) : (
            <ul style={S.list}>
              {list.map((n) => {
                const meta = TYPE_META[n.type] || { icon: '•' };
                return (
                  <li
                    key={n.id}
                    style={{
                      ...S.row,
                      ...(n.read ? S.rowRead : S.rowUnread),
                    }}
                    onClick={() => handleOpen(n)}
                    data-testid={`${testId}-row-${n.id}`}
                  >
                    <span style={S.rowIcon} aria-hidden="true">
                      {meta.icon}
                    </span>
                    <div style={S.rowBody}>
                      <div style={S.rowTitle}>{n.title}</div>
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
          )}

          <footer style={S.foot}>
            <Link to="/notifications"
                  onClick={() => setOpen(false)}
                  style={S.footLink}
                  data-testid={`${testId}-view-all`}>
              {tSafe('notifications.viewAll', 'View all')} →
            </Link>
          </footer>
        </div>
      )}
    </span>
  );
}

const S = {
  wrap: { position: 'relative', display: 'inline-block' },
  btn: {
    position: 'relative',
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center',
    width: 40, height: 40,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '999px',
    color: C.white, cursor: 'pointer',
  },
  bellIcon: { fontSize: '1.1rem', lineHeight: 1 },
  badge: {
    position: 'absolute',
    top: -2, right: -2,
    minWidth: 16, height: 16,
    padding: '0 4px',
    borderRadius: 999,
    background: '#EF4444',
    color: '#fff',
    fontSize: '0.625rem',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 2px ' + C.darkPanel,
  },

  popover: {
    position: 'absolute', top: 'calc(100% + 0.5rem)', right: 0,
    width: 'min(22rem, calc(100vw - 1.5rem))',
    background: C.darkPanel,
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '14px',
    boxShadow: '0 18px 48px rgba(0,0,0,0.5)',
    color: C.white,
    overflow: 'hidden',
    zIndex: 200,
  },
  head: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 0.95rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  title: { fontWeight: 800, fontSize: '0.9375rem' },
  markAll: {
    background: 'transparent', border: 'none',
    color: C.lightGreen, cursor: 'pointer',
    fontSize: '0.8125rem', fontWeight: 700,
  },
  list: {
    listStyle: 'none', padding: 0, margin: 0,
    maxHeight: '24rem', overflowY: 'auto',
  },
  row: {
    display: 'flex', gap: '0.6rem',
    padding: '0.65rem 0.85rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer',
    alignItems: 'flex-start',
  },
  rowUnread: { background: 'rgba(34,197,94,0.06)' },
  rowRead:   { background: 'transparent' },
  rowIcon:   { fontSize: '1.125rem', lineHeight: 1, flexShrink: 0 },
  rowBody:   { flex: 1, minWidth: 0 },
  rowTitle:  { color: C.white, fontWeight: 700,
               fontSize: '0.875rem' },
  rowMsg:    { color: 'rgba(255,255,255,0.78)',
               fontSize: '0.8125rem', marginTop: '0.15rem' },
  rowTime:   { color: 'rgba(255,255,255,0.45)',
               fontSize: '0.75rem', marginTop: '0.2rem' },
  unreadDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: C.lightGreen,
    alignSelf: 'center', flexShrink: 0,
  },

  empty: {
    padding: '1.25rem',
    textAlign: 'center', color: 'rgba(255,255,255,0.7)',
  },
  emptyIcon: { fontSize: '1.5rem' },
  emptyText: { margin: '0.4rem 0 0', fontSize: '0.875rem' },

  foot: {
    padding: '0.6rem 0.95rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center',
  },
  footLink: { color: C.lightGreen, textDecoration: 'none',
              fontSize: '0.8125rem', fontWeight: 700 },
};
