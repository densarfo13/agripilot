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
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function keyFor(farmId) {
  return KEY_PREFIX + String(farmId || 'default');
}

/**
 * Persist a task payload for a farm. Callers pass the fully
 * normalized list + any metadata they want (completedCount etc.).
 */
export function cacheTasks(farmId, tasks = [], meta = {}) {
  if (!farmId) return null;
  const record = {
    farmId,
    tasks: Array.isArray(tasks) ? tasks : [],
    completedCount: Number.isFinite(meta.completedCount) ? meta.completedCount : 0,
    updatedAt: Date.now(),
    ...meta,
  };
  try { localStorage.setItem(keyFor(farmId), JSON.stringify(record)); }
  catch { /* quota — drop silently */ }
  return record;
}

/**
 * Read cached tasks for a farm. Returns null when nothing is cached
 * or the cache is older than MAX_AGE_MS so we never serve stale data
 * that would mislead a new farmer on a shared device.
 */
export function getCachedTasks(farmId) {
  if (!farmId) return null;
  const raw = localStorage.getItem(keyFor(farmId));
  if (!raw) return null;
  const parsed = safeParse(raw);
  if (!parsed || !Array.isArray(parsed.tasks)) return null;
  if (Date.now() - (parsed.updatedAt || 0) > MAX_AGE_MS) return null;
  return parsed;
}

export function clearCachedTasks(farmId) {
  if (!farmId) return;
  try { localStorage.removeItem(keyFor(farmId)); } catch { /* ignore */ }
}

export const _internal = { KEY_PREFIX, MAX_AGE_MS };
