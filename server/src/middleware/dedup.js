/**
 * Duplicate submission guard for workflow actions.
 *
 * Prevents accidental double-clicks from triggering the same workflow action twice.
 * Uses an in-memory set of "user+action+resourceId" keys with a short TTL.
 *
 * This is a UI-safety net, NOT a replacement for optimistic locking (which handles
 * true race conditions at the DB level). This just short-circuits the obvious case
 * of the same user hitting the same button twice within a few seconds.
 *
 * Bounded to MAX_ENTRIES to prevent memory leaks. Old entries are cleaned lazily.
 */
const DEDUP_TTL_MS = 5_000; // 5 seconds
const MAX_ENTRIES = 2000;
const inflight = new Map(); // key → expiresAt

function cleanExpired() {
  const now = Date.now();
  for (const [key, expiresAt] of inflight) {
    if (now > expiresAt) inflight.delete(key);
  }
}

/**
 * Middleware factory for dedup protection on POST workflow actions.
 * @param {string} actionName - e.g. 'submit', 'approve', 'score-verification'
 */
export function dedupGuard(actionName) {
  return (req, res, next) => {
    const userId = req.user?.sub;
    const resourceId = req.params.id;
    if (!userId || !resourceId) return next(); // no dedup without user+resource

    const key = `${userId}:${actionName}:${resourceId}`;
    const now = Date.now();

    // Check for in-flight duplicate
    const expiresAt = inflight.get(key);
    if (expiresAt && now < expiresAt) {
      return res.status(409).json({
        error: 'This action is already being processed. Please wait a moment before retrying.',
      });
    }

    // Mark as in-flight
    inflight.set(key, now + DEDUP_TTL_MS);

    // Lazy cleanup when map grows too large
    if (inflight.size > MAX_ENTRIES) cleanExpired();

    // Remove key after response completes (success or failure)
    res.on('finish', () => {
      inflight.delete(key);
    });

    next();
  };
}

// For testing
export function clearDedupCache() {
  inflight.clear();
}
