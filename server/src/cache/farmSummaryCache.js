/**
 * farmSummaryCache.js — typed wrappers around cacheClient for
 * common admin/NGO read paths.
 *
 * Keys:
 *   farm:<farmId>:summary           — per-farm risk + activity roll-up
 *   dashboard:<program|all>:ngo     — NGO program dashboard payload
 *   dashboard:<program|all>:impact  — impact reporting payload
 *
 * TTLs are deliberately short (2-5 min) so the dashboard never
 * serves stale numbers for long, but long enough that a burst of
 * tab refreshes doesn't hammer the DB.
 *
 *   getOrCompute(key, loader, { ttlSec })
 *     — the canonical pattern: serve cached value if present, else
 *       call `loader()`, cache + return. A loader throw is cached
 *       for a short negative-TTL window so retries are paced.
 */

import * as cache from './cacheClient.js';

const TTL = Object.freeze({
  FARM_SUMMARY:       3 * 60, // 3 min
  DASHBOARD_NGO:      2 * 60,
  DASHBOARD_IMPACT:   5 * 60,
  NEGATIVE:           30,      // failed loaders cached briefly
});

function farmSummaryKey(farmId) {
  return `farm:${String(farmId)}:summary`;
}
function dashboardNgoKey(scope = 'all') {
  return `dashboard:${String(scope)}:ngo`;
}
function dashboardImpactKey(scope = 'all') {
  return `dashboard:${String(scope)}:impact`;
}

/**
 * getOrCompute — standard cache-aside helper.
 *   cacheKey: string
 *   loader:   () => Promise<value>  (or sync returning value)
 *   ttlSec:   optional override
 *
 * A loader throw records a short-lived error marker so the caller
 * doesn't retry-hammer a broken DB on every tab refresh.
 */
export async function getOrCompute(cacheKey, loader, { ttlSec } = {}) {
  if (!cacheKey || typeof loader !== 'function') return null;
  const cached = await cache.get(cacheKey);
  if (cached && !cached.__err) return cached;
  if (cached && cached.__err && Number.isFinite(cached.expiresAt) && cached.expiresAt > Date.now()) {
    // Negative cache active — skip the loader this cycle.
    return null;
  }
  try {
    const value = await loader();
    await cache.set(cacheKey, value, { ttlSec });
    return value;
  } catch (err) {
    await cache.set(cacheKey, {
      __err: true,
      message: err && err.message ? err.message : 'loader_failed',
      expiresAt: Date.now() + TTL.NEGATIVE * 1000,
    }, { ttlSec: TTL.NEGATIVE });
    return null;
  }
}

// ─── Typed wrappers ──────────────────────────────────────────────

export async function getFarmSummary(farmId, loader) {
  return getOrCompute(farmSummaryKey(farmId), loader, {
    ttlSec: TTL.FARM_SUMMARY,
  });
}
export async function invalidateFarmSummary(farmId) {
  return cache.del(farmSummaryKey(farmId));
}

export async function getNgoDashboard(scope, loader) {
  return getOrCompute(dashboardNgoKey(scope || 'all'), loader, {
    ttlSec: TTL.DASHBOARD_NGO,
  });
}
export async function invalidateNgoDashboard(scope) {
  if (scope) return cache.del(dashboardNgoKey(scope));
  return cache.delByPrefix('dashboard:');
}

export async function getImpactReport(scope, loader) {
  return getOrCompute(dashboardImpactKey(scope || 'all'), loader, {
    ttlSec: TTL.DASHBOARD_IMPACT,
  });
}
export async function invalidateImpactReport(scope) {
  if (scope) return cache.del(dashboardImpactKey(scope));
  return cache.delByPrefix('dashboard:');
}

export const _internal = Object.freeze({
  TTL, farmSummaryKey, dashboardNgoKey, dashboardImpactKey,
});
