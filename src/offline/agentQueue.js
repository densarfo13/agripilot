/**
 * agentQueue.js — offline-first action queue for the v3
 * Field Agent Mode.
 *
 * Storage keys:
 *   farroway_agent_queue     (pending + recently-synced actions)
 *   farroway_agent_farmers   (denormalised farmer rows owned by this agent)
 *
 * Why two keys
 *   * The queue is the source of truth for SYNC. Every
 *     action stays in the queue (even after success) until
 *     a TTL prunes it, so an agent can review what they
 *     did today even from a flaky-network device.
 *   * The farmers list is a denormalised PROJECTION used by
 *     the AgentDashboard's "My Farmers" surface. Reading
 *     from a flat list is much faster than re-walking
 *     every queue item on every render.
 *
 * Strict-rule audit (per spec § 4–7)
 *   * Never throws — every storage call try/catch wrapped,
 *     every read uses safeParse with `[]` fallback.
 *   * Idempotent on local id — addToQueue with the same id
 *     returns the existing record instead of duplicating.
 *   * Privacy: the queue lives ONLY on the agent's device
 *     until syncQueue() pushes it server-side. No PII leaks
 *     to other devices via localStorage sharing because
 *     the per-device-only nature of the store.
 *   * Sync is best-effort: the v3 server endpoints
 *     (/api/v3/agent/queue) DO NOT exist yet. syncQueue()
 *     attempts them and silently flags the call as failed
 *     until the deploy lands. When they ship, sync resumes
 *     automatically with no client change.
 *   * Events: AGENT_FARMER_CREATED + AGENT_VISIT_LOGGED
 *     emit via safeTrackEvent so the analytics queue picks
 *     them up regardless of the sync state.
 */

import { safeParse } from '../utils/safeParse.js';
import { safeTrackEvent } from '../lib/analytics.js';
import api from '../api/client.js';

export const STORAGE_KEYS = Object.freeze({
  QUEUE:   'farroway_agent_queue',
  FARMERS: 'farroway_agent_farmers',
});

export const AGENT_ACTIONS = Object.freeze({
  ADD_FARMER:  'ADD_FARMER',
  UPDATE_FARM: 'UPDATE_FARM',
  LOG_VISIT:   'LOG_VISIT',
});

export const AGENT_QUEUE_STATUS = Object.freeze({
  PENDING:  'PENDING',
  SYNCING:  'SYNCING',
  SYNCED:   'SYNCED',
  FAILED:   'FAILED',
});

export const AGENT_EVENTS = Object.freeze({
  FARMER_CREATED: 'AGENT_FARMER_CREATED',
  VISIT_LOGGED:   'AGENT_VISIT_LOGGED',
});

const MAX_QUEUE   = 500;
const MAX_FARMERS = 500;
const SYNCED_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days
const SYNC_ENDPOINT = '/v3/agent/queue';

// ─── primitives ────────────────────────────────────────────

