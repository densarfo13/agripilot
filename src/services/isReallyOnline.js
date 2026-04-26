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
// HOTFIX (Apr 2026): switched from `/api/ping` to a guaranteed
// static asset. Pilot console screenshot showed the deployed
// server returns 404 on /api/ping, which:
//   • spammed the browser's network log every 5s,
//   • caused the offline-queue auto-flush to falsely think we
//     were offline and refuse to drain the queue.
// `/manifest.json` is part of the PWA shell — every deployed
// build serves it (verified in public/). HEAD against it is a
// proper reachability probe that works without any new backend
// endpoint, satisfying the "no backend changes" strict rule.
const PING_URL = '/manifest.json';

let lastCheck = { at: 0, ok: null };
// Surface a one-time dev warning when the ping endpoint 404s so
// the team knows to deploy it; suppress repeated noise after the
// first hit.
let _pingMissingWarned = false;

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
    // HOTFIX (Apr 2026): per pilot console screenshot, the deployed
    // server may not have /api/ping (404). The previous logic
    // treated any non-2xx as "offline", which:
    //   • spammed every 5-second auto-flush tick with 404 fetches,
    //   • caused the offline queue to refuse to drain even though
    //     the server WAS reachable,
    //   • surfaced as user-visible console errors.
    //
    // A reachable server (any HTTP response — including 4xx — proves
    // TCP/TLS/HTTP layers are alive) means we're "really online" for
    // the purpose of this probe. Only network failures / aborts /
    // timeouts (the catch branch) and 5xx (server down) imply real
    // offline.
    const status = res && Number.isFinite(res.status) ? res.status : 0;
    const ok =
      !!res &&
      status >= 100 &&        // got any response → server reachable
      status < 500;            // 5xx is server-down; treat as offline
    if (status === 404 && !_pingMissingWarned) {
      _pingMissingWarned = true;
      try {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[isReallyOnline] ' + url + ' → 404. Server reachable but ping endpoint missing — treating as online. Deploy a 200/204 ping to silence this warning.');
        }
      } catch { /* never propagate */ }
    }
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
