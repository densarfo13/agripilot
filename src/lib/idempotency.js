/**
 * Idempotency key generation and caching.
 *
 * Each mutation gets a stable UUID. If the same logical action is retried
 * (offline queue replay, network retry), the SAME key is sent so the server
 * can detect duplicates and return 409 instead of creating a second record.
 *
 * Keys are scoped by entity + action + a caller-provided discriminator
 * (e.g., farmId + taskId for task completion).
 *
 * Storage: in-memory Map + localStorage backup (survives page reload).
 * Keys auto-expire after 7 days (matches offlineQueue EXPIRY_MS).
 */

const STORAGE_KEY = 'farroway:idempotency';
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** In-memory cache (fast reads). Backed by localStorage on write. */
let _cache = null;

function _load() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _cache = raw ? JSON.parse(raw) : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

function _save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache || {}));
  } catch { /* quota exceeded — keys still in memory */ }
}

/**
 * Generate a UUID v4 (crypto-safe when available).
 * @returns {string}
 */
function _uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Get or create an idempotency key for a specific mutation.
 *
 * The key is stable: calling this again with the same scope returns
 * the same UUID, so retries carry the same key.
 *
 * @param {string} entityType - e.g., 'task_completion', 'harvest', 'cost', 'profile', 'stage'
 * @param {string} discriminator - Unique ID for this specific action, e.g., `${farmId}:${taskId}`
 * @returns {string} UUID idempotency key
 */
export function getIdempotencyKey(entityType, discriminator) {
  const cache = _load();
  const scope = `${entityType}:${discriminator}`;

  const existing = cache[scope];
  if (existing && (Date.now() - existing.ts) < EXPIRY_MS) {
    return existing.key;
  }

  // Generate new key
  const key = _uuid();
  cache[scope] = { key, ts: Date.now() };
  _save();
  return key;
}

/**
 * Mark an idempotency key as consumed (mutation confirmed by server).
 * Removes it from the cache so future actions with the same scope
 * generate a fresh key.
 *
 * @param {string} entityType
 * @param {string} discriminator
 */
export function consumeIdempotencyKey(entityType, discriminator) {
  const cache = _load();
  const scope = `${entityType}:${discriminator}`;
  delete cache[scope];
  _save();
}

/**
 * Purge expired idempotency keys.
 * Called periodically (e.g., on app startup).
 */
export function purgeExpiredKeys() {
  const cache = _load();
  const now = Date.now();
  let changed = false;
  for (const scope of Object.keys(cache)) {
    if ((now - cache[scope].ts) > EXPIRY_MS) {
      delete cache[scope];
      changed = true;
    }
  }
  if (changed) _save();
}

/**
 * Get count of active (non-expired) idempotency keys.
 * Useful for diagnostics.
 * @returns {number}
 */
export function activeKeyCount() {
  const cache = _load();
  const now = Date.now();
  return Object.values(cache).filter(e => (now - e.ts) < EXPIRY_MS).length;
}