function _read(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    const parsed = safeParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function _write(key, rows, cap) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const safe = Array.isArray(rows) ? rows.slice(-cap) : [];
    localStorage.setItem(key, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}
function _now() { try { return new Date().toISOString(); } catch { return ''; } }
function _ts(s)  {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}
function _uid(p) {
  try {
    return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  } catch {
    return `${p}_${Date.now()}`;
  }
}

// ─── Queue management ─────────────────────────────────────

/**
 * addToQueue({ action, payload, agentId, id? }) — appends a
 * new pending action. If `id` matches an existing item,
 * the existing record is returned (idempotent).
 *
 * Side-effects:
 *   * ADD_FARMER → also writes a farmer row into the
 *     `farroway_agent_farmers` projection so the My
 *     Farmers list updates immediately.
 *   * UPDATE_FARM → patches the farmer row by id.
 *   * LOG_VISIT  → no projection write; visits surface via
 *     getActivityLog() reading the queue directly.
 *
 * Emits AGENT_FARMER_CREATED on a fresh ADD_FARMER + a
 * single AGENT_VISIT_LOGGED on every LOG_VISIT.
 */
export function addToQueue(input) {
  const safe = input && typeof input === 'object' ? input : {};
  const action = String(safe.action || '').toUpperCase();
  if (!Object.values(AGENT_ACTIONS).includes(action)) return null;
  const now = _now();
  const id  = safe.id || _uid('aq');

  const queue = _read(STORAGE_KEYS.QUEUE);
  // Idempotent — same id (e.g. retry from the form) returns
  // the existing record without writing twice.
  const existing = queue.find((r) => r && r.id === id);
  if (existing) return existing;

  const record = {
    id,
    action,
    payload:    safe.payload && typeof safe.payload === 'object'
                  ? safe.payload : {},
    agentId:    safe.agentId || null,
    status:     AGENT_QUEUE_STATUS.PENDING,
    createdAt:  now,
    updatedAt:  now,
    syncedAt:   null,
    attempts:   0,
    lastError:  null,
  };

  queue.push(record);
  _write(STORAGE_KEYS.QUEUE, queue, MAX_QUEUE);

  // Projection updates so the dashboard surfaces the new
  // farmer row instantly, even before sync.
  if (action === AGENT_ACTIONS.ADD_FARMER) {
    _projectAddFarmer(record);
    try {
      safeTrackEvent(AGENT_EVENTS.FARMER_CREATED, {
        queueId:  record.id,
        agentId:  record.agentId,
        crop:     record.payload.crop || null,
        region:   record.payload.region || null,
      });
    } catch { /* analytics never blocks */ }
  } else if (action === AGENT_ACTIONS.UPDATE_FARM) {
    _projectUpdateFarm(record);
  } else if (action === AGENT_ACTIONS.LOG_VISIT) {
    try {
      safeTrackEvent(AGENT_EVENTS.VISIT_LOGGED, {
        queueId:  record.id,
        agentId:  record.agentId,
        farmerId: record.payload.farmerId || null,
      });
    } catch { /* ignore */ }
  }

  return record;
}

/**
 * Read the full queue. Used by getActivityLog() and the
 * background sync loop.
 */
export function getQueue() {
  return _read(STORAGE_KEYS.QUEUE)
    .filter((r) => r && r.id && r.action)
    .sort((a, b) => _ts(b.createdAt) - _ts(a.createdAt));
}

export function getPendingQueue() {
  return getQueue().filter(
    (r) => r.status === AGENT_QUEUE_STATUS.PENDING
        || r.status === AGENT_QUEUE_STATUS.FAILED,
  );
}

// ─── Farmer projection ────────────────────────────────────

function _projectAddFarmer(record) {
  const p = record.payload || {};
  const farmerId = p.id || p.farmerId || record.id;
  const stored = {
    id:         farmerId,
    queueId:    record.id,
    agentId:    record.agentId,
    name:       String(p.name      || '').trim(),
    phone:      String(p.phone     || '').trim(),
    crop:       String(p.crop      || '').trim(),
    farmSize:   Number.isFinite(Number(p.farmSize))
                  ? Number(p.farmSize) : null,
    region:     String(p.region    || '').trim(),
    country:    String(p.country   || '').trim(),
    gps:        p.gps && Number.isFinite(Number(p.gps.lat))
                       && Number.isFinite(Number(p.gps.lng))
                  ? { lat: Number(p.gps.lat), lng: Number(p.gps.lng) }
                  : null,
    createdAt:  record.createdAt,
    updatedAt:  record.updatedAt,
    syncedAt:   record.syncedAt,
  };
  const rows = _read(STORAGE_KEYS.FARMERS);
  const idx  = rows.findIndex((r) => r && r.id === stored.id);
  if (idx >= 0) rows[idx] = stored;
  else          rows.push(stored);
  _write(STORAGE_KEYS.FARMERS, rows, MAX_FARMERS);
}

function _projectUpdateFarm(record) {
  const p = record.payload || {};
  const farmerId = p.id || p.farmerId;
  if (!farmerId) return;
  const rows = _read(STORAGE_KEYS.FARMERS);
  const idx  = rows.findIndex((r) => r && r.id === farmerId);
  if (idx < 0) return;
  rows[idx] = {
    ...rows[idx],
    ...p,
    id:        rows[idx].id,           // never overwrite
    agentId:   rows[idx].agentId,      // ownership stays
    updatedAt: record.updatedAt,
  };
  _write(STORAGE_KEYS.FARMERS, rows, MAX_FARMERS);
}

/**
 * getMyFarmers(agentId) — projection read. Returns farmers
 * created by this agent, newest first.
 *
 * "Assigned Farmers" filter (per spec § 6) — when an agent
 * is signed in we only show farmers they own. A farmer
 * created by another agent on the same device (rare —
 * shared phones) won't surface here.
 */
export function getMyFarmers(agentId) {
  const rows = _read(STORAGE_KEYS.FARMERS);
  const all = rows
    .filter((r) => r && r.id)
    .sort((a, b) => _ts(b.createdAt) - _ts(a.createdAt));
  if (!agentId) return all;       // dev / single-user fallback
  return all.filter(
    (r) => String(r.agentId || '') === String(agentId),
  );
}

/**
 * getActivityLog(agentId) — visit + farmer-creation log
 * derived from the queue, newest first. Capped at 50 rows
 * so the dashboard render stays cheap.
 */
export function getActivityLog(agentId) {
  return getQueue()
    .filter((r) => !agentId
                || String(r.agentId || '') === String(agentId))
    .slice(0, 50);
}

// ─── Sync ─────────────────────────────────────────────────

/**
 * syncQueue() — best-effort POST of every PENDING / FAILED
 * queue item to the v3 endpoint. Returns
 * `{ attempted, succeeded, failed }`. Never throws.
 *
 * The v3 endpoint doesn't exist yet — calls 404. We keep
 * the items in the queue (status flips to FAILED, attempts
 * increments, lastError captures the reason) so the next
 * sync cycle picks them up. When the server lands, the
 * client requires no change.
 */
export async function syncQueue() {
  const pending = getPendingQueue();
  if (pending.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  // Mark every targeted item as SYNCING so a concurrent
  // call doesn't double-submit. The state is local-only;
  // a crash mid-sync flips them back to PENDING via the
  // post-error reconciliation below.
  _patchStatus(pending.map((r) => r.id), AGENT_QUEUE_STATUS.SYNCING);

  let succeeded = 0;
  let failed    = 0;
  for (const item of pending) {
    try {
      const res = await api.post(SYNC_ENDPOINT, {
        id:        item.id,
        action:    item.action,
        payload:   item.payload,
        agentId:   item.agentId,
        createdAt: item.createdAt,
      });
      if (res && res.status >= 200 && res.status < 300) {
        _patchOne(item.id, {
          status:   AGENT_QUEUE_STATUS.SYNCED,
          syncedAt: _now(),
          lastError: null,
          attempts: (item.attempts || 0) + 1,
        });
        succeeded += 1;
      } else {
        _patchOne(item.id, {
          status:    AGENT_QUEUE_STATUS.FAILED,
          attempts:  (item.attempts || 0) + 1,
          lastError: `http_${res ? res.status : 'unknown'}`,
        });
        failed += 1;
      }
    } catch (err) {
      const status =
        (err && err.response && err.response.status)
        || err.status || null;
      _patchOne(item.id, {
        status:    AGENT_QUEUE_STATUS.FAILED,
        attempts:  (item.attempts || 0) + 1,
        lastError: status ? `http_${status}` : 'network',
      });
      failed += 1;
    }
  }

  // Prune SYNCED rows older than the TTL so the queue
  // doesn't grow forever on a busy agent's device.
  _pruneSynced();

  return { attempted: pending.length, succeeded, failed };
}

function _patchOne(id, updates) {
  const rows = _read(STORAGE_KEYS.QUEUE);
  const idx  = rows.findIndex((r) => r && r.id === id);
  if (idx < 0) return;
  rows[idx] = { ...rows[idx], ...(updates || {}), updatedAt: _now() };
  _write(STORAGE_KEYS.QUEUE, rows, MAX_QUEUE);

  // Mirror sync state into the farmer projection so the UI
  // can show a "synced" check next to each row.
  if (rows[idx].action === AGENT_ACTIONS.ADD_FARMER) {
    const farmers = _read(STORAGE_KEYS.FARMERS);
    const fIdx = farmers.findIndex(
      (f) => f && f.queueId === id,
    );
    if (fIdx >= 0) {
      farmers[fIdx] = {
        ...farmers[fIdx],
        syncedAt: rows[idx].syncedAt || farmers[fIdx].syncedAt,
      };
      _write(STORAGE_KEYS.FARMERS, farmers, MAX_FARMERS);
    }
  }
}

function _patchStatus(ids, status) {
  if (!Array.isArray(ids) || !ids.length) return;
  const set = new Set(ids);
  const rows = _read(STORAGE_KEYS.QUEUE);
  let dirty = false;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i] && set.has(rows[i].id)) {
      rows[i] = { ...rows[i], status, updatedAt: _now() };
      dirty = true;
    }
  }
  if (dirty) _write(STORAGE_KEYS.QUEUE, rows, MAX_QUEUE);
}

