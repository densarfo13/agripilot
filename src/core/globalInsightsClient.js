/**
 * globalInsightsClient.js — read-side fetcher for the Global
 * Insights Layer (data moat §1).
 *
 * Pairs with `localInsightSync.js` (the write side). This module
 * fetches scored insight rows for the current farmer's context
 * and caches the result for 24 hours so the dailyPlanEngine
 * reorder hook is cheap on every refresh.
 *
 * Public API
 * ──────────
 *   fetchInsights(context, { apiClient, force? })
 *     • returns the array of insight rows on success
 *     • returns `null` on API failure (caller's local rules
 *       continue unchanged — never crash the plan)
 *     • respects the privacy opt-out (returns `null` when off)
 *
 *   getCachedInsights(context)
 *     • returns the cached array (or null) without making a
 *       network call. Useful for the synchronous plan-engine
 *       hook that can't await.
 *
 *   clearInsightsCache()
 *     • drops every cached entry. Called by the privacy reset
 *       and by the auth-logout path so a different user starting
 *       on the same device doesn't see the previous user's hint.
 *
 * Cache key
 * ─────────
 *   Composed of the four context fields, with empty filters
 *   collapsed to a stable token. The cache is namespaced under
 *   `farroway:insights:cache:<key>` and expires after 24h.
 */

const CACHE_PREFIX = 'farroway:insights:cache:';
const TTL_MS       = 24 * 60 * 60 * 1000;
const PRIVACY_KEY  = 'farroway:helpImproveRecommendations';

function _isOptedOut() {
  try {
    if (typeof localStorage === 'undefined') return false;
    // Default: opted IN. Only opt-out when explicitly set "false".
    return localStorage.getItem(PRIVACY_KEY) === 'false';
  } catch { return false; }
}

function _ckey(ctx = {}) {
  const r  = String(ctx.region      || '*').toLowerCase();
  const c  = String(ctx.cropOrPlant || '*').toLowerCase();
  const s  = String(ctx.setup       || '*').toLowerCase();
  const co = String(ctx.condition   || '*').toLowerCase();
  return `${CACHE_PREFIX}${r}|${c}|${s}|${co}`;
}

function _readCache(ctx) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(_ckey(ctx));
    if (!raw) return null;
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch {
      try { localStorage.removeItem(_ckey(ctx)); } catch { /* ignore */ }
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.insights)) return null;
    if (!Number.isFinite(parsed.cachedAt)) return null;
    if (Date.now() - parsed.cachedAt > TTL_MS) {
      try { localStorage.removeItem(_ckey(ctx)); } catch { /* ignore */ }
      return null;
    }
    return parsed.insights;
  } catch { return null; }
}

function _writeCache(ctx, insights) {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = JSON.stringify({ cachedAt: Date.now(), insights });
    localStorage.setItem(_ckey(ctx), payload);
  } catch { /* quota / private mode — ignore */ }
}

/**
 * Synchronous cache read. Plan engine uses this on every render
 * tick because it must return immediately.
 */
export function getCachedInsights(context) {
  if (_isOptedOut()) return null;
  return _readCache(context || {});
}

/**
 * Async fetch with cache. Hits localStorage first; on miss,
 * calls `GET /api/insights?...` via the supplied `apiClient`.
 * On any network / parsing failure returns `null` so the caller
 * (plan engine) can fall back to local rules — the spec's
 * "no crash if API fails" rule.
 *
 * @param {object} context  { region?, cropOrPlant?, setup?, condition? }
 * @param {object} [opts]
 * @param {object} opts.apiClient  axios-like { get(path, opts?) => Promise }
 * @param {boolean} [opts.force]   bypass cache + always hit network
 * @returns {Promise<Array|null>}
 */
export async function fetchInsights(context = {}, opts = {}) {
  if (_isOptedOut()) return null;
  if (!opts.force) {
    const cached = _readCache(context);
    if (cached) return cached;
  }
  const apiClient = opts.apiClient;
  if (!apiClient || typeof apiClient.get !== 'function') return null;

  // Build query params, omit blanks so the server's filter shape
  // matches the cache key.
  const params = {};
  if (context.region)      params.region      = context.region;
  if (context.cropOrPlant) params.cropOrPlant = context.cropOrPlant;
  if (context.setup)       params.setup       = context.setup;
  if (context.condition)   params.condition   = context.condition;
  if (Number.isFinite(context.limit)) params.limit = context.limit;

  try {
    const res = await apiClient.get('/insights', { params });
    const body = (res && res.data) ? res.data : res || {};
    const list = Array.isArray(body.insights) ? body.insights : null;
    if (!list) return null;
    _writeCache(context, list);
    return list;
  } catch (err) {
    try { console.warn('[insights fetch failed]', err && err.message); }
    catch { /* ignore */ }
    return null;
  }
}

/**
 * Drop every cached insight payload. Called by:
 *   • clearLocalActivityData() in privacy reset
 *   • auth logout path
 *   • opting out of "Help improve recommendations"
 */
export function clearInsightsCache() {
  try {
    if (typeof localStorage === 'undefined') return;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch { /* ignore */ }
}

/**
 * getConfidenceLabel(insight) — spec §4.
 *   shown >= 100 → high
 *   shown >= 20  → medium
 *   below 20     → low
 *
 * Mirrors the server's `service.query` confidence computation so
 * a client that hasn't received a `confidence` field (e.g. an
 * older cached entry) can derive one from `shown` alone.
 *
 * Defensive: any non-finite or negative `shown` collapses to 'low'.
 */
export function getConfidenceLabel(insight) {
  const shown = Number(insight && insight.shown);
  if (!Number.isFinite(shown) || shown < 0) return 'low';
  if (shown >= 100) return 'high';
  if (shown >= 20)  return 'medium';
  return 'low';
}

export const _internal = Object.freeze({
  CACHE_PREFIX, TTL_MS, PRIVACY_KEY,
  _ckey, _isOptedOut,
});
