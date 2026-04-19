/**
 * loadTasksSafe — one-call safe task loader for the Tasks screen.
 *
 * Spec §3 + §4: the Tasks screen must never render a raw error. This
 * wrapper catches every failure mode and returns a normalized
 * result the screen can render directly:
 *
 *   { mode, tasks, completedCount, bannerMessageKey,
 *     lastUpdatedAt, canRetry, source }
 *
 * Modes:
 *   'online'                     — fresh network payload
 *   'offline_with_cache'         — network failed, cache available
 *   'offline_no_cache_fallback'  — network failed, no cache; render fallback task
 *   'retrying'                   — caller sets this while re-fetching
 *
 * Never throws. Callers don't need try/catch.
 */

import { cacheTasks, getCachedTasks } from './taskCacheSafe.js';
import { normalizeTaskList } from '../domain/tasks/normalizeTask.js';
import { buildOfflineFallbackTask } from './buildOfflineFallbackTask.js';
import { offlineEvents } from './offlineLogger.js';

/**
 * @param {Object} args
 * @param {string} args.farmId
 * @param {Function} args.fetcher            async () => { tasks, completedCount }
 * @param {boolean} [args.isOnline]          passed from NetworkContext when available
 * @param {Object} [args.localContext]       { countryCode, cropId, month, landProfile }
 *                                           — used to build a deterministic fallback
 *                                             task when no cache is available.
 * @returns {Promise<Object>}
 */
export async function loadTasksSafe({
  farmId, fetcher, isOnline = true, localContext,
} = {}) {
  if (!farmId || typeof fetcher !== 'function') {
    return fallbackResult({ canRetry: !!fetcher, reason: 'missing_args', localContext });
  }

  // Short-circuit when we already know we're offline — don't spam
  // failing requests. Go straight to cache.
  if (!isOnline) {
    offlineEvents.modeEntered('browser_offline');
    const cached = getCachedTasks(farmId);
    if (cached) return cachedResult(cached);
    return fallbackResult({ canRetry: true, reason: 'offline_no_cache', localContext });
  }

  try {
    const data = await fetcher();
    const tasks = normalizeTaskList(data?.tasks);
    const completedCount = Number.isFinite(data?.completedCount) ? data.completedCount : 0;
    cacheTasks(farmId, tasks, { completedCount });
    return {
      mode: 'online',
      tasks,
      completedCount,
      bannerMessageKey: null,
      lastUpdatedAt: Date.now(),
      canRetry: true,
      isStale: false,
      source: 'online',
    };
  } catch (err) {
    // Dev-only trace — never reaches farmer UI.
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[loadTasksSafe] fetch failed, falling back', err?.message);
    }
    offlineEvents.fetchFailed(err?.message?.slice(0, 80) || 'unknown');
    const cached = getCachedTasks(farmId);
    if (cached) return cachedResult(cached);
    return fallbackResult({ canRetry: true, reason: 'fetch_failed_no_cache', localContext });
  }
}

function cachedResult(cached) {
  const isStale = !!cached.isStale;
  offlineEvents.cachedTasksUsed((cached.tasks || []).length);
  if (isStale) {
    const ageMs = cached.updatedAt ? Date.now() - cached.updatedAt : null;
    offlineEvents.staleCacheUsed(ageMs);
  }
  return {
    mode: 'offline_with_cache',
    tasks: cached.tasks || [],
    completedCount: cached.completedCount || 0,
    // When the cache is older than STALE_TTL_MS, warn the user it may
    // be outdated. Otherwise just show the neutral "showing cached".
    bannerMessageKey: isStale
      ? 'offline.showingCachedStale'
      : 'offline.showingCached',
    lastUpdatedAt: cached.updatedAt || null,
    canRetry: true,
    isStale,
    source: 'cache',
  };
}

function fallbackResult({ canRetry = true, reason = 'fallback', localContext } = {}) {
  const fallbackTask = getFallbackTodayAction(localContext);
  offlineEvents.fallbackTaskShown(reason);
  return {
    mode: 'offline_no_cache_fallback',
    tasks: [],
    completedCount: 0,
    bannerMessageKey: 'offline.rightNow',
    lastUpdatedAt: null,
    canRetry,
    isStale: true,
    fallbackTask,
    source: 'fallback',
    reason,
  };
}

/**
 * Shape of the safe fallback task rendered when no cache exists.
 * Exposed so the Tasks screen can render it without inventing copy.
 * When `localContext` is provided, we build a deterministic, context-
 * aware task (country/crop/month/land). Otherwise the generic default.
 */
export function getFallbackTodayAction(localContext) {
  if (localContext && typeof localContext === 'object') {
    return buildOfflineFallbackTask(localContext);
  }
  return buildOfflineFallbackTask({});
}
