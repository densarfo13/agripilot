/**
 * NotificationBadge — compact "top notification" card for the
 * dashboard. Shows the highest-priority unread notification with a
 * quick "Mark as read" button. Hidden when there's nothing unread.
 *
 *   <NotificationBadge
 *     notification={...}             // optional override; else reads top from store
 *     onMarkRead={(id) => ...}       // optional override; else calls store
 *     onViewAll={() => ...}          // routes to NotificationCenter
 *   />
 */

import { useAppSettings } from '../context/AppSettingsContext.jsx';
import {
  getTopNotification, markAsRead as storeMarkRead,
} from '../lib/notifications/notificationStore.js';

function resolveMessage(t, n) {
  if (!n) return '';
  if (!n.messageKey) return '';
  const resolved = t(n.messageKey, n.messageVars || {});
  if (resolved && resolved !== n.messageKey) return resolved;
  const key = n.messageKey.split('.').pop();
  if (key === 'daily_pending')      return `You have ${n.messageVars?.count || 0} tasks today.`;
  if (key === 'missed_yesterday')   return "You missed yesterday's tasks — let's get back on track.";
  if (key === 'harvest_nearing')    return 'Harvest season is approaching.';
  if (key === 'stage_entered')      return 'Your farm is entering a new stage.';
  if (key === 'inactivity')         return 'It\u2019s been a few days — check in on your farm.';
  return '';
}

export default function NotificationBadge({
  notification,
  onMarkRead,
  onViewAll,
}) {
  const { t } = useAppSettings();
  const n = notification !== undefined ? notification : getTopNotification();
  if (!n) return null;
  const msg = resolveMessage(t, n);
  if (!msg) return null;

  function handleMark() {
    if (typeof onMarkRead === 'function') onMarkRead(n.id);
    else storeMarkRead(n.id);
  }

  const viewAll = t('notifications.feed.view_all') || 'View all';
  const markRead = t('notifications.feed.mark_read') || 'Mark as read';

  const priorityCol = n.priority === 'high'   ? { fg: '#b71c1c', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.28)' }
                    : n.priority === 'low'    ? { fg: '#78909c', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.24)' }
                    :                             { fg: '#1565c0', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.28)' };

  return (
    <div style={{
      ...S.wrap,
      background: priorityCol.bg,
      border: `1px solid ${priorityCol.border}`,
      color: priorityCol.fg,
    }} data-testid="notification-badge" data-priority={n.priority}>
      <div style={S.row}>
        <span style={S.pin} aria-hidden="true">{n.priority === 'high' ? '\u26A0\uFE0F' : '\u{1F514}'}</span>
        <span style={S.msg}>{msg}</span>
      </div>
      <div style={S.ctas}>
        <button type="button" onClick={handleMark} style={S.btnPrimary}
                data-testid="notification-badge-mark">
          {markRead}
        </button>
        {typeof onViewAll === 'function' && (
          <button type="button" onClick={onViewAll} style={S.btnGhost}>
            {viewAll}
          </button>
        )}
      </div>
    </div>
  );
}

const S = {
  wrap: {
    padding: '0.625rem 0.875rem', borderRadius: 12,
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    fontSize: '0.875rem',
  },
  row: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  pin: { fontSize: '1rem', lineHeight: 1 },
  msg: { lineHeight: 1.35, color: '#EAF2FF' },
  ctas: { display: 'flex', gap: '0.5rem' },
  btnPrimary: {
    padding: '0.25rem 0.625rem', borderRadius: 8,
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  btnGhost: {
    padding: '0.25rem 0.625rem', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.18)', background: 'transparent',
    color: '#EAF2FF', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
};
