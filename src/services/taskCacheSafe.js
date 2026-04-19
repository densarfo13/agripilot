/**
 * taskCacheSafe — last-known-good task payload per farm, stored locally.
 *
 * Spec §2: whenever a task fetch succeeds online we persist the
 * normalized payload; loadTasksSafe reads this on failure so the
 * Tasks screen can render the farmer's last saved work instead of a
 * raw error. Keyed by farmId so multi-farm users keep their per-farm
 * cache.
 */

const KEY_PREFIX = 'farroway:tasks_cache:';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — hard expiry
const STALE_TTL_MS = 48 * 60 * 60 * 1000;    // 48 h — show "may be outdated" banner

// Bump this whenever the cached record shape changes so we don't
// hand a new build an old-format blob. Mismatched entries are
// invalidated silently on read.
export const TASK_CACHE_VERSION = 'tasks_v2';

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function keyFor(farmId) {
  return KEY_PREFIX + String(farmId || 'default');
}

/**
 * Is the cached timestamp older than the soft staleness window?
 * Used by the UI to show "showing last saved, may be outdated".
 */
export function isTaskCacheStale(ts, ttlMs = STALE_TTL_MS) {
  if (!Number.isFinite(ts) || ts <= 0) return true;
  return Date.now() - ts > ttlMs;
}

/**
 * Persist a task payload for a farm. Callers pass the fully
 * normalized list + any metadata they want (completedCount etc.).
 *
 * Record shape:
 *   { v, ts, farmId, tasks, completedCount, ...meta }
 * `v` lets future builds discard old-shape blobs without crashing.
 */
export function cacheTasks(farmId, tasks = [], meta = {}) {
  if (!farmId) return null;
  const now = Date.now();
  const record = {
    v: TASK_CACHE_VERSION,
    ts: now,
    farmId,
    tasks: Array.isArray(tasks) ? tasks : [],
    completedCount: Number.isFinite(meta.completedCount) ? meta.completedCount : 0,
    updatedAt: now, // kept for backwards-compat with older readers
    ...meta,
  };
  try { localStorage.setItem(keyFor(farmId), JSON.stringify(record)); }
  catch { /* quota — drop silently */ }
  return record;
}

/**
 * Read cached tasks for a farm. Returns null when nothing is cached,
 * the cache shape is from an older version, or the record is older
 * than MAX_AGE_MS so we never serve deeply stale data that would
 * mislead a farmer on a shared device.
 *
 * When a valid record is returned we also set `isStale` so the UI
 * can warn "showing last saved, may be outdated" without re-deriving
 * the staleness rule in multiple places.
 */
export function getCachedTasks(farmId) {
  if (!farmId) return null;
  const key = keyFor(farmId);
  const raw = (() => {
    try { return localStorage.getItem(key); } catch { return null; }
  })();
  if (!raw) return null;

  const parsed = safeParse(raw);
  if (!parsed || !Array.isArray(parsed.tasks)) {
    // Corrupt blob — evict so we don't keep tripping over it.
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }

  // Version mismatch — older record layout. Evict and bail.
  if (parsed.v !== TASK_CACHE_VERSION) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }

  const ts = Number.isFinite(parsed.ts) ? parsed.ts : (parsed.updatedAt || 0);
  if (Date.now() - ts > MAX_AGE_MS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }

  return {
    ...parsed,
    updatedAt: ts,
    isStale: isTaskCacheStale(ts),
  };
}

export function clearCachedTasks(farmId) {
  if (!farmId) return;
  try { localStorage.removeItem(keyFor(farmId)); } catch { /* ignore */ }
}

export const _internal = { KEY_PREFIX, MAX_AGE_MS, STALE_TTL_MS };
