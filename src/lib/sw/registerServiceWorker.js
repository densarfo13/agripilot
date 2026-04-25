/**
 * registerServiceWorker.js — boot-time SW registration with
 * "new version available" detection.
 *
 *   registerServiceWorker({ onNewVersion?, onActivated? })
 *     → Promise<{ ok: boolean, registration?, code? }>
 *
 *   Callbacks
 *     onNewVersion(reload)  — fires when a fresh SW finishes
 *                             installing AND an old SW already
 *                             controls the page. Pass `reload()` so
 *                             the UI's "Reload to update" button
 *                             can immediately activate the new SW.
 *     onActivated(version)  — fires when the active SW posts the
 *                             `farroway:sw_activated` message; the
 *                             `version` arg is the baked
 *                             package.json version + build hash.
 *
 * Behaviour
 *   • Skips registration outside browsers / when SW is unsupported.
 *   • Polls the registration every 60 minutes for a new SW so apps
 *     left open all day eventually pick up a deploy without needing
 *     a hard reload.
 *   • Never throws — every error is caught and surfaced via the
 *     resolved `{ ok: false, code }` result.
 */

const REGISTRATION_PATH = '/sw.js';
const POLL_INTERVAL_MS  = 60 * 60 * 1000;   // 1 hour

export async function registerServiceWorker({
  onNewVersion = null,
  onActivated  = null,
} = {}) {
  if (typeof window === 'undefined') return { ok: false, code: 'no_window' };
  if (!('serviceWorker' in navigator)) return { ok: false, code: 'unsupported' };

  let registration;
  try {
    registration = await navigator.serviceWorker.register(REGISTRATION_PATH);
  } catch (err) {
    return { ok: false, code: 'register_failed',
              message: err && err.message };
  }

  // Listen for the activation broadcast the SW posts on every
  // activate event. Lets the UI know the baked version of the live
  // SW (helpful for debugging "is the deploy live yet?").
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event && event.data;
    if (!data || data.type !== 'farroway:sw_activated') return;
    if (typeof onActivated === 'function') {
      try { onActivated(data.version); } catch { /* never propagate */ }
    }
  });

  // "New version available" hook — fires when an updatefound + new
  // installing SW transitions to `installed` while a controller
  // already exists (so this isn't the first install).
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state !== 'installed') return;
      if (!navigator.serviceWorker.controller) return;
      if (typeof onNewVersion !== 'function') return;
      try {
        onNewVersion(() => activateAndReload(registration));
      } catch { /* never propagate */ }
    });
  });

  // Periodic poll so a long-running tab eventually picks up a fresh
  // deploy. The browser will fetch the SW, byte-compare it, and
  // fire 'updatefound' when the build differs.
  if (typeof setInterval === 'function') {
    setInterval(() => {
      try { registration.update(); } catch { /* ignore */ }
    }, POLL_INTERVAL_MS);
  }

  return { ok: true, registration };
}

/**
 * activateAndReload(registration)
 *   Helper invoked from the "Reload to update" button. Tells the
 *   waiting SW to skipWaiting + then reloads the page so the new
 *   bundle takes over.
 */
function activateAndReload(registration) {
  const waiting = registration && registration.waiting;
  if (waiting) {
    try { waiting.postMessage({ type: 'farroway:skip_waiting' }); }
    catch { /* ignore */ }
  }
  if (typeof location !== 'undefined') {
    setTimeout(() => location.reload(), 50);
  }
}

export const _internal = Object.freeze({ activateAndReload, POLL_INTERVAL_MS });
