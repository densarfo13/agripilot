/**
 * farmSync.js — FARM_PERSISTENCE_V1 client sync engine.
 *
 * Makes PostgreSQL the source of truth for farmer state while keeping
 * localStorage as a cache:
 *   • mirror(domain, recordId, payload)  — write-through: every local
 *       write is also pushed to the server (debounced, batched).
 *   • offline queue (localStorage) drains automatically on reconnect.
 *   • recoverAll() — on login, pull server state and hydrate the caches
 *       via per-domain hydrators (server is authoritative).
 *
 * Strict: NEVER throws, NEVER blocks the caller. If sync fails the app
 * behaves exactly as before (localStorage cache still works) — this code
 * only ADDS durability. Auth via cookie + bearer token.
 */

const QUEUE_KEY = 'farroway_farm_sync_queue';
const FLUSH_DEBOUNCE_MS = 1500;
const MAX_QUEUE = 500;
export const FARM_SYNC_DOMAINS = ['plants', 'scanHistory', 'tasks', 'outcomes', 'timeline'];

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => Date.now(), 0);
const _hasWindow = () => _safe(() => typeof window !== 'undefined', false);

function _token() {
  return _safe(() => (typeof localStorage !== 'undefined'
    ? localStorage.getItem('farroway_token') : null), null);
}
function _authHeaders(json) {
  const tok = _token();
  return Object.assign(json ? { 'Content-Type': 'application/json' } : {},
    tok ? { Authorization: 'Bearer ' + tok } : {});
}

// ── Queue (localStorage-backed, keyed by domain:recordId so repeated
//    writes to the same record coalesce to the latest payload) ──
function _readQueue() {
  return _safe(() => {
    const raw = localStorage.getItem(QUEUE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  }, {});
}
function _writeQueue(q) {
  _safe(() => {
    const keys = Object.keys(q);
    if (keys.length > MAX_QUEUE) {
      // Drop the oldest entries (lowest clientUpdatedAt) to stay bounded.
      keys.sort((a, b) => (q[a].clientUpdatedAt || 0) - (q[b].clientUpdatedAt || 0));
      for (const k of keys.slice(0, keys.length - MAX_QUEUE)) delete q[k];
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }, undefined);
}

let _state = { lastSyncAt: null, lastRecoverAt: null, lastError: null, flushing: false };
let _flushTimer = null;
const _hydrators = new Map();

/** Register a per-domain hydrator: fn(records[]) writes the local cache. */
export function registerHydrator(domain, fn) {
  if (typeof fn === 'function') _hydrators.set(domain, fn);
}

/** Write-through mirror of one record to the durable store. */
export function mirror(domain, recordId, payload, opts) {
  _safe(() => {
    if (!FARM_SYNC_DOMAINS.includes(domain) || !recordId) return;
    const q = _readQueue();
    q[domain + ':' + recordId] = {
      domain,
      recordId: String(recordId),
      payload: payload || {},
      deleted: !!(opts && opts.deleted),
      clientUpdatedAt: _now(),
    };
    _writeQueue(q);
    _scheduleFlush();
  }, undefined);
}

function _scheduleFlush() {
  _safe(() => {
    if (_flushTimer) return;
    _flushTimer = setTimeout(() => { _flushTimer = null; flush(); }, FLUSH_DEBOUNCE_MS);
  }, undefined);
}

/** Push every queued record to the server; clear what the server accepts. */
export async function flush() {
  return _safe(async () => {
    if (_state.flushing) return;
    if (_hasWindow() && navigator && navigator.onLine === false) return; // offline → keep queued
    const q = _readQueue();
    const items = Object.values(q);
    if (items.length === 0) return;
    _state.flushing = true;
    try {
      const res = await fetch('/api/farm-state/sync', {
        method: 'POST',
        credentials: 'include',
        headers: _authHeaders(true),
        body: JSON.stringify({ records: items }),
        keepalive: true,
      });
      if (res && res.ok) {
        // Remove only the items we sent (new writes during the request stay).
        const after = _readQueue();
        for (const it of items) {
          const k = it.domain + ':' + it.recordId;
          if (after[k] && (after[k].clientUpdatedAt || 0) <= (it.clientUpdatedAt || 0)) delete after[k];
        }
        _writeQueue(after);
        _state.lastSyncAt = _now();
        _state.lastError = null;
      } else {
        _state.lastError = 'http_' + (res ? res.status : 'none'); // keep queued for retry
      }
    } catch (e) {
      _state.lastError = (e && e.message) || 'flush_error'; // keep queued
    } finally {
      _state.flushing = false;
    }
  }, undefined);
}

/**
 * Pull authoritative server state and hydrate the local caches.
 * Call on login. Server is the source of truth; localStorage is a cache.
 */
export async function recoverAll(domains) {
  return _safe(async () => {
    const qs = Array.isArray(domains) && domains.length ? ('?domains=' + domains.join(',')) : '';
    const res = await fetch('/api/farm-state' + qs, {
      method: 'GET', credentials: 'include', headers: _authHeaders(false),
    });
    if (!res || !res.ok) { _state.lastError = 'recover_http_' + (res ? res.status : 'none'); return { ok: false }; }
    const data = await res.json();
    const records = (data && Array.isArray(data.records)) ? data.records : [];
    const byDomain = {};
    for (const r of records) {
      if (!r || !r.domain) continue;
      (byDomain[r.domain] = byDomain[r.domain] || []).push(r);
    }
    let hydrated = 0;
    for (const [domain, recs] of Object.entries(byDomain)) {
      const fn = _hydrators.get(domain);
      if (fn) { _safe(() => fn(recs), undefined); hydrated += recs.length; }
    }
    _state.lastRecoverAt = _now();
    // After recovery, flush anything still queued (e.g. offline writes).
    flush();
    return { ok: true, recovered: records.length, hydrated };
  }, { ok: false });
}

let _wired = false;
/** Install reconnect drain + the __farmSyncHealth diagnostic. Idempotent. */
export function installFarmSync() {
  if (_wired || !_hasWindow()) return;
  _wired = true;
  _safe(() => {
    window.addEventListener('online', () => { flush(); });
    // Periodic safety drain (covers a missed 'online' event).
    setInterval(() => { flush(); }, 60000);
    Object.defineProperty(window, '__farmSyncHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => Object.freeze({
        sourceOfTruth: 'postgres',
        localStorageRole: 'cache',
        online: _safe(() => navigator.onLine, null),
        queueLength: Object.keys(_readQueue()).length,
        domainsRegistered: [..._hydrators.keys()],
        lastSyncAt: _state.lastSyncAt,
        lastRecoverAt: _state.lastRecoverAt,
        lastError: _state.lastError,
      }),
    });
  }, undefined);
}

export default { mirror, flush, recoverAll, registerHydrator, installFarmSync };
