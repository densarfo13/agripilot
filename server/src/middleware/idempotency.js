/**
 * Idempotency Key Middleware
 *
 * Provides network-retry safety for mutation endpoints.
 * If a client sends `X-Idempotency-Key: <uuid>` on a POST/PATCH/PUT request,
 * the server caches the response and returns it on subsequent retries with the
 * same key, instead of executing the handler again.
 *
 * This is complementary to the dedup guard (which prevents rapid double-clicks).
 * Idempotency keys protect against network failures where the client doesn't know
 * if the server received and processed the request.
 *
 * Design:
 * - In-memory TTL cache (10 minutes), bounded to prevent leaks
 * - Keys are scoped per user (userId + key) to prevent cross-user collisions
 * - Only caches successful responses (2xx) — errors are retryable
 * - GET requests are always idempotent, so this only applies to mutations
 */

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 5000;
const cache = new Map(); // "userId:key" → { status, body, expiresAt }

function cleanExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) cache.delete(key);
  }
}

/**
 * Middleware: check for X-Idempotency-Key header and return cached response if available.
 * For new keys, intercepts res.json to capture the response for caching.
 */
export function idempotencyCheck(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'];
  if (!idempotencyKey) return next();

  // Only apply to mutation methods
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();

  const userId = req.user?.sub || 'anon';
  const cacheKey = `${userId}:${idempotencyKey}`;
  const now = Date.now();

  // Check cache
  const existing = cache.get(cacheKey);
  if (existing && now < existing.expiresAt) {
    // Check if request is currently in-flight (being processed)
    if (existing.inFlight) {
      return res.status(409).json({
        error: 'This request is currently being processed. Please wait.',
      });
    }
    // Return cached response with header indicating it's a replay
    res.set('X-Idempotency-Replayed', 'true');
    return res.status(existing.status).json(existing.body);
  }

  // Mark as in-flight
  cache.set(cacheKey, { inFlight: true, expiresAt: now + 30000 }); // 30s in-flight timeout

  // Lazy cleanup
  if (cache.size > MAX_ENTRIES) cleanExpired();

  // Intercept res.json to capture the response for caching
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    // Only cache successful responses (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cache.set(cacheKey, {
        status: res.statusCode,
        body,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    } else {
      // Failed — remove in-flight marker so request can be retried
      cache.delete(cacheKey);
    }
    return originalJson(body);
  };

  // Clean up in-flight marker if response errors or closes early
  res.on('close', () => {
    const entry = cache.get(cacheKey);
    if (entry?.inFlight) cache.delete(cacheKey);
  });

  next();
}

// For testing
export function clearIdempotencyCache() {
  cache.clear();
}
