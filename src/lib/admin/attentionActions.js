/**
 * attentionActions.js — quick actions for the admin "Needs attention"
 * panel + an action log for the learning loop.
 *
 * Three action primitives:
 *   • sendSmsReminder({ phone, message, …meta })
 *       POSTs to /api/v2/messages/sms if available (server wraps
 *       Twilio); otherwise records the attempt and returns
 *       { delivered: false, channel: 'manual_share_ready', reason }
 *       so the admin can copy + paste the message if delivery is off.
 *
 *   • assignFarmerToOfficer({ farmId, officerId, adminId? })
 *       Writes an `farm_assigned_to_officer` entry to the event log
 *       and logs an `assign_to_officer` admin action.
 *
 *   • markAttentionReviewed({ targetId, adminId?, note? })
 *       Mark the row reviewed; persists a `review` action so the
 *       tile can hide until new activity resurfaces it.
 *
 * Every action also writes to the admin-action log so the learning
 * loop (future) can correlate "what admins did" with "what
 * happened next". No actual ML here — just clean structured rows.
 *
 *   getAdminActionLog({ limit? }) — recent actions newest-first
 *   isReviewed(targetId)          — has this row been reviewed
 *                                   since its last update?
 *
 * All writes route through farrowayLocal so storage stays in one
 * place. No network dependency for the log itself.
 */

import { logEvent } from '../events/eventLogger.js';

const LOG_KEY = 'farroway.adminActions';
const MAX_LOG_ROWS = 500;

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readLog() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeLog(list) {
  if (!hasStorage()) return false;
  try {
    // Cap the log so a long-running demo doesn't balloon localStorage.
    const capped = list.length > MAX_LOG_ROWS
      ? list.slice(list.length - MAX_LOG_ROWS)
      : list;
    window.localStorage.setItem(LOG_KEY, JSON.stringify(capped));
    return true;
  } catch { return false; }
}

function genId(prefix = 'act') {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch { /* fallthrough */ }
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/**
 * logAdminAction — single source of truth for writing to the log.
 * Actions are simple rows the learning loop can later join against
 * outcomes.
 *
 *   type:      'send_sms' | 'assign_to_officer' | 'review' | 'bulk_*'
 *   targetId:  farmId / farmerId / issueId the action touched
 *   actor:     { role, id }   — the admin who performed it
 *   metadata:  free-form { phone, message, officerId, note, ... }
 */
export function logAdminAction({
  type, targetId = null, actor = null, metadata = null, now = null,
} = {}) {
  if (!type || typeof type !== 'string') return null;
  const entry = {
    id:        genId('act'),
    type:      String(type),
    targetId:  targetId ? String(targetId) : null,
    actorRole: actor && actor.role ? String(actor.role) : 'admin',
    actorId:   actor && actor.id   ? String(actor.id)   : null,
    metadata:  metadata && typeof metadata === 'object' ? { ...metadata } : null,
    timestamp: Number.isFinite(now) ? now : Date.now(),
  };
  const list = readLog();
  list.push(entry);
  writeLog(list);
  // Mirror into the farm-event log when the action is farm-scoped
  // so existing readers (NGO insights / impact reporting) can see it.
  if (entry.targetId) {
    try {
      logEvent({
        farmId:    entry.targetId,
        type:      `admin.${entry.type}`,
        payload:   entry.metadata || null,
        timestamp: entry.timestamp,
      });
    } catch { /* non-fatal */ }
  }
  return entry;
}

export function getAdminActionLog({ limit = 100, type = null, targetId = null } = {}) {
  let list = readLog();
  if (type) list = list.filter((r) => r && r.type === type);
  if (targetId) list = list.filter((r) => r && String(r.targetId || '') === String(targetId));
  list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  if (Number.isFinite(limit) && limit > 0) list = list.slice(0, limit);
  return list.map((r) => Object.freeze({ ...r }));
}

/**
 * isReviewed — has the caller marked this target reviewed since
 * `sinceTs` (e.g. the issue's updatedAt)? Defaults to "any time".
 */
export function isReviewed(targetId, { sinceTs = 0 } = {}) {
  if (!targetId) return false;
  const list = readLog();
  for (const row of list) {
    if (!row || row.type !== 'review') continue;
    if (String(row.targetId || '') !== String(targetId)) continue;
    if ((row.timestamp || 0) >= sinceTs) return true;
  }
  return false;
}

// ─── Action primitives ───────────────────────────────────────────

/**
 * sendSmsReminder — POST to /api/v2/messages/sms when available.
 * When the endpoint is missing (404/CORS) or no phone, returns
 * { delivered: false, channel: 'manual_share_ready', reason } so the
 * admin can copy/paste the message instead. Always logs the attempt.
 */
export async function sendSmsReminder({
  phone, message, targetId = null, actor = null, fetchJson = null,
} = {}) {
  const cleanPhone = phone ? String(phone).trim() : '';
  const body = message ? String(message).trim() : '';
  if (!cleanPhone || !body) {
    logAdminAction({
      type: 'send_sms', targetId, actor,
      metadata: { phone: cleanPhone, message: body, delivered: false, reason: 'missing_fields' },
    });
    return { delivered: false, channel: 'link', reason: 'missing_fields' };
  }

  let delivered = false;
  let reason    = null;
  let channel   = 'phone';

  const doFetch = fetchJson || (async (url, opts) => {
    if (typeof fetch !== 'function') return null;
    try {
      const r = await fetch(url, opts);
      if (!r || !r.ok) return { ok: false, status: r ? r.status : 0 };
      const json = await r.json().catch(() => ({}));
      return { ok: true, ...json };
    } catch (err) {
      return { ok: false, status: 0, error: err && err.message };
    }
  });

  try {
    const res = await doFetch('/api/v2/messages/sms', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone, message: body }),
    });
    if (res && res.ok === true) {
      delivered = true;
    } else {
      reason = (res && (res.error || `http_${res.status || 'err'}`)) || 'unknown';
      channel = 'manual_share_ready';
    }
  } catch (err) {
    reason = err && err.message ? err.message : 'network';
    channel = 'manual_share_ready';
  }

  logAdminAction({
    type: 'send_sms', targetId, actor,
    metadata: { phone: cleanPhone, message: body, delivered, channel, reason },
  });
  return { delivered, channel, reason };
}

/**
 * assignFarmerToOfficer — lightweight client-side assignment. Writes
 * to the admin log + the farm event log. The backend (if enabled)
 * can read both to hydrate server-side state.
 */
export function assignFarmerToOfficer({
  farmId, officerId, adminId = null, note = null, now = null,
} = {}) {
  if (!farmId || !officerId) return null;
  return logAdminAction({
    type:      'assign_to_officer',
    targetId:  farmId,
    actor:     { role: 'admin', id: adminId },
    metadata:  { officerId: String(officerId), note: note || null },
    now,
  });
}

/**
 * markAttentionReviewed — mark the row handled for this cycle. The
 * tile can re-surface when fresher activity or a new issue lands.
 */
export function markAttentionReviewed({
  targetId, adminId = null, note = null, now = null,
} = {}) {
  if (!targetId) return null;
  return logAdminAction({
    type:      'review',
    targetId,
    actor:     { role: 'admin', id: adminId },
    metadata:  { note: note || null },
    now,
  });
}

export const _internal = Object.freeze({
  LOG_KEY, MAX_LOG_ROWS, readLog, writeLog, genId,
  clearAll: () => {
    if (hasStorage()) {
      try { window.localStorage.removeItem(LOG_KEY); } catch { /* ignore */ }
    }
  },
});
