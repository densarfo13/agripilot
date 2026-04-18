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

/**
 * @param {Object} args
 * @param {string} args.farmId
 * @param {Function} args.fetcher          async () => { tasks, completedCount }
 * @param {boolean} [args.isOnline]        passed from NetworkContext when available
 * @returns {Promise<Object>}
 */
export async function loadTasksSafe({ farmId, fetcher, isOnline = true } = {}) {
  if (!farmId || typeof fetcher !== 'function') {
    return fallbackResult({ canRetry: !!fetcher, reason: 'missing_args' });
  }

  // Short-circuit when we already know we're offline — don't spam
  // failing requests. Go straight to cache.
  if (!isOnline) {
    const cached = getCachedTasks(farmId);
    if (cached) return cachedResult(cached);
    return fallbackResult({ canRetry: true, reason: 'offline_no_cache' });
  }

  try {
    const data = await fetcher();
    const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
    const completedCount = Number.isFinite(data?.completedCount) ? data.completedCount : 0;
    cacheTasks(farmId, tasks, { completedCount });
    return {
      mode: 'online',
      tasks,
      completedCount,
      bannerMessageKey: null,
      lastUpdatedAt: Date.now(),
      canRetry: true,
      source: 'online',
    };
  } catch (err) {
    // Dev-only trace — never reaches farmer UI.
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[loadTasksSafe] fetch failed, falling back', err?.message);
    }
    const cached = getCachedTasks(farmId);
    if (cached) return cachedResult(cached);
    return fallbackResult({ canRetry: true, reason: 'fetch_failed_no_cache' });
  }
}

function cachedResult(cached) {
  return {
    mode: 'offline_with_cache',
    tasks: cached.tasks || [],
    completedCount: cached.completedCount || 0,
    bannerMessageKey: 'offline.showingCached',
    lastUpdatedAt: cached.updatedAt || null,
    canRetry: true,
    source: 'cache',
  };
}

function fallbackResult({ canRetry = true, reason = 'fallback' } = {}) {
  return {
    mode: 'offline_no_cache_fallback',
    tasks: [],
    completedCount: 0,
    bannerMessageKey: 'offline.rightNow',
    lastUpdatedAt: null,
    canRetry,
    source: 'fallback',
    reason,
  };
}

/**
 * Shape of the safe fallback task rendered when no cache exists.
 * Exposed so the Tasks screen can render it without inventing copy.
 */
export function getFallbackTodayAction() {
  return {
    id: 'offline_fallback_today',
    titleKey: 'offline.fallback.title',
    whyKey: 'offline.fallback.why',
    nextKey: 'offline.fallback.next',
    ctaKey: 'offline.tryAgain',
    icon: '\uD83C\uDF3E',
    source: 'fallback',
  };
}
