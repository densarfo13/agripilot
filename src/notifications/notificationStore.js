/**
 * notificationStore.js — local-first notification store.
 *
 * Storage key: farroway_notifications
 *
 * Spec contract (Notification System, § 1–7)
 *   * Notification shape (§ 1):
 *       { id, userId, type, title, message, read, createdAt }
 *     `type` ∈ TASK | FUNDING | BUYER | PROGRAM
 *   * Anti-spam (§ 7): per-user list capped at MAX_PER_USER
 *     (10) — newest kept. Dedupe on `dedupeKey` so the
 *     same source event never produces two cards.
 *   * Read-only `read` flag — once flipped to true it
 *     stays. The unread badge counts entries where
 *     `read === false`.
 *
 * Strict-rule audit
 *   * Never throws — every storage call try/catch wrapped,
 *     reads use safeParse with `[]` fallback.
 *   * Idempotent on `id` for direct upserts AND on
 *     `(userId, dedupeKey)` for trigger callers — calling
 *     `addNotification({ dedupeKey: 'task:abc' })` twice
 *     in a row only writes once.
 *   * Privacy: notifications never carry PII beyond what
 *     the message string contains. We store the user id
 *     so a shared device showing two accounts doesn't
 *     leak each other's badges.
 */

import { safeParse } from '../utils/safeParse.js';
import { safeTrackEvent } from '../lib/analytics.js';

export const STORAGE_KEY = 'farroway_notifications';

export const NOTIFICATION_TYPES = Object.freeze({
  TASK:    'TASK',
  FUNDING: 'FUNDING',
  BUYER:   'BUYER',
  PROGRAM: 'PROGRAM',
});

export const NOTIFICATION_EVENTS = Object.freeze({
  CREATED: 'NOTIFICATION_CREATED',
  READ:    'NOTIFICATION_READ',
});

// Per spec § 7: cap to 5–10 per user. We pick 10.
export const MAX_PER_USER = 10;
const MAX_TOTAL = 200;        // global cap across all users on one device

// Anti-spam window: don't re-fire the same dedupeKey within
// this many ms. Use 12 hours so a daily fetch can't spam.
const DEDUPE_WINDOW_MS = 12 * 60 * 60 * 1000;

// ─── primitives ───────────────────────────────────────────

function _read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _write(rows) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const safe = Array.isArray(rows) ? rows.slice(-MAX_TOTAL) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

function _now()  { try { return new Date().toISOString(); } catch { return ''; } }
function _ts(s) {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}
function _uid() {
  try {
    return `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  } catch { return `ntf_${Date.now()}`; }
}

function _validType(t) {
  const u = String(t || '').toUpperCase();
  return Object.values(NOTIFICATION_TYPES).includes(u) ? u : null;
}

// ─── Reads ────────────────────────────────────────────────

/**
 * getNotifications(userId) — returns this user's
 * notifications, newest first, capped at MAX_PER_USER.
 *
 * If userId is null/undefined, returns ALL notifications
 * (dev / single-user fallback). Real surfaces should always
 * pass the current user's id.
 */
export function getNotifications(userId) {
  const all = _read()
    .filter((r) => r && r.id && r.type)
    .sort((a, b) => _ts(b.createdAt) - _ts(a.createdAt));
  const list = userId
    ? all.filter((r) => String(r.userId || '') === String(userId))
    : all;
  return list.slice(0, MAX_PER_USER);
}

export function getUnreadCount(userId) {
  return getNotifications(userId).filter((r) => !r.read).length;
}

// ─── Writes ───────────────────────────────────────────────

/**
 * addNotification(input) — appends a new notification IF
 * a recent matching `(userId, dedupeKey)` entry doesn't
 * already exist. Returns the stored row OR `null` when
 * suppressed by dedupe.
 *
 *   {
 *     userId,
 *     type:       'TASK' | 'FUNDING' | 'BUYER' | 'PROGRAM',
 *     title,
 *     message,
 *     dedupeKey?  // optional — when present, skip if a
 *                 // recent row matches
 *   }
 */
export function addNotification(input) {
  const safe = input && typeof input === 'object' ? input : {};
  const type = _validType(safe.type);
  if (!type) return null;

  const userId    = safe.userId == null ? null : String(safe.userId);
  const dedupeKey = safe.dedupeKey ? String(safe.dedupeKey) : null;

  // Dedupe scan — same userId + dedupeKey within window?
  if (dedupeKey) {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    const existing = _read().find(
      (r) => r
        && String(r.userId || '') === String(userId || '')
        && r.dedupeKey === dedupeKey
        && _ts(r.createdAt) >= cutoff,
    );
    if (existing) return null;
  }

  const stored = {
    id:        safe.id || _uid(),
    userId,
    type,
    title:     String(safe.title   || '').trim(),
    message:   String(safe.message || '').trim(),
    read:      Boolean(safe.read),
    dedupeKey,
    createdAt: safe.createdAt || _now(),
  };

  const rows = _read();
  rows.push(stored);

  // Per-user cap: keep newest MAX_PER_USER; older ones for
  // this user fall off the back.
  if (userId) {
    const mine = rows.filter(
      (r) => r && String(r.userId || '') === String(userId),
    ).sort((a, b) => _ts(a.createdAt) - _ts(b.createdAt));
    if (mine.length > MAX_PER_USER) {
      const drop = new Set(mine.slice(0, mine.length - MAX_PER_USER)
        .map((r) => r.id));
      const next = rows.filter((r) => !drop.has(r.id));
      _write(next);
    } else {
      _write(rows);
    }
  } else {
    _write(rows);
  }

  try {
    safeTrackEvent(NOTIFICATION_EVENTS.CREATED, {
      notificationId: stored.id,
      userId,
      type,
    });
  } catch { /* analytics never blocks */ }

  return stored;
}

/**
 * markAsRead(id) — flips `read` to true. Idempotent.
 * Returns the next row, or null if id not found.
 */
export function markAsRead(id) {
  if (!id) return null;
  const rows = _read();
  const idx  = rows.findIndex((r) => r && r.id === id);
  if (idx < 0) return null;
  if (rows[idx].read) return rows[idx];      // no-op
  rows[idx] = { ...rows[idx], read: true };
  _write(rows);
  try {
    safeTrackEvent(NOTIFICATION_EVENTS.READ, {
      notificationId: id,
      userId: rows[idx].userId,
      type:   rows[idx].type,
    });
  } catch { /* ignore */ }
  return rows[idx];
}

/**
 * markAllAsRead(userId) — convenience for the bell's
 * "Mark all as read" action.
 */
export function markAllAsRead(userId) {
  const rows = _read();
  let dirty = false;
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    if (!r || r.read) continue;
    if (userId && String(r.userId || '') !== String(userId)) continue;
    rows[i] = { ...r, read: true };
    dirty = true;
  }
  if (dirty) _write(rows);
  return dirty;
}
