/**
 * NotificationDeduper.ts — sprint #212 §5.
 *
 * Collapses duplicate notifications before render. Two notifications
 * collide when they share (titleKey, type, relatedEntityId,
 * createdDay). The NEWEST unread is kept; collisions collapse into a
 * count so "Today on your farm" ×4 becomes one row with count 4 (the
 * UI can render "4 farm reminders today").
 *
 * Pure. Never throws. Pins window.__notificationDedupHealth().
 */

export const NOTIFICATION_DEDUPER_VERSION = 'notification-deduper-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function _dayOf(n: any): string {
  const raw = _str(n && (n.createdDay || n.createdAt || n.created_at || n.at || n.ts));
  return raw ? raw.slice(0, 10) : '';
}
function _dedupKey(n: any): string {
  return [
    _str(n && (n.titleKey || n.title)),
    _str(n && n.type),
    _str(n && (n.relatedEntityId || n.entityId || n.related_id)),
    _dayOf(n),
  ].join('|');
}
function _isUnread(n: any): boolean {
  return !(n && (n.read === true || n.isRead === true || n.seen === true));
}
function _ts(n: any): string {
  return _str(n && (n.createdAt || n.created_at || n.at || n.ts || n.createdDay));
}

export function dedupeNotifications<T = any>(items: ReadonlyArray<T> | null | undefined): {
  notifications: Array<T & { duplicateCount?: number }>; collapsed: number;
} {
  return _safe(() => {
    const list = Array.isArray(items) ? items : [];
    const byKey = new Map<string, { item: any; count: number; order: number }>();
    let collapsed = 0;
    for (let i = 0; i < list.length; i++) {
      const n: any = list[i];
      const k = _dedupKey(n);
      const ex = byKey.get(k);
      if (!ex) {
        byKey.set(k, { item: n, count: 1, order: i });
      } else {
        collapsed++;
        ex.count++;
        // Keep the newest; prefer unread on ties.
        const keepNew = (_ts(n) > _ts(ex.item)) || (_isUnread(n) && !_isUnread(ex.item));
        if (keepNew) ex.item = n;
      }
    }
    const out = Array.from(byKey.values())
      .sort((a, b) => a.order - b.order)
      .map((e) => (e.count > 1 ? { ...e.item, duplicateCount: e.count } : e.item));
    return { notifications: out, collapsed };
  }, { notifications: Array.isArray(items) ? (items as any[]).slice() : [], collapsed: 0 });
}

export function buildNotificationDedupHealth(): Readonly<{
  ok: boolean; runtimeVersion: string; notificationDedupReady: true;
  dedupKeys: ReadonlyArray<string>;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: NOTIFICATION_DEDUPER_VERSION,
    notificationDedupReady: true as const,
    dedupKeys: Object.freeze(['titleKey', 'type', 'relatedEntityId', 'createdDay']),
  });
}

let _installed = false;
export function installNotificationDedupHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__notificationDedupHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildNotificationDedupHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  dedupeNotifications, buildNotificationDedupHealth, installNotificationDedupHealthGlobal,
});
export default dedupeNotifications;
