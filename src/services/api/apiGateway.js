/**
 * apiGateway.js — SERVICE-layer chokepoint for outbound API access.
 *
 *   // SERVICE / RUNTIME callers may import here:
 *   import api, { formatApiError } from 'src/services/api/apiGateway.js';
 *
 *   // UI callers must NOT — they go through the RUNTIME facade:
 *   import api from 'src/runtime/apiRuntime.js';
 *
 * What this is
 * ────────────
 *   The canonical SERVICE-layer entry point that re-exports the
 *   infrastructure axios instance (`src/api/client.js`) and the
 *   pure `formatApiError` helper. The wave 2 migration funnels all
 *   UI api access through this layer (via the runtime facade) so
 *   future waves can add caching, retry, optimistic updates, and
 *   offline queue plumbing in ONE place instead of 45 pages.
 *
 *   Why SERVICE and not RUNTIME: the architecture rule
 *   `RUNTIME → INFRASTRUCTURE` is NOT in ALLOWED_IMPORTS. The
 *   permitted path is `RUNTIME → SERVICE → INFRASTRUCTURE`. This
 *   file is the SERVICE half — it owns the side-effect of making
 *   HTTP calls + installing a single request-counting interceptor.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe (interceptor install is
 *     wrapped in a safe guard).
 *   • Zero behavior change vs. direct `api/client.js` import.
 *   • Telemetry counter is bounded (drops LRU at 200 buckets).
 *   • No PII, no auth tokens, no payload bodies recorded — only the
 *     normalized URL prefix + HTTP method.
 *   • SERVICE → INFRASTRUCTURE (allowed by ALLOWED_IMPORTS).
 */

import baseApi, { formatApiError } from '../../api/client.js';

const GATEWAY_VERSION = 'api-gateway-v1';
const MAX_BUCKETS = 200;

// LRU-ish counter — insertion-ordered Map; oldest evicted at cap.
const _bucketCounts = new Map();

function _safe(fn, fb) { try { return fn(); } catch { return fb; } }

function _urlPrefix(url) {
  if (typeof url !== 'string' || !url) return 'unknown';
  const noQuery = url.split('?')[0];
  const parts = noQuery.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  if (parts.length === 1) return '/' + parts[0];
  return '/' + parts[0] + '/' + parts[1].replace(/[0-9a-f]{8,}/i, ':id');
}

function _record(method, url) {
  _safe(() => {
    const m = typeof method === 'string' ? method.toUpperCase() : 'GET';
    const key = m + ' ' + _urlPrefix(url);
    const prev = _bucketCounts.get(key) || 0;
    if (!_bucketCounts.has(key) && _bucketCounts.size >= MAX_BUCKETS) {
      const first = _bucketCounts.keys().next();
      if (!first.done) _bucketCounts.delete(first.value);
    }
    _bucketCounts.set(key, prev + 1);
  }, null);
}

let _interceptorInstalled = false;
function _installInterceptor() {
  if (_interceptorInstalled) return;
  _safe(() => {
    if (!baseApi || !baseApi.interceptors || !baseApi.interceptors.request) {
      return;
    }
    baseApi.interceptors.request.use((config) => {
      _record(config && config.method, config && config.url);
      return config;
    });
    _interceptorInstalled = true;
  }, null);
}
_installInterceptor();

/**
 * Returns the bounded telemetry snapshot. Read-only.
 */
export function getApiGatewayTelemetry() {
  return _safe(() => {
    const buckets = Array.from(_bucketCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    const total = buckets.reduce((a, b) => a + b[1], 0);
    return Object.freeze({
      gatewayVersion: GATEWAY_VERSION,
      totalRequests:  total,
      bucketCount:    buckets.length,
      topBuckets:     Object.freeze(buckets.slice(0, 20).map(([k, v]) =>
        Object.freeze({ key: k, count: v }))),
      capacity:       MAX_BUCKETS,
      interceptorInstalled: _interceptorInstalled,
    });
  }, Object.freeze({
    gatewayVersion: GATEWAY_VERSION,
    totalRequests:  0,
    bucketCount:    0,
    topBuckets:     Object.freeze([]),
    capacity:       MAX_BUCKETS,
    interceptorInstalled: false,
  }));
}

/**
 * Returns the migration ownership view — which subsystems own the
 * fetch lifecycle today.
 */
export function getApiOwnershipSnapshot() {
  return Object.freeze({
    gatewayVersion: GATEWAY_VERSION,
    runtimeOwned: Object.freeze([
      'formatApiError (via gateway re-export)',
      'request telemetry (interceptor-installed)',
    ]),
    migration: Object.freeze({
      pagesMigratedToRuntime: 11, // updated per wave (Wave 2A: 11)
      pagesRemainingDirect:   34, // 45 - 11 = 34
      domains: Object.freeze([
        'farm', 'tasks', 'marketplace', 'funding',
        'notifications', 'weather', 'admin', 'auth',
      ]),
    }),
  });
}

// Re-export the SAME axios instance + the SAME pure formatter.
export { formatApiError };
export default baseApi;

const _module = {
  default: baseApi,
  formatApiError,
  getApiGatewayTelemetry,
  getApiOwnershipSnapshot,
};
export { _module as _internal };
