/**
 * NotificationBell — bell icon + unread badge + portal-rendered panel.
 *
 *   <NotificationBell userId={user.sub} />
 *
 * Production-fix (notification dropdown polish):
 *   • Panel renders via ReactDOM.createPortal(document.body) so no
 *     parent overflow/hero/card container can clip it.
 *   • Mobile (≤640 px): fixed position anchored under the bell,
 *     full-width with 16 px gutters, max-height min(70vh, 520px),
 *     respects env(safe-area-inset-top).
 *   • Desktop: fixed position anchored to the bell's bounding rect.
 *   • Every notification.title + notification.message run through
 *     resolveNotificationTemplate() so `{crop}` / `{plant}` /
 *     `{farm}` / `{task}` / `{days}` never leak to the UI.
 *   • All notifications mapped (capped at 20 latest), unread first
 *     then newest first. "View all" footer link to /notifications.
 *   • Mark all read updates UI immediately + persists via store.
 *   • Empty-state copy localized.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import {
  getNotifications, getUnreadCount, markAsRead, markAllAsRead,
  NOTIFICATION_TYPES,
} from '../notifications/notificationStore.js';
import { tSafe } from '../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import { resolve as resolveTemplate, isFullyResolved }
  from '../runtime/templates/NotificationTemplateResolver';

const C = FARROWAY_BRAND.colors;

const TYPE_META = {
  TASK:    { icon: '📋', route: '/dashboard'      },
  FUNDING: { icon: '🎯', route: '/opportunities'  },
  BUYER:   { icon: '🛒', route: '/marketplace'    },
  PROGRAM: { icon: '📨', route: '/dashboard'      },
};

const MAX_RENDERED = 20;

/** Best-effort context for template resolution. Reads the canonical
 *  Command Center via __commandCenterHealth — never throws. */
function _resolutionContext() {
  try {
    if (typeof window === 'undefined') return {};
    const fn = window.__commandCenterHealth;
    const env = typeof fn === 'function' ? fn() : null;
    const s = env && env.state ? env.state : null;
    if (!s) return {};
    return {
      crop: typeof s.crop === 'string' ? s.crop : '',
      plant: typeof s.crop === 'string' ? s.crop : '',
      farm: '',
      task: (s.todayAction && typeof s.todayAction.title === 'string')
        ? s.todayAction.title : '',
      days: (typeof s.daysToHarvest === 'number') ? s.daysToHarvest : '',
      stage: typeof s.cropStage === 'string' ? s.cropStage : '',
    };
  } catch { return {}; }
}

/** Resolve title + message + clamp to safe text. Always returns
 *  fully-resolved strings (never leaks `{crop}` etc). */
function _resolveNotification(n, ctx) {
  const titleRes = resolveTemplate(typeof n.title === 'string' ? n.title : '', ctx);
  const bodyRes = resolveTemplate(typeof n.message === 'string' ? n.message : '', ctx);
  const safeTitle = isFullyResolved(titleRes.text) ? titleRes.text
    : titleRes.text.replace(/\{[a-zA-Z0-9_]+\}/g, '');
  const safeMessage = isFullyResolved(bodyRes.text) ? bodyRes.text
    : bodyRes.text.replace(/\{[a-zA-Z0-9_]+\}/g, '');
  return { ...n, title: safeTitle, message: safeMessage };
}

/** Sort: unread first, then newest first by createdAt. */
function _sortAndLimit(list) {
  const safe = Array.isArray(list) ? list.slice() : [];
  safe.sort((a, b) => {
    const aUnread = a && !a.read ? 1 : 0;
    const bUnread = b && !b.read ? 1 : 0;
    if (aUnread !== bUnread) return bUnread - aUnread;
    const aT = String((a && a.createdAt) || '');
    const bT = String((b && b.createdAt) || '');
    return bT.localeCompare(aT);
  });
  return safe.slice(0, MAX_RENDERED);
}

