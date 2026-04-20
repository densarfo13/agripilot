/**
 * farrowayLocal.js — simple localStorage helpers for Farroway's
 * offline-first spec.
 *
 * Storage keys (all under a single "farroway.*" namespace):
 *
 *   farroway.taskCompletions   → array of { taskId, farmId, completed, timestamp }
 *   farroway.feedback          → array of { taskId, feedback: "yes"|"no", timestamp }
 *   farroway.farms             → array of { id, name, crop, location, size, ... }
 *   farroway.activeFarmId      → string (id of active farm)
 *   farroway.pendingEvents     → queue of { type, payload, timestamp }
 *
 * Everything here is intentionally tiny, synchronous, and SSR-safe.
 * No dependency on any other module so pages can import it freely.
 */

const K = Object.freeze({
  TASKS:    'farroway.taskCompletions',
  FEEDBACK: 'farroway.feedback',
  FARMS:    'farroway.farms',
  ACTIVE:   'farroway.activeFarmId',
  QUEUE:    'farroway.pendingEvents',
});

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readJson(key, fallback) {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch { return fallback; }
}

function writeJson(key, value) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

function readString(key) {
  if (!hasStorage()) return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeString(key, value) {
  if (!hasStorage()) return false;
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(value));
    return true;
  } catch { return false; }
}

// ─── Task completions ──────────────────────────────────────────────
export function saveTaskCompletion({ taskId, farmId }) {
  if (!taskId) return null;
  const entry = {
    taskId: String(taskId),
    farmId: farmId ? String(farmId) : null,
    completed: true,
    timestamp: Date.now(),
  };
  const list = readJson(K.TASKS, []);
  list.push(entry);
  writeJson(K.TASKS, list);
  // Also queue for sync.
  queueEvent({ type: 'task_completed', payload: entry });
  return entry;
}

export function getTaskCompletions() {
  return readJson(K.TASKS, []);
}

// ─── Feedback ──────────────────────────────────────────────────────
export function saveFeedback({ taskId, feedback }) {
  if (!taskId || (feedback !== 'yes' && feedback !== 'no')) return null;
  const entry = {
    taskId: String(taskId),
    feedback,
    timestamp: Date.now(),
  };
  const list = readJson(K.FEEDBACK, []);
  list.push(entry);
  writeJson(K.FEEDBACK, list);
  queueEvent({ type: 'task_feedback', payload: entry });
  return entry;
}

export function getFeedback() {
  return readJson(K.FEEDBACK, []);
}

// ─── Farms ─────────────────────────────────────────────────────────
function genId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return `farm_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export function getFarms() {
  const v = readJson(K.FARMS, []);
  return Array.isArray(v) ? v : [];
}

export function saveFarm({ name, crop, location, size }) {
  if (!name || typeof name !== 'string') return null;
  const farm = {
    id: genId(),
    name: String(name).trim(),
    crop: crop ? String(crop).trim() : '',
    location: location ? String(location).trim() : '',
    size: size != null ? String(size).trim() : '',
    createdAt: Date.now(),
  };
  const farms = getFarms();
  farms.push(farm);
  writeJson(K.FARMS, farms);
  // First farm becomes active automatically.
  if (!getActiveFarmId()) setActiveFarmId(farm.id);
  queueEvent({ type: 'farm_added', payload: farm });
  return farm;
}

export function setActiveFarmId(id) {
  if (!id) return false;
  writeString(K.ACTIVE, String(id));
  return true;
}

export function getActiveFarmId() {
  return readString(K.ACTIVE);
}

export function getActiveFarm() {
  const id = getActiveFarmId();
  if (!id) return null;
  const farms = getFarms();
  return farms.find((f) => f.id === id) || farms[0] || null;
}

// ─── Offline queue ─────────────────────────────────────────────────
export function queueEvent(evt) {
  if (!evt || typeof evt !== 'object' || !evt.type) return false;
  const list = readJson(K.QUEUE, []);
  list.push({
    type: String(evt.type),
    payload: evt.payload ?? null,
    timestamp: evt.timestamp || Date.now(),
  });
  writeJson(K.QUEUE, list);
  return true;
}

export function getQueue() {
  return readJson(K.QUEUE, []);
}

export function clearQueue() {
  writeJson(K.QUEUE, []);
}

/**
 * drainQueue — simulate sync. Calls `sender(event)` for each queued
 * event. If all succeed the queue is cleared; on any failure the
 * remaining events stay queued so we can retry later.
 *
 * Offline-first: if we're offline per navigator.onLine, do nothing.
 * The caller can still force a drain by passing { force: true }.
 */
export async function drainQueue(sender, { force = false } = {}) {
  if (!force && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { sent: 0, remaining: getQueue().length, skipped: true };
  }
  const queue = getQueue();
  if (queue.length === 0) return { sent: 0, remaining: 0, skipped: false };

  const remaining = [];
  let sent = 0;
  for (const evt of queue) {
    try {
      if (typeof sender === 'function') await sender(evt);
      sent += 1;
    } catch {
      remaining.push(evt);
    }
  }
  writeJson(K.QUEUE, remaining);
  return { sent, remaining: remaining.length, skipped: false };
}

// Default no-op sender so drainQueue works even without a backend.
// It just acknowledges each event so the queue clears on reconnect.
export function defaultSender(_evt) {
  return Promise.resolve(true);
}

export const _keys = K;
