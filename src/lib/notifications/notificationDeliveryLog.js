/**
 * notificationDeliveryLog.js — append-only delivery log so we can
 * debug "did they receive X?" and feed future analytics.
 *
 * Storage:
 *   localStorage['farroway.notificationDeliveryLog.v1'] = [
 *     { id, userId, farmId?, type, channel, status, reason, createdAt },
 *     …
 *   ]
 *
 * status: 'queued' | 'sent' | 'failed' | 'skipped'
 * Capped at 500 entries (oldest dropped) so it never blows up
 * localStorage quota.
 */

const KEY = 'farroway.notificationDeliveryLog.v1';
const MAX_ENTRIES = 500;

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readRaw() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeRaw(list) {
  if (!hasStorage()) return false;
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); return true; }
  catch { return false; }
}

let counter = 0;
function nextId() {
  counter = (counter + 1) % 1_000_000;
  return `dlv_${Date.now().toString(36)}_${counter}`;
}

/**
 * logDeliveryAttempt — record one delivery attempt. Returns the
 * frozen entry so callers can echo the id back for correlation.
 */
export function logDeliveryAttempt({
  userId = null, farmId = null, type, channel, status,
  reason = null, messageId = null, notificationId = null,
} = {}) {
  if (!type || !channel || !status) return null;
  const entry = Object.freeze({
    id:             nextId(),
    userId:         userId || null,
    farmId:         farmId || null,
    type:           String(type),
    channel:        String(channel),
    status:         String(status),
    reason:         reason || null,
    messageId:      messageId || null,
    notificationId: notificationId || null,
    createdAt:      new Date().toISOString(),
  });
  const list = readRaw();
  list.push(entry);
  // Cap size — drop oldest.
  while (list.length > MAX_ENTRIES) list.shift();
  writeRaw(list);
  return entry;
}

export function listDeliveryLog({ limit = 100, type, channel, status } = {}) {
  const list = readRaw();
  let filtered = list;
  if (type)    filtered = filtered.filter((e) => e.type === type);
  if (channel) filtered = filtered.filter((e) => e.channel === channel);
  if (status)  filtered = filtered.filter((e) => e.status === status);
  // Newest first.
  filtered = filtered.slice().reverse();
  return filtered.slice(0, Math.max(0, Math.min(MAX_ENTRIES, limit)));
}

export function clearDeliveryLog() {
  if (!hasStorage()) return false;
  try { window.localStorage.removeItem(KEY); return true; }
  catch { return false; }
}

export const _internal = Object.freeze({ KEY, MAX_ENTRIES });
