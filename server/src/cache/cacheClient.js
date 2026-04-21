/**
 * cacheClient.js — Redis-backed key/value cache with in-memory
 * fallback so services never block on Redis being down.
 *
 *   get(key)                   → value | null
 *   set(key, value, { ttlSec }) → boolean
 *   del(key)                   → boolean
 *   delByPrefix(prefix)        → number (keys removed; memory only)
 *   ping()                     → 'redis' | 'memory' | 'disabled'
 *
 * Contract:
 *   • `REDIS_URL` unset → in-memory LRU (1000 keys, default TTL 5 min)
 *   • Redis connection errors never throw — they downgrade the
 *     session to memory for the rest of its life so the next call
 *     doesn't wait on a failing TCP handshake
 *   • Values are JSON-serialized so cache keys can carry objects
 *   • Keys are auto-prefixed with `farroway:cache:` so we can share
 *     the Redis instance with other services safely
 *
 * ioredis is loaded dynamically — not a hard dependency. Install
 * with `npm install ioredis` when ready to turn Redis on; before
 * that, the memory backend keeps every caller working.
 */

const KEY_PREFIX = 'farroway:cache:';
const MEMORY_MAX = 1000;
const DEFAULT_TTL_SEC = 300; // 5 minutes

// ─── Memory backend ──────────────────────────────────────────────
// Map<key, { value: string, expiresAt: number }>
const memStore = new Map();
let memHits = 0;
let memMisses = 0;

function memPrune(now = Date.now()) {
  // Remove expired entries first, then LRU-trim if we're still over cap.
  for (const [k, v] of memStore.entries()) {
    if (v.expiresAt && v.expiresAt <= now) memStore.delete(k);
  }
  while (memStore.size > MEMORY_MAX) {
    const firstKey = memStore.keys().next().value;
    if (firstKey == null) break;
    memStore.delete(firstKey);
  }
}

function memGet(key) {
  const v = memStore.get(key);
  if (!v) { memMisses += 1; return null; }
  if (v.expiresAt && v.expiresAt <= Date.now()) {
    memStore.delete(key);
    memMisses += 1;
    return null;
  }
  // Touch to refresh LRU position.
  memStore.delete(key);
  memStore.set(key, v);
  memHits += 1;
  return v.value;
}

function memSet(key, value, ttlSec) {
  const ttl = Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec : DEFAULT_TTL_SEC;
  memStore.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  memPrune();
  return true;
}

// ─── Redis backend (dynamically loaded) ──────────────────────────
let redisClient = null;
let redisReady  = false;
let redisFailed = false;

async function getRedisClient() {
  if (redisFailed) return null;
  if (redisClient && redisReady) return redisClient;
  if (!process.env.REDIS_URL) return null;
  try {
    // Dynamic import so the package is optional.
    const mod = await import('ioredis');
    const Redis = mod.default || mod.Redis || mod;
    redisClient = new Redis(process.env.REDIS_URL, {
      // Keep error surface quiet — we downgrade silently.
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
      connectTimeout: 2000,
    });
    redisClient.on('error', () => {
      // Single flag — any error downgrades the session to memory.
      if (!redisFailed) {
        redisFailed = true;
        redisReady = false;
      }
    });
    await new Promise((resolve) => {
      if (redisClient.status === 'ready') return resolve();
      redisClient.once('ready', resolve);
      setTimeout(resolve, 2000); // caller falls through on timeout
    });
    redisReady = redisClient.status === 'ready';
    return redisReady ? redisClient : null;
  } catch {
    redisFailed = true;
    return null;
  }
}

function ensureKey(key) {
  return `${KEY_PREFIX}${String(key)}`;
}

// ─── Public API ──────────────────────────────────────────────────

export async function get(key) {
  const k = ensureKey(key);
  const redis = await getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(k);
      if (raw == null) return null;
      return JSON.parse(raw);
    } catch {
      // Fall through to memory.
    }
  }
  const raw = memGet(k);
  return raw == null ? null : safeParse(raw);
}

export async function set(key, value, { ttlSec } = {}) {
  const k = ensureKey(key);
  let raw;
  try { raw = JSON.stringify(value); }
  catch { return false; }
  const ttl = Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec : DEFAULT_TTL_SEC;

  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.set(k, raw, 'EX', ttl);
      return true;
    } catch {
      // fall through
    }
  }
  return memSet(k, raw, ttl);
}

export async function del(key) {
  const k = ensureKey(key);
  const redis = await getRedisClient();
  if (redis) {
    try { await redis.del(k); } catch { /* fall through */ }
  }
  return memStore.delete(k);
}

/**
 * delByPrefix — best-effort pattern delete. In memory mode it walks
 * the Map; in Redis mode it uses SCAN + DEL batched. Returns the
 * number of memory keys removed (Redis count is opaque).
 */
export async function delByPrefix(prefix) {
  const fullPrefix = ensureKey(prefix);
  const redis = await getRedisClient();
  if (redis) {
    try {
      const stream = redis.scanStream({ match: `${fullPrefix}*`, count: 100 });
      const batch = [];
      await new Promise((resolve) => {
        stream.on('data', (keys) => { for (const key of keys) batch.push(key); });
        stream.on('end', resolve);
        stream.on('error', resolve);
      });
      if (batch.length > 0) await redis.del(...batch);
    } catch { /* fall through */ }
  }
  let removed = 0;
  for (const k of Array.from(memStore.keys())) {
    if (k.startsWith(fullPrefix)) { memStore.delete(k); removed += 1; }
  }
  return removed;
}

export async function ping() {
  if (!process.env.REDIS_URL) return 'disabled';
  const redis = await getRedisClient();
  if (!redis) return 'memory';
  try {
    const pong = await redis.ping();
    return pong === 'PONG' ? 'redis' : 'memory';
  } catch { return 'memory'; }
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── Test hooks ──────────────────────────────────────────────────
export const _internal = Object.freeze({
  KEY_PREFIX, MEMORY_MAX, DEFAULT_TTL_SEC,
  memStore, memPrune,
  getStats: () => ({ hits: memHits, misses: memMisses, size: memStore.size }),
  resetStats: () => { memHits = 0; memMisses = 0; },
  clearAll: () => {
    memStore.clear();
    memHits = 0;
    memMisses = 0;
  },
  resetRedis: () => {
    try { if (redisClient && typeof redisClient.disconnect === 'function') redisClient.disconnect(); } catch {}
    redisClient = null;
    redisReady  = false;
    redisFailed = false;
  },
});
