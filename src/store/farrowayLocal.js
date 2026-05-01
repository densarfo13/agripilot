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

import { toSquareMeters } from '../lib/units/areaConversion.js';
// Single-base land-size model. landSizeSqFt is the canonical
// stored number; displayUnit captures the user's chosen unit
// so the UI converts ONCE on render. normalizedAreaSqm stays
// alongside for back-compat with existing per-area math.
import { toLandSizeSqFt } from '../lib/units/landSizeBase.js';

import { logEvent } from '../lib/events/eventLogger.js';

const K = Object.freeze({
  TASKS:    'farroway.taskCompletions',
  FEEDBACK: 'farroway.feedback',
  FARMS:    'farroway.farms',
  ACTIVE:   'farroway.activeFarmId',
  QUEUE:    'farroway.pendingEvents',
  DISMISSED_ALERTS: 'farroway.dismissedAlerts',
  // Location Intelligence Engine cache keys
  REGION_PROFILE:      'farroway.regionProfile',
  LAST_RECOMMENDATION: 'farroway.lastRecommendation',
  LAST_RISK:           'farroway.lastRisk',
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

// ─── Multi-role dual-write ─────────────────────────────────────────
// After the migration sentinel is set, every saveFarm / updateFarm
// also writes the row to farroway_gardens (backyard rows) or
// farroway_farms (every other type). Pre-migration writes are
// picked up by migrateLegacyFarms on the next boot.
function _isMigrated() {
  if (!hasStorage()) return false;
  try { return window.localStorage.getItem('farroway_full_architecture_migrated') === 'true'; }
  catch { return false; }
}

function _isGardenFarmType(t) {
  const s = String(t || '').toLowerCase();
  return s === 'backyard' || s === 'home_garden' || s === 'home';
}

function _dualWriteToNewArrays(farm) {
  if (!_isMigrated()) return;
  if (!hasStorage()) return;
  const targetKey = _isGardenFarmType(farm?.farmType)
    ? 'farroway_gardens'
    : 'farroway_farms';
  try {
    const raw = window.localStorage.getItem(targetKey);
    let arr;
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    const idx = arr.findIndex((r) => r && String(r.id) === String(farm.id));
    const decorated = {
      ...farm,
      experience: _isGardenFarmType(farm?.farmType) ? 'garden' : 'farm',
      userId: farm?.userId || null,
    };
    if (idx >= 0) arr[idx] = decorated;
    else          arr.push(decorated);
    window.localStorage.setItem(targetKey, JSON.stringify(arr));
  } catch { /* swallow — legacy array is still authoritative */ }
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
  if (!Array.isArray(v)) return [];
  // Back-compat: rows created before normalizedAreaSqm existed are
  // enriched on read so every downstream consumer (dashboards, NGO
  // reports, yield math) sees the field. We do NOT rewrite storage
  // here — the next updateFarm / saveFarm persists it naturally.
  return v.map((row) => {
    if (!row || typeof row !== 'object') return row;
    if (row.normalizedAreaSqm != null) return row;
    const sqm = toSquareMeters(row.farmSize ?? row.size, row.sizeUnit);
    return sqm == null ? row : { ...row, normalizedAreaSqm: sqm };
  });
}

export function saveFarm({
  name,
  crop,
  cropLabel   = null,   // human label (e.g. "Maize (corn)")
  location,             // legacy free-form string; preserved for back-compat
  size,                 // legacy free-form string
  program = null,
  // Canonical data shape — prefer these over legacy location/size.
  country       = null,
  countryLabel  = null, // human label (e.g. "Ghana")
  state         = null,
  stateLabel    = null, // human label (e.g. "Ashanti")
  farmSize      = null,
  sizeUnit      = null,
  stage         = null,
  farmType      = null, // 'backyard' | 'small_farm' | 'commercial'
  setActive     = false,
} = {}) {
  if (!name || typeof name !== 'string') return null;
  const now = Date.now();
  const countryCode = country ? String(country).trim().toUpperCase() : '';
  const stateCode   = state   ? String(state).trim()   : '';
  const cropCode    = crop    ? String(crop).trim().toLowerCase() : '';
  const sizeNum     = farmSize != null && farmSize !== ''
    ? Number(farmSize)
    : (size != null && size !== '' ? Number(size) : null);
  // Compose a human "location" string so the existing MyFarm cards
  // keep rendering without needing to know the new fields. Prefer
  // the structured labels when available.
  const locationStr = location
    ? String(location).trim()
    : [stateLabel || stateCode, countryLabel || countryCode].filter(Boolean).join(', ');
  const farm = {
    id: genId(),
    name: String(name).trim(),
    crop: cropCode,
    // Canonical normalized shape — v1 spec §1 "Stored farm object must
    // be normalized". Code + label pair so analytics can group on the
    // stable code while UIs can render the human label without a lookup.
    cropLabel:    cropLabel    ? String(cropLabel).trim()    : null,
    countryCode:  countryCode  || null,
    countryLabel: countryLabel ? String(countryLabel).trim() : null,
    stateCode:    stateCode    || null,
    stateLabel:   stateLabel   ? String(stateLabel).trim()   : null,
    // Canonical fields kept for back-compat with readers that used
    // them before the label split.
    country:  countryCode || null,
    state:    stateCode   || null,
    farmSize: Number.isFinite(sizeNum) ? sizeNum : null,
    sizeUnit: sizeUnit ? String(sizeUnit).trim() : null,
    // Spec §3: every farm carries a normalizedAreaSqm so yield /
    // value / NGO-summary math has a single base unit. Computed
    // from (farmSize, sizeUnit) via the canonical area converter —
    // returns null when either piece is missing / invalid so
    // downstream code can handle "unknown area" explicitly.
    normalizedAreaSqm: toSquareMeters(sizeNum, sizeUnit),
    // Land-size base-unit spec: ONE canonical sqft value + the
    // user's chosen displayUnit so the UI converts ONCE on
    // render and never double-converts. Stays consistent with
    // normalizedAreaSqm via the same input pair.
    landSizeSqFt: (function () {
      const v = toLandSizeSqFt(sizeNum, sizeUnit);
      return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null;
    })(),
    displayUnit: sizeUnit ? String(sizeUnit).trim() : null,
    stage:    stage    ? String(stage).trim()    : null,
    // Farm type tiers the downstream experience (task engine,
    // alerts, recommendations). Canonicalised to one of three
    // strings or falls back to the default tier when unset.
    // See src/lib/farm/farmTypeBehavior.js for the policy map.
    farmType: (function () {
      const VALID = ['backyard', 'small_farm', 'commercial'];
      if (!farmType) return 'small_farm';
      const s = String(farmType).toLowerCase().trim();
      if (VALID.indexOf(s) !== -1) return s;
      if (s === 'home_food' || s === 'backyard_home' || s === 'home') return 'backyard';
      if (s === 'commercial_farm' || s === 'large' || s === 'enterprise') return 'commercial';
      return 'small_farm';
    })(),
    // Legacy mirrors — kept so existing readers continue to work.
    location: locationStr,
    size:     Number.isFinite(sizeNum) ? String(sizeNum) : '',
    program:  (typeof program === 'string' && program.trim()) ? program.trim() : null,
    createdAt: now,
  };
  const farms = getFarms();
  farms.push(farm);
  writeJson(K.FARMS, farms);
  // Multi-role architecture spec: dual-write to the first-class
  // arrays AFTER the legacy write succeeds. Backyard rows land
  // in farroway_gardens, every other type in farroway_farms.
  // Self-suppresses when the migration sentinel hasn't been set
  // yet — bootstrap's migrateLegacyFarms will pick the row up
  // on next boot.
  _dualWriteToNewArrays(farm);
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
  const keys = ['name', 'crop', 'location', 'size', 'program', 'farmType',
                'farmSize', 'sizeUnit', 'stage', 'country', 'state',
                'countryCode', 'countryLabel', 'stateCode', 'stateLabel',
                'cropLabel'];
  const changed = {};
  for (const k of keys) {
    if (patch[k] !== undefined && patch[k] !== before[k]) changed[k] = patch[k];
  }
  if (Object.keys(changed).length === 0) return before;
  const after = { ...before, ...changed, updatedAt: Date.now() };
  // Recompute the normalized area whenever a size- or unit-relevant
  // field changed so yield / value math keeps a consistent base.
  if (changed.farmSize != null || changed.sizeUnit != null
      || changed.size != null) {
    const size = after.farmSize != null ? after.farmSize : after.size;
    after.normalizedAreaSqm = toSquareMeters(size, after.sizeUnit);
    // Land-size base-unit spec: keep landSizeSqFt + displayUnit
    // in lockstep with farmSize × sizeUnit. Single conversion on
    // save; the display layer converts ONCE on render and never
    // round-trips back to storage.
    const baseFt = toLandSizeSqFt(size, after.sizeUnit);
    after.landSizeSqFt = Number.isFinite(baseFt)
      ? Math.round(baseFt * 10000) / 10000
      : null;
    after.displayUnit  = after.sizeUnit ? String(after.sizeUnit).trim() : null;
  }
  farms[idx] = after;
  writeJson(K.FARMS, farms);
  // Multi-role dual-write — keep the new first-class arrays in
  // sync with the legacy partition.
  _dualWriteToNewArrays(after);
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

// ─── Dismissed-alerts memory (spec §5) ───────────────────────────
// Shape:  { [alertId]: { ts, contentHash, cycleKey } }
//   ts         — when the alert was dismissed
//   contentHash — tiny fingerprint of the message so a materially
//                 different alert under the same id surfaces again
//   cycleKey   — YYYY-MM-DD so dismissal naturally expires overnight
//
// This is deliberately local-first + lightweight. A process with no
// localStorage (SSR) sees nothing dismissed, which is the right
// default — dismissals never travel across devices.
const DISMISS_TTL_MS = 36 * 3600 * 1000; // 36h so weekday dismissals cover time-zone drift

function todayCycleKey(now = Date.now()) {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * tiny, stable content hash — good enough to notice "the forecast
 * changed from low_rain to excessive_heat". Not cryptographic.
 */
function hashContent(content) {
  const s = String(content || '').slice(0, 400);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

export function getDismissedAlerts() {
  const map = readJson(K.DISMISSED_ALERTS, {});
  return (map && typeof map === 'object' && !Array.isArray(map)) ? map : {};
}

/**
 * Persist a dismissal for `alertId`. `content` is any user-visible
 * string (message, headline) — we hash it so a materially different
 * alert under the same id can break through.
 */
export function dismissAlert(alertId, content = '') {
  if (!alertId) return false;
  const now = Date.now();
  const map = getDismissedAlerts();
  map[String(alertId)] = {
    ts: now,
    contentHash: hashContent(content),
    cycleKey:    todayCycleKey(now),
  };
  return writeJson(K.DISMISSED_ALERTS, map);
}

/**
 * True if `alertId` is dismissed for the current cycle AND the
 * content hasn't materially changed since dismissal.
 *
 *   • not dismissed          → false (show it)
 *   • dismissed but stale    → false (TTL / cycle expired)
 *   • dismissed, content new → false (break through)
 *   • dismissed, still fresh → true  (keep hidden)
 */
export function isAlertDismissed(alertId, content = '', now = Date.now()) {
  if (!alertId) return false;
  const map = getDismissedAlerts();
  const entry = map[String(alertId)];
  if (!entry) return false;
  if (entry.cycleKey && entry.cycleKey !== todayCycleKey(now)) return false;
  if (entry.ts && (now - entry.ts) > DISMISS_TTL_MS) return false;
  if (hashContent(content) !== entry.contentHash) return false;
  return true;
}

/**
 * Sweep out dismissals older than the TTL so the map doesn't grow.
 * Called lazily — not on every read, to keep the common path fast.
 */
export function pruneDismissedAlerts(now = Date.now()) {
  const map = getDismissedAlerts();
  const keys = Object.keys(map);
  if (keys.length === 0) return false;
  let dirty = false;
  for (const k of keys) {
    const e = map[k];
    if (!e || !e.ts || (now - e.ts) > DISMISS_TTL_MS) {
      delete map[k];
      dirty = true;
    }
  }
  if (dirty) writeJson(K.DISMISSED_ALERTS, map);
  return dirty;
}

// ─── Location Intelligence Engine cache (spec §7) ────────────────
// Thin get/set pairs for the three engine outputs. Writes are frozen
// only at the function boundary — storage round-trips plain objects.

export function getRegionProfileCached() {
  return readJson(K.REGION_PROFILE, null);
}
export function setRegionProfileCached(profile) {
  if (!profile || typeof profile !== 'object') return false;
  return writeJson(K.REGION_PROFILE, { ...profile, cachedAt: Date.now() });
}

export function getLastRecommendation() {
  return readJson(K.LAST_RECOMMENDATION, null);
}
export function setLastRecommendation(rec) {
  if (!rec || typeof rec !== 'object') return false;
  return writeJson(K.LAST_RECOMMENDATION, { ...rec, cachedAt: Date.now() });
}

export function getLastRisk() {
  return readJson(K.LAST_RISK, null);
}
export function setLastRisk(risk) {
  if (!risk || typeof risk !== 'object') return false;
  return writeJson(K.LAST_RISK, { ...risk, cachedAt: Date.now() });
}

export const _keys = K;
export const _dismissInternal = Object.freeze({
  DISMISS_TTL_MS, todayCycleKey, hashContent,
});
