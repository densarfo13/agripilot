/**
 * NotificationCenter — simple list-view notification feed.
 *
 *   <NotificationCenter
 *     notifications={...}              // optional override; else reads from store
 *     onMarkRead={(id) => ...}         // optional override; else calls store
 *     onMarkAllRead={() => ...}        // optional override; else calls store
 *     emptyKey="notifications.feed.empty"
 *     onClose?
 *   />
 *
 * Dumb-ish: if no callbacks are passed, calls the default store so
 * it works as a self-contained widget. The list is filtered to the
 * unread-first priority ordering the store already provides.
 *
 * Mobile-first: padding + hit-targets sized for a phone.
 */

import { useMemo, useState, useEffect } from 'react';
import { useAppSettings } from '../context/AppSettingsContext.jsx';
import {
  listNotifications, markAsRead as storeMarkRead,
  markAllAsRead as storeMarkAll,
} from '../lib/notifications/notificationStore.js';
import { formatRelativeTime } from '../lib/time/relativeTime.js';

function resolveMessage(t, n) {
  if (!n) return '';
  if (!n.messageKey) return '';
  const resolved = t(n.messageKey, n.messageVars || {});
  if (resolved && resolved !== n.messageKey) return resolved;
  // Minimal English fallback per type — keeps copy actionable.
  const key = n.messageKey.split('.').pop();
  if (key === 'daily_pending')      return `You have ${n.messageVars?.count || 0} tasks today.`;
  if (key === 'missed_yesterday')   return "You missed yesterday's tasks — let's get back on track.";
  if (key === 'harvest_nearing')    return 'Harvest season is approaching.';
  if (key === 'stage_entered')      return 'Your farm is entering a new stage.';
  if (key === 'inactivity')         return 'It\u2019s been a few days — check in on your farm.';
  return '';
}

export default function NotificationCenter({
  notifications,
  onMarkRead,
  onMarkAllRead,
  emptyKey = 'notifications.feed.empty',
  onClose,
}) {
  const { t } = useAppSettings();
  const [list, setList] = useState(
    Array.isArray(notifications) ? notifications : () => listNotifications(),
  );

  useEffect(() => {
    if (Array.isArray(notifications)) setList(notifications);
  }, [notifications]);

  const hasUnread = useMemo(() => list.some((n) => n && !n.read), [list]);

  function handleMarkRead(id) {
    if (typeof onMarkRead === 'function') onMarkRead(id);
    else storeMarkRead(id);
    setList((prev) => prev.map((n) => n && n.id === id ? { ...n, read: true } : n));
  }

  function handleMarkAll() {
    if (typeof onMarkAllRead === 'function') onMarkAllRead();
    else storeMarkAll();
    setList((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const titleText     = t('notifications.feed.title')     || 'Notifications';
  const markAllText   = t('notifications.feed.mark_all')  || 'Mark all as read';
  const closeText     = t('common.close')                 || 'Close';
  const emptyText     = t(emptyKey)                       || 'You have no notifications yet.';

  const priorityColor = (p) => {
    if (p === 'high')   return { fg: '#b71c1c', bg: 'rgba(239,68,68,0.12)' };
    if (p === 'low')    return { fg: '#78909c', bg: 'rgba(100,116,139,0.12)' };
    return                        { fg: '#1565c0', bg: 'rgba(59,130,246,0.12)' };
  };

  return (
    <section style={S.panel} data-testid="notification-center">
      <header style={S.header}>
        <h2 style={S.title}>{titleText}</h2>
        <div style={S.headerCtas}>
          {hasUnread && (
            <button type="button" onClick={handleMarkAll}
                    style={S.ghostBtn}
                    data-testid="notifications-mark-all">
              {markAllText}
            </button>
          )}
          {typeof onClose === 'function' && (
            <button type="button" onClick={onClose}
                    style={S.ghostBtn}>
              {closeText}
            </button>
          )}
        </div>
      </header>

      {list.length === 0 && (
        <p style={S.empty} data-testid="notifications-empty">{emptyText}</p>
      )}

      <ul style={S.list}>
        {list.map((n) => {
          if (!n) return null;
          const text = resolveMessage(t, n);
          const age  = formatRelativeTime(n.createdAt);
          const ageLabel = t(age.key, age.vars) || age.fallback;
          const col = priorityColor(n.priority);
          return (
            <li key={n.id}
                style={{ ...S.row, ...(n.read ? S.rowRead : null) }}
                data-testid={`notification-${n.id}`}
                data-priority={n.priority}
                data-read={n.read ? 'true' : 'false'}>
              <div style={S.rowHeader}>
                <span style={{ ...S.priorityChip, color: col.fg, background: col.bg }}>
                  {(t(`notifications.priority.${n.priority}`)
                    || n.priority || '').toUpperCase()}
                </span>
                <span style={S.age}>{ageLabel}</span>
              </div>
              <p style={S.msg}>{text}</p>
              {!n.read && (
                <button type="button"
                        onClick={() => handleMarkRead(n.id)}
                        style={S.markBtn}
                        data-testid={`notification-mark-${n.id}`}>
                  {t('notifications.feed.mark_read') || 'Mark as read'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const S = {
  panel: {
    padding: '1rem 1.25rem',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    color: '#EAF2FF',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '0.5rem',
  },
  title: { margin: 0, fontSize: '1.0625rem', fontWeight: 700 },
  headerCtas: { display: 'flex', gap: '0.5rem' },
  ghostBtn: {
    padding: '0.375rem 0.625rem', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
    color: '#9FB3C8', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
  },
  empty: { margin: 0, color: '#9FB3C8', fontSize: '0.875rem' },
  list: { listStyle: 'none', margin: 0, padding: 0,
          display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  row: {
    padding: '0.625rem 0.75rem',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
  },
  rowRead: { opacity: 0.65 },
  rowHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '0.5rem',
  },
  priorityChip: {
    padding: '0.125rem 0.5rem', borderRadius: 999,
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  age: { fontSize: 11, color: '#6F8299', fontWeight: 500 },
  msg: { margin: 0, fontSize: '0.9375rem', color: '#EAF2FF', lineHeight: 1.4 },
  markBtn: {
    alignSelf: 'flex-start',
    padding: '0.25rem 0.625rem', borderRadius: 8,
    border: '1px solid rgba(34,197,94,0.35)',
    background: 'rgba(34,197,94,0.08)',
    color: '#86EFAC', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
};
