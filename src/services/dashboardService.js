/**
 * dashboardService — stale-while-revalidate cache for dashboard data.
 *
 * Pattern: serve cached data instantly → refresh in background → notify on update.
 * Avoids blocking the farmer on every dashboard mount.
 *
 * Cached: farm tasks (counts + primary task), weather (delegated to WeatherContext).
 * NOT cached: auth state, profile (handled by ProfileContext with its own cache).
 */
import { getFarmTasks } from '../lib/api.js';
import { log } from '../lib/logger.js';

// ─── In-memory task cache per farm ─────────────────────────
const _taskCache = new Map();
const STALE_MS = 2 * 60 * 1000;   // 2 min — serve stale, refresh in background
const EXPIRED_MS = 10 * 60 * 1000; // 10 min — discard, must refetch

/**
 * @typedef {Object} TaskCacheEntry
 * @property {Array} tasks
 * @property {number} completedCount
 * @property {number} fetchedAt
 */

/**
 * Get dashboard task data with stale-while-revalidate.
 *
 * Behavior:
 *   - Cache miss: fetch from server, return result
 *   - Cache fresh (<2min): return cached immediately, no fetch
 *   - Cache stale (2-10min): return cached immediately, fetch in background
 *   - Cache expired (>10min): fetch from server, return result
 *
 * @param {string} farmId
 * @param {Object} [opts]
 * @param {boolean} [opts.forceRefresh] - Skip cache entirely
 * @param {Function} [opts.onBackgroundUpdate] - Called when background refresh completes with new data
 * @returns {Promise<{tasks: Array, completedCount: number, fromCache: boolean}>}
 */
export async function getDashboardTasks(farmId, opts = {}) {
  if (!farmId) {
    return { tasks: [], completedCount: 0, fromCache: false };
  }

  const { forceRefresh, onBackgroundUpdate } = opts;
  const cached = _taskCache.get(farmId);
  const now = Date.now();

  // Fresh cache — return immediately
  if (!forceRefresh && cached && (now - cached.fetchedAt) < STALE_MS) {
    return { tasks: cached.tasks, completedCount: cached.completedCount, fromCache: true };
  }

  // Stale cache — return cached, refresh in background
  if (!forceRefresh && cached && (now - cached.fetchedAt) < EXPIRED_MS) {
    _refreshInBackground(farmId, onBackgroundUpdate);
    return { tasks: cached.tasks, completedCount: cached.completedCount, fromCache: true };
  }

  // Expired or forced — must fetch
  return _fetchAndCache(farmId);
}

/**
 * Invalidate the cache for a farm (e.g., after task completion).
 * Next getDashboardTasks call will fetch fresh.
 */
export function invalidateDashboardCache(farmId) {
  if (farmId) _taskCache.delete(farmId);
}

/**
 * Invalidate all cached data (e.g., on logout).
 */
export function clearDashboardCache() {
  _taskCache.clear();
}

// ─── Dedup guard for background refreshes ──────────────────
const _inflightRefresh = new Map();

async function _refreshInBackground(farmId, onUpdate) {
  // Dedup — don't fire multiple background refreshes for same farm
  if (_inflightRefresh.has(farmId)) return;
  _inflightRefresh.set(farmId, true);

  try {
    const result = await _fetchAndCache(farmId);
    if (onUpdate) onUpdate(result);
  } catch {
    // Background refresh failed — stale cache stays valid
    log('api', 'dashboard_bg_refresh_failed', { farmId });
  } finally {
    _inflightRefresh.delete(farmId);
  }
}

async function _fetchAndCache(farmId) {
  try {
    const data = await getFarmTasks(farmId);
    const tasks = data.tasks || [];
    const completedCount = data.completedCount || 0;

    _taskCache.set(farmId, {
      tasks,
      completedCount,
      fetchedAt: Date.now(),
    });

    return { tasks, completedCount, fromCache: false };
  } catch (err) {
    log('api', 'dashboard_fetch_failed', { farmId, error: err.message });
    // If we have stale cache, return it on error
    const stale = _taskCache.get(farmId);
    if (stale) {
      return { tasks: stale.tasks, completedCount: stale.completedCount, fromCache: true };
    }
    throw err;
  }
}
