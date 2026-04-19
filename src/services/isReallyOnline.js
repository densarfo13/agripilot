/**
 * isReallyOnline — reachability check that's more honest than navigator.onLine.
 *
 * Spec §6: `navigator.onLine` returns true for captive portals, VPN
 * handshakes, and "connected but no internet" states. Before we trust
 * a retry, ping a lightweight endpoint with a short timeout. If the
 * ping fails, treat the device as offline regardless of what the
 * browser says.
 *
 * Zero-dependency, cache the last result briefly so button mashing
 * doesn't flood the network.
 */

const DEFAULT_TIMEOUT_MS = 3500;
const CACHE_TTL_MS = 8000;
const PING_URL = '/api/ping';

let lastCheck = { at: 0, ok: null };

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * @param {Object} [opts]
 * @param {string} [opts.url]         endpoint to HEAD; defaults to /api/ping
 * @param {number} [opts.timeoutMs]   abort ping after this many ms
 * @param {boolean} [opts.bypassCache] skip the short in-memory cache
 * @returns {Promise<boolean>}
 */
export async function isReallyOnline(opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const url = typeof opts.url === 'string' && opts.url ? opts.url : PING_URL;

  // Cheap short-circuit: browser says offline → trust it.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  // Cache so mashing the retry button doesn't fan out.
  const now = Date.now();
  if (!opts.bypassCache && now - lastCheck.at < CACHE_TTL_MS && lastCheck.ok !== null) {
    return lastCheck.ok;
  }

  try {
    const res = await withTimeout(
      fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'omit',
      }),
      timeoutMs,
    );
    const ok = !!(res && (res.ok || res.status === 204 || res.status === 304));
    lastCheck = { at: now, ok };
    return ok;
  } catch {
    lastCheck = { at: now, ok: false };
    return false;
  }
}

export function _resetIsReallyOnlineCache() {
  lastCheck = { at: 0, ok: null };
}
