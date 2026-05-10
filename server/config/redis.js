/**
 * server/config/redis.js — Redis client (lazy, boot-safe).
 *
 * Behaviour
 *   • When REDIS_URL is unset → every export resolves to null.
 *     Every caller MUST null-check; nothing crashes on boot.
 *     The productionRuntime banner already reports "Redis:
 *     disabled" alongside the other graceful-fallback services.
 *   • When REDIS_URL is set → returns a singleton client that
 *     auto-reconnects on its own schedule. The connect() is
 *     fire-and-forget; it does NOT block module evaluation. If
 *     the URL is bad, the client surfaces the error via its
 *     'error' event — we log it once in dev and swallow in prod
 *     so the wider server keeps serving requests.
 *
 * Strict-rule audit
 *   • NO top-level await — module evaluation must never block on
 *     a network call. The previous version's `await redis.connect()`
 *     at the top level would crash the boot loop on a fresh
 *     deploy with no REDIS_URL set (which is the safe-fallback
 *     case the productionRuntime contract demands).
 *   • Single-flight: the client + the in-flight connect promise
 *     are memoised so a hot path that re-imports the module
 *     doesn't open a second socket.
 *   • Pure / never throws. Failure paths return null.
 *
 *   import redis, { getRedis, isRedisConfigured } from '../config/redis.js';
 *
 *   const client = await getRedis();        // null when not configured
 *   if (!client) return inMemoryFallback();
 *   await client.set('key', 'value');
 */

import { createClient } from 'redis';

let _client = null;
let _connectPromise = null;
let _failed = false;

function _readUrl() {
  try {
    const u = process.env.REDIS_URL;
    return typeof u === 'string' && u.trim().length > 0 ? u.trim() : null;
  } catch { return null; }
}

/**
 * Returns the lazily-connected client, or null when REDIS_URL
 * is unset / the connect has failed. Never throws.
 */
export async function getRedis() {
  if (_failed) return null;
  const url = _readUrl();
  if (!url) return null;

  if (_client) return _client;
  if (_connectPromise) return _connectPromise;

  _connectPromise = (async () => {
    try {
      const client = createClient({ url });
      client.on('error', (err) => {
        // Only log the first error per process — repeated reconnect
        // failures would otherwise spam Railway logs.
        if (!_failed) {
          _failed = true;
          try {
            // eslint-disable-next-line no-console
            console.warn('[Redis] error:', err && err.message ? err.message : err);
          } catch { /* swallow */ }
        }
      });
      client.on('connect', () => {
        try {
          if (process.env.NODE_ENV !== 'test') {
            // eslint-disable-next-line no-console
            console.log('[Redis] Connected');
          }
        } catch { /* swallow */ }
      });
      await client.connect();
      _client = client;
      return _client;
    } catch (err) {
      _failed = true;
      _connectPromise = null;
      try {
        // eslint-disable-next-line no-console
        console.warn('[Redis] connect failed:', err && err.message ? err.message : err);
      } catch { /* swallow */ }
      return null;
    }
  })();

  return _connectPromise;
}

/**
 * Synchronous accessor — returns the already-connected client OR
 * null. Never triggers a connect.
 */
export function tryGetRedisSync() {
  return _client;
}

/**
 * True when the operator has configured REDIS_URL. Does NOT
 * confirm the connection is live — use getRedis() for that.
 */
export function isRedisConfigured() {
  return _readUrl() != null;
}

// Default export retained for back-compat with the prior file's
// `import redis from '../config/redis.js'` pattern. The export is
// the helper namespace (NOT the raw client) so callers explicitly
// await getRedis() instead of consuming a possibly-null direct
// client.
const _module = { getRedis, tryGetRedisSync, isRedisConfigured };
export default _module;
