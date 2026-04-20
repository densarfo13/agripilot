/**
 * notificationStore.js — local append-only notification feed.
 *
 *   localStorage["farroway.notifications"] = [ Notification, ... ]
 *
 * Shape:
 *   Notification = {
 *     id:         string       // stable; rule_id + day key for dedup
 *     type:       string       // 'daily' | 'missed' | 'stage'
 *                               //          | 'harvest' | 'inactivity'
 *                               //          | string (extensible)
 *     priority:   'high' | 'medium' | 'low'
 *     messageKey: string       // i18n key
 *     messageVars: object|null
 *     channel:    'in_app' | 'push' | 'sms'
 *     read:       boolean
 *     createdAt:  number       // epoch ms
 *     readAt:     number|null
 *     data:       object|null  // payload (taskId, stage, etc.)
 *   }
 *
 * All reads/writes wrapped in try/catch — storage failures never
 * break the Today page.
 */

const STORAGE_KEY = 'farroway.notifications';
const MAX_ENTRIES = 100;     // cap so storage doesn't grow forever

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readRaw() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeRaw(list) {
  if (!hasStorage()) return false;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); return true; }
  catch { return false; }
}

/**
 * addNotification — append when the id is new. Returns the full
 * record (existing one if already present). Caps the store at
 * MAX_ENTRIES by dropping the oldest read ones first.
 */
export function addNotification(notif) {
  if (!notif || typeof notif !== 'object' || !notif.id) return null;
  const list = readRaw();
  const existing = list.find((n) => n && n.id === notif.id);
  if (existing) return existing;

  const ts = Number.isFinite(notif.createdAt) ? notif.createdAt : Date.now();
  const row = {
    id:           String(notif.id),
    type:         notif.type || 'custom',
    priority:     notif.priority === 'high' || notif.priority === 'low'
                  ? notif.priority : 'medium',
    messageKey:   notif.messageKey || null,
    messageVars:  notif.messageVars && typeof notif.messageVars === 'object'
                  ? notif.messageVars : null,
    channel:      notif.channel === 'push' || notif.channel === 'sms'
                  ? notif.channel : 'in_app',
    read:         !!notif.read,
    createdAt:    ts,
    readAt:       notif.readAt || null,
    data:         notif.data && typeof notif.data === 'object' ? notif.data : null,
  };
  list.push(row);

  // Cap storage: drop oldest READ first, then oldest overall.
  while (list.length > MAX_ENTRIES) {
    const idx = list.findIndex((n) => n && n.read);
    if (idx >= 0) list.splice(idx, 1);
    else list.shift();
  }
  writeRaw(list);
  return row;
}

/**
 * listNotifications — sorted priority desc, then createdAt desc.
 * Options:
 *   unreadOnly?: boolean
 *   type?:       string (filter)
 *   limit?:      number
 */
export function listNotifications({ unreadOnly = false, type, limit } = {}) {
  const list = readRaw();
  const filtered = list.filter((n) => {
    if (!n) return false;
    if (unreadOnly && n.read) return false;
    if (type && n.type !== type) return false;
    return true;
  });
  const pri = { high: 0, medium: 1, low: 2 };
  filtered.sort((a, b) => {
    const pa = pri[a.priority] ?? 1;
    const pb = pri[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return Number.isFinite(limit) && limit >= 0
    ? filtered.slice(0, limit)
    : filtered;
}

export function getUnreadCount() {
  return readRaw().filter((n) => n && !n.read).length;
}

/** Returns the top-priority unread notification, or null. */
export function getTopNotification() {
  const [top] = listNotifications({ unreadOnly: true, limit: 1 });
  return top || null;
}

export function markAsRead(id, { now } = {}) {
  if (!id) return false;
  const list = readRaw();
  const target = list.find((n) => n && n.id === id);
  if (!target) return false;
  if (target.read) return true;
  target.read = true;
  target.readAt = Number.isFinite(now) ? now : Date.now();
  writeRaw(list);
  return true;
}

export function markAllAsRead({ now } = {}) {
  const list = readRaw();
  let changed = false;
  const when = Number.isFinite(now) ? now : Date.now();
  for (const n of list) {
    if (n && !n.read) { n.read = true; n.readAt = when; changed = true; }
  }
  if (changed) writeRaw(list);
  return changed;
}

export function clearNotifications() {
  if (!hasStorage()) return false;
  try { window.localStorage.removeItem(STORAGE_KEY); return true; }
  catch { return false; }
}

export const _keys = Object.freeze({ STORAGE_KEY, MAX_ENTRIES });
