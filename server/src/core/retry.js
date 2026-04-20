/**
 * retry.js — network-resilience helper for external API calls
 * (payments, weather, SMS).
 *
 *   retry(fn, { retries, backoffMs, shouldRetry })
 *
 * Defaults: retries = 3, backoffMs = (attempt) => 100 * 2 ** attempt
 * (100ms, 200ms, 400ms).
 *
 * shouldRetry(err, attempt) defaults to true for every error
 * except AbortError and permanent 4xx status errors (400, 401,
 * 403, 404). Caller can override for payment-safety (e.g. never
 * retry an auth failure).
 *
 * Pure — no timers other than setTimeout, no external deps.
 */

const DEFAULT_PERMANENT_STATUSES = new Set([400, 401, 403, 404, 409, 422]);

function defaultShouldRetry(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return false;
  const status = err.status || err.statusCode
    || (err.response && err.response.status);
  if (Number.isFinite(status) && DEFAULT_PERMANENT_STATUSES.has(Number(status))) {
    return false;
  }
  return true;
}

function defaultBackoff(attempt) {
  return 100 * Math.pow(2, attempt);
}

async function retry(fn, opts = {}) {
  const maxRetries = Number.isFinite(opts.retries) ? opts.retries : 3;
  const backoff    = typeof opts.backoffMs === 'function' ? opts.backoffMs : defaultBackoff;
  const shouldRetry = typeof opts.shouldRetry === 'function' ? opts.shouldRetry : defaultShouldRetry;
  if (typeof fn !== 'function') throw new Error('retry: fn must be a function');

  let attempt = 0;
  let lastErr = null;
  while (attempt <= maxRetries) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries) break;
      if (!shouldRetry(err, attempt)) break;
      const delay = Math.max(0, backoff(attempt) || 0);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr;
}

const _internal = { defaultShouldRetry, defaultBackoff };
export { retry, _internal };
export default { retry, _internal };
