/**
 * farrowayLocal.js — simple localStorage helpers for Farroway's
 * offline-first spec.
 *
 * Storage keys (all under a single "farroway.*" namespace):
 *
 *   farroway.taskCompletions   → array of { taskId, farmId, completed, timestamp }
 *   farroway.feedback          → array of { taskId, feedback: "yes"|"no", timestamp }
 *   farroway.farms             → array of { id, name, crop, location, size, program, ... }
 *   farroway.activeFarmId      → string (id of active farm)
 *   farroway.pendingEvents     → queue of { type, payload, timestamp }
 *   farroway.farmEvents        → see lib/events/eventLogger.js — the
 *                                append-only NGO-trust event log.
 *
 * Everything here is intentionally tiny, synchronous, and SSR-safe.
 * No dependency on any other module so pages can import it freely.
 */

import { logEvent } from '../lib/events/eventLogger.js';

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
  // NGO-trust append-only event log (spec §1, §8). Separate from the
  // sync queue — this log is the source of truth for timelines,
  // active-farmer detection and program summaries.
  logEvent({
    farmId: entry.farmId,
    type:   'task_completed',
    payload: { taskId: entry.taskId },
    timestamp: entry.timestamp,
  });
  return entry;
}

export function getTaskCompletions() {
  return readJson(K.TASKS, []);
}

// ─── Feedback ──────────────────────────────────────────────────────
export function saveFeedback({ taskId, feedback, farmId = null }) {
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
  // NGO-trust log. farmId is optional — include when the caller
  // knows it so program summaries can attribute feedback correctly.
  logEvent({
    farmId: farmId || getActiveFarmId(),
    type:   'task_feedback',
    payload: { taskId: entry.taskId, feedback },
    timestamp: entry.timestamp,
  });
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

export function saveFarm({
  name,
  crop,
  location,        // legacy free-form string; preserved for back-compat
  size,            // legacy free-form string
  program = null,
  // Canonical data shape — prefer these over legacy location/size.
  country  = null,
  state    = null,
  farmSize = null,
  sizeUnit = null,
  stage    = null,
  setActive = false,
} = {}) {
  if (!name || typeof name !== 'string') return null;
  const now = Date.now();
  const countryCode = country ? String(country).trim() : '';
  const stateCode   = state   ? String(state).trim()   : '';
  const sizeNum     = farmSize != null && farmSize !== ''
    ? Number(farmSize)
    : (size != null && size !== '' ? Number(size) : null);
  // Compose a human "location" string so the existing MyFarm cards
  // keep rendering without needing to know the new fields.
  const locationStr = location
    ? String(location).trim()
    : [countryCode, stateCode].filter(Boolean).join(', ');
  const farm = {
    id: genId(),
    name: String(name).trim(),
    crop: crop ? String(crop).trim().toLowerCase() : '',
    // Canonical fields (spec §7).
    country:  countryCode || null,
    state:    stateCode   || null,
    farmSize: Number.isFinite(sizeNum) ? sizeNum : null,
    sizeUnit: sizeUnit ? String(sizeUnit).trim() : null,
    stage:    stage    ? String(stage).trim()    : null,
    // Legacy mirrors — kept so existing readers continue to work.
    location: locationStr,
    size:     Number.isFinite(sizeNum) ? String(sizeNum) : '',
    program:  (typeof program === 'string' && program.trim()) ? program.trim() : null,
    createdAt: now,
  };
  const farms = getFarms();
  farms.push(farm);
  writeJson(K.FARMS, farms);
  // First farm becomes active automatically; caller can also opt in
  // explicitly via setActive so "Add Farm" can toggle it.
  if (setActive || !getActiveFarmId()) setActiveFarmId(farm.id);
  queueEvent({ type: 'farm_added', payload: farm });
  // NGO-trust event — needed so the farm's timeline starts at
  // "Farm created" (spec §2 example).
  logEvent({
    farmId:    farm.id,
    type:     'farm_created',
    payload:  { name: farm.name, crop: farm.crop, country: farm.country, program: farm.program },
    timestamp: farm.createdAt,
  });
  return farm;
}

/**
 * updateFarm — patch an existing farm by id and log a farm_updated
 * event. Used when NGO or farmer edits details (spec §1, §8).
 * No-op if the farm id doesn't exist.
 */
export function updateFarm(farmId, patch = {}) {
  if (!farmId) return null;
  const farms = getFarms();
  const idx = farms.findIndex((f) => f && f.id === String(farmId));
  if (idx < 0) return null;
  const before = farms[idx];
  const keys = ['name', 'crop', 'location', 'size', 'program'];
  const changed = {};
  for (const k of keys) {
    if (patch[k] !== undefined && patch[k] !== before[k]) changed[k] = patch[k];
  }
  if (Object.keys(changed).length === 0) return before;
  const after = { ...before, ...changed, updatedAt: Date.now() };
  farms[idx] = after;
  writeJson(K.FARMS, farms);
  logEvent({
    farmId:    after.id,
    type:     'farm_updated',
    payload:  { changed },
    timestamp: after.updatedAt,
  });
  return after;
}

/** Log a login / app-open event tied to the current active farm. */
export function logLogin() {
  return logEvent({
    farmId:    getActiveFarmId(),
    type:     'login',
    payload:   null,
    timestamp: Date.now(),
  });
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