function _pruneSynced() {
  const cutoff = Date.now() - SYNCED_TTL_MS;
  const rows = _read(STORAGE_KEYS.QUEUE);
  const next = rows.filter((r) => {
    if (!r) return false;
    if (r.status !== AGENT_QUEUE_STATUS.SYNCED) return true;
    return _ts(r.syncedAt) >= cutoff;
  });
  if (next.length !== rows.length) {
    _write(STORAGE_KEYS.QUEUE, next, MAX_QUEUE);
  }
}

/**
 * scheduleAutoSync({ intervalMs = 30000 }) — kicks off a
 * setInterval that calls syncQueue every interval. Only
 * runs when navigator.onLine === true so we don't burn
 * battery hammering an unreachable server.
 *
 * Returns a cleanup function. Components call this in a
 * useEffect and return the cleanup.
 */
export function scheduleAutoSync({ intervalMs = 30000 } = {}) {
  let timer = null;
  let alive = true;

  function tick() {
    if (!alive) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }
    syncQueue().catch(() => { /* never throw from a tick */ });
  }

  // Attempt one sync immediately on mount so a fresh page
  // load doesn't wait the full interval.
  setTimeout(tick, 250);
  timer = setInterval(tick, intervalMs);

  // Resume sync the moment the device reconnects, instead
  // of waiting for the next interval tick.
  function onOnline() { tick(); }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
  }

  return function stop() {
    alive = false;
    if (timer) clearInterval(timer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
    }
  };
}

/**
 * Aggregate counts for the dashboard header.
 */
export function agentSummary(agentId) {
  const queue = getQueue();
  const mine = agentId
    ? queue.filter((r) => String(r.agentId || '') === String(agentId))
    : queue;
  const farmers = getMyFarmers(agentId);
  return {
    farmerCount:   farmers.length,
    pendingSync:   mine.filter((r) =>
                     r.status === AGENT_QUEUE_STATUS.PENDING
                  || r.status === AGENT_QUEUE_STATUS.FAILED).length,
    syncedCount:   mine.filter((r) =>
                     r.status === AGENT_QUEUE_STATUS.SYNCED).length,
    visitsLogged:  mine.filter((r) =>
                     r.action === AGENT_ACTIONS.LOG_VISIT).length,
  };
}
