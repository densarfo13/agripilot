/**
 * eventLogger.js — append-only local event log that turns farmer
 * actions into trackable data.
 *
 *   localStorage["farroway.farmEvents"] = [
 *     { id, farmId, type, payload, timestamp }, ...
 *   ]
 *
 * Rules:
 *   • append-only: logEvent never mutates existing rows
 *   • id-dedup: if an event with the same id is already present,
 *     the duplicate is dropped (idempotent — safe to call twice
 *     when offline retry fires again)
 *   • stable types: 'task_completed' | 'task_feedback' |
 *     'farm_created' | 'farm_updated' | 'login'
 *   • SSR-safe: no window? → silent no-op, read returns []
 *
 * This log is the single source of truth for:
 *   - per-farm timeline (spec §2)
 *   - active-farmer detection (spec §3 — 7-day window)
 *   - NGO program summaries (spec §5)
 *   - CSV export (spec §6)
 */

const STORAGE_KEY = 'farroway.farmEvents';

// Exhaustive list of allowed types. The NGO analytics layer trusts
// this whitelist — new types must be added here to avoid silent drops.
// v1 covers the full spec §3 set so every meaningful farmer action
// has a canonical type; anything unknown is rejected at write time.
export const EVENT_TYPES = Object.freeze([
  // Legacy (kept for back-compat — do not remove)
  'task_completed',
  'task_feedback',
  'farm_created',
  'farm_updated',
  'login',
  // v1 integrated-pass additions
  'task_skipped',
  'crop_selected',
  'issue_reported',
  'issue_assigned',
  'issue_resolved',
  'harvest_recorded',
  'notification_dismissed',
  // Gap-fix pass additions (spec §6)
  'issue_status_changed',
  'alert_dismissed',
  'outcome_recorded',
]);

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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch { return false; }
}

function genId(type, timestamp) {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return `${type}_${timestamp}_${Math.floor(Math.random() * 1e9)}`;
}

/**
 * logEvent — append one event to the local log.
 *
 *   logEvent({ farmId, type, payload, timestamp?, id? })
 *     → { id, farmId, type, payload, timestamp } | null
 *
 * Returns null when:
 *   • type is missing or not in EVENT_TYPES
 *   • an event with the supplied id already exists (dedup)
 */
export function logEvent({
  id,
  farmerId = null,        // new in gap-fix pass (spec §6)
  farmId = null,
  type,
  eventType,              // alias for `type` — spec §6 canonical name
  payload = null,
  metadata,               // alias for `payload` — spec §6 canonical name
  timestamp,
} = {}) {
  const resolvedType = type || eventType;
  if (!resolvedType || typeof resolvedType !== 'string') return null;
  if (!EVENT_TYPES.includes(resolvedType)) return null;
  const ts = Number.isFinite(timestamp) ? Number(timestamp) : Date.now();
  const eventId = id || genId(resolvedType, ts);
  const list = readRaw();
  if (list.some((e) => e && e.id === eventId)) return null;
  const resolvedPayload = (metadata !== undefined) ? metadata : payload;
  const event = Object.freeze({
    id:        eventId,
    farmerId:  farmerId ? String(farmerId) : null,
    farmId:    farmId ? String(farmId) : null,
    type:      resolvedType,
    eventType: resolvedType,                 // canonical alias
    payload:   resolvedPayload ?? null,
    metadata:  resolvedPayload ?? null,      // canonical alias
    timestamp: ts,
  });
  list.push(event);
  writeRaw(list);
  return event;
}

export function getEvents() {
  return readRaw().slice(); // defensive copy
}

export function clearEvents() {
  writeRaw([]);
}

// ─── Timeline (spec §2) ────────────────────────────────────────────
/**
 * getFarmTimeline — ordered (ascending by timestamp) list of events
 * for a single farm. Missing farmId returns []; unknown farm returns [].
 */
export function getFarmTimeline(farmId) {
  if (!farmId) return [];
  const id = String(farmId);
  return readRaw()
    .filter((e) => e && e.farmId === id)
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

// ─── Active farmer (spec §3) ───────────────────────────────────────
/**
 * isFarmActive — returns true when the farm has any event in the
 * last `windowDays` days (default 7). Accepts a `now` override for
 * deterministic testing.
 */
export function isFarmActive(farmId, { now, windowDays = 7 } = {}) {
  if (!farmId) return false;
  const nowTs = Number.isFinite(now)
    ? Number(now)
    : (now instanceof Date ? now.getTime() : Date.now());
  const windowMs = Math.max(0, windowDays) * 24 * 3600 * 1000;
  const cutoff = nowTs - windowMs;
  const id = String(farmId);
  const list = readRaw();
  for (const e of list) {
    if (!e || e.farmId !== id) continue;
    if ((e.timestamp || 0) >= cutoff) return true;
  }
  return false;
}

export const _keys = Object.freeze({ STORAGE_KEY });