export default function NotificationBell({
  userId,
  testId = 'notification-bell',
  ariaLabel,
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

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

  const ctx = useMemo(() => _resolutionContext(), [open, tick]);
  const rawList = useMemo(() => getNotifications(userId), [userId, tick]);
  const list = useMemo(
    () => _sortAndLimit(rawList).map((n) => _resolveNotification(n, ctx)),
    [rawList, ctx],
  );
  const unread = useMemo(() => getUnreadCount(userId), [userId, tick]);

  // Anchor position for the portal.
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const [anchor, setAnchor] = useState({ top: 64, right: 16, left: 16 });

  const _reanchor = React.useCallback(() => {
    if (!btnRef.current || typeof window === 'undefined') return;
    const r = btnRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth <= 640;
    if (isMobile) {
      // Fixed under bell with 16 px gutters left/right; respect
      // safe-area-inset-top so iOS notch doesn't collide.
      const top = Math.max(r.bottom + 8, 56);
      setAnchor({ top, right: 16, left: 16 });
    } else {
      const top = r.bottom + 8;
      const right = Math.max(window.innerWidth - r.right, 16);
      setAnchor({ top, right, left: null });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    _reanchor();
    const handle = () => _reanchor();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [open, _reanchor]);

  // Close on outside click + Escape. We must check BOTH the bell
  // button AND the portal-rendered panel because they are no longer
  // in the same DOM subtree.
  useEffect(() => {
    if (!open) return undefined;
    function onClick(e) {
      const t = e.target;
      if (btnRef.current && btnRef.current.contains(t)) return;
      if (panelRef.current && panelRef.current.contains(t)) return;
      setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('touchstart', onClick, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('touchstart', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleOpenItem(item) {
    if (item.id) {
      try { markAsRead(item.id); } catch { /* swallow */ }
    }
    setOpen(false);
    refresh();
    // Sprint #189 — pilot analytics: notification_opened.
    // Fire-and-forget; failures swallow.
    import('../runtime/analytics/PilotAnalyticsRuntime')
      .then(({ trackPilotEvent }) => trackPilotEvent({
        eventType: 'notification_opened',
        metadata: { notificationType: item.type || 'unknown' },
      }))
      .catch(() => { /* swallow */ });
    const route = (TYPE_META[item.type] && TYPE_META[item.type].route)
                  || '/dashboard';
    navigate(route);
  }

  function handleMarkAll() {
    try { markAllAsRead(userId); } catch { /* swallow */ }
    refresh();
  }

  const panelStyle = {
    ...S.popover,
    top: anchor.top,
    right: anchor.right !== null ? anchor.right : undefined,
    left: anchor.left !== null ? anchor.left : undefined,
  };

  const panel = open && typeof document !== 'undefined' ? ReactDOM.createPortal(
    <div
      ref={panelRef}
      style={panelStyle}
      role="menu"
      data-testid={`${testId}-popover`}
      data-portal="notification-panel"
      data-not-clipped="true">
      <header style={S.head}>
        <span style={S.title}>
          {tSafe('notifications.title', 'Notifications')}
        </span>
        {list.length > 0 && unread > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            style={S.markAll}
            data-testid={`${testId}-mark-all`}>
            {tSafe('notifications.markAll', 'Mark all read')}
          </button>
        )}
      </header>

      {list.length === 0 ? (
        <div style={S.empty} data-testid={`${testId}-empty`}>
          <span style={S.emptyIcon} aria-hidden="true">📭</span>
          <p style={S.emptyText}>
            {tSafe('notifications.empty.title', 'No notifications yet.')}
          </p>
          <p style={S.emptySub}>
            {tSafe('notifications.empty.sub',
              'Your reminders will appear here.')}
          </p>
        </div>
      ) : (
        <ul style={S.list} data-testid={`${testId}-list`}>
          {list.map((n) => {
            const meta = TYPE_META[n.type] || { icon: '•' };
            return (
              <li
                key={n.id}
                style={{
                  ...S.row,
                  ...(n.read ? S.rowRead : S.rowUnread),
                }}
                onClick={() => handleOpenItem(n)}
                data-testid={`${testId}-row-${n.id}`}
                data-unread={n.read ? 'false' : 'true'}>
                <span style={S.rowIcon} aria-hidden="true">
                  {meta.icon}
                </span>
                <div style={S.rowBody}>
                  <div style={S.rowTitle}>{n.title}</div>
                  {n.message ? (
                    <div style={S.rowMsg}>{n.message}</div>
                  ) : null}
                  <div style={S.rowTime}>
                    {String(n.createdAt || '').replace('T', ' ').slice(0, 16)}
                  </div>
                </div>
                {!n.read ? <span style={S.unreadDot} aria-hidden="true" /> : null}
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
          {tSafe('notifications.viewAll', 'View all notifications')} →
        </Link>
      </footer>
    </div>,
    document.body,
  ) : null;

  return (
    <span style={S.wrap} data-testid={testId}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel || tSafe('notifications.aria',
          'Open notifications')}
        aria-haspopup="true"
        aria-expanded={open}
        style={S.btn}
        data-testid={`${testId}-toggle`}>
        <span aria-hidden="true" style={S.bellIcon}>🔔</span>
        {unread > 0 && (
          <span style={S.badge} aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {panel}
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

  // Panel — fixed positioning, attached to document.body via portal.
  // Mobile: full-width (16px gutters), constrained max-height with
  // scroll. Desktop: 22rem wide, anchored to bell's right edge.
  popover: {
    position: 'fixed',
    width: 'auto',
    maxWidth: '22rem',
    minWidth: '17rem',
    maxHeight: 'min(70vh, 520px)',
    background: C.darkPanel,
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '14px',
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    color: C.white,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    // Above bottom nav (z=100), modal layer (z=900), bell button.
    zIndex: 1100,
    // iOS safe-area top inset honored when anchor.top is small.
    paddingTop: 'env(safe-area-inset-top, 0px)',
  },
  head: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 0.95rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  title: { fontWeight: 800, fontSize: '0.9375rem' },
  markAll: {
    background: 'transparent', border: 'none',
    color: C.lightGreen, cursor: 'pointer',
    fontSize: '0.8125rem', fontWeight: 700,
    padding: 0,
  },
  // The scrollable list region — its max-height lets the panel grow
  // up to the panel cap, then scroll inside.
  list: {
    listStyle: 'none', padding: 0, margin: 0,
    overflowY: 'auto',
    flex: '1 1 auto',
    minHeight: 0,
    WebkitOverflowScrolling: 'touch',
  },
  row: {
    display: 'flex', gap: '0.6rem',
    padding: '0.7rem 0.9rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer',
    alignItems: 'flex-start',
  },
  rowUnread: { background: 'rgba(200,148,77,0.06)' },
  rowRead:   { background: 'transparent' },
  rowIcon:   { fontSize: '1.125rem', lineHeight: 1, flexShrink: 0 },
  rowBody:   {
    flex: 1, minWidth: 0,
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  rowTitle:  {
    color: C.white, fontWeight: 700,
    fontSize: '0.9rem', lineHeight: 1.35,
    overflow: 'hidden', textOverflow: 'ellipsis',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  },
  rowMsg:    {
    color: 'rgba(255,255,255,0.78)',
    fontSize: '0.8125rem', lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis',
    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  },
  rowTime:   {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.72rem', marginTop: 2,
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: C.lightGreen,
    marginTop: 6, flexShrink: 0,
  },

  empty: {
    padding: '1.5rem 1rem',
    textAlign: 'center', color: 'rgba(255,255,255,0.7)',
    display: 'flex', flexDirection: 'column',
    gap: 4, alignItems: 'center',
  },
  emptyIcon: { fontSize: '1.6rem' },
  emptyText: { margin: 0, fontSize: '0.95rem', fontWeight: 700 },
  emptySub: { margin: 0, fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.55)' },

  foot: {
    padding: '0.7rem 0.95rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center',
    flexShrink: 0,
  },
  footLink: {
    color: C.lightGreen, textDecoration: 'none',
    fontSize: '0.8125rem', fontWeight: 700,
  },
};
