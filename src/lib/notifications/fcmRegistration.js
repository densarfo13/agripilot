/**
 * fcmRegistration.js — frontend FCM token registration helper.
 *
 *   const result = await registerForPush({
 *     messaging,                          // firebase getMessaging() instance
 *     vapidKey:    import.meta.env.VITE_FCM_VAPID_PUBLIC_KEY,
 *     persistToken: (t) => apiPost('/api/v2/notifications/token', { token: t }),
 *   });
 *   if (result.ok) console.log('push ready');
 *
 * Contract
 * ────────
 *   • All SDK refs are INJECTED — this module doesn't import the
 *     firebase package directly. That keeps the bundle clean when
 *     FCM isn't wired yet (ops attaches it via the host app), and
 *     lets tests run without the SDK installed.
 *   • Returns { ok, token, reason } — never throws.
 *   • Gracefully degrades on Safari, blocked-permission, missing
 *     service-worker support, missing vapidKey, etc. Caller falls
 *     back to in-app notifications when ok=false.
 *   • Permission flow: only requests Notification permission when
 *     the current state is 'default' — never re-prompts on 'denied'
 *     (that would surface as a permission popup the user already
 *     said no to).
 *
 * Required runtime preconditions (provided by the host app):
 *   • A 'firebase-messaging-sw.js' service worker registered at the
 *     site root with the FCM scope.
 *   • A vapidKey from the Firebase console (Web Push certificates).
 *
 * Required env (frontend build):
 *   VITE_FCM_VAPID_PUBLIC_KEY
 *   VITE_FCM_PROJECT_ID
 *   VITE_FCM_API_KEY
 *   VITE_FCM_APP_ID
 *   VITE_FCM_MESSAGING_SENDER_ID
 */

// ─── Result factory ──────────────────────────────────────────

function _result(extra) {
  return Object.freeze({
    ok:     false,
    token:  null,
    reason: null,
    ...extra,
  });
}

// ─── Capability checks ──────────────────────────────────────

function _isSecureContext() {
  try {
    if (typeof window === 'undefined') return false;
    // Some browsers (mobile Safari pre-iOS 16.4) don't support web push
    // at all. Detect via the Notification + ServiceWorker globals.
    if (typeof window.Notification === 'undefined') return false;
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return false;
    return true;
  } catch { return false; }
}

function _currentPermission() {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  } catch { return 'unsupported'; }
}

async function _requestPermission() {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    const result = await Notification.requestPermission();
    return result || 'default';
  } catch { return 'denied'; }
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Register the current device for push notifications. Returns a
 * structured outcome — never throws.
 *
 * @param {object} input
 * @param {object} input.messaging         — firebase getMessaging() instance
 * @param {string} input.vapidKey
 * @param {(token: string) => Promise<any>} [input.persistToken]
 *                                          — caller persists the token
 *                                            (usually POST to /api/v2/notifications/token)
 * @returns {Promise<{ ok: boolean, token: string|null, reason: string|null }>}
 */
export async function registerForPush(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const messaging = safe.messaging;
  const vapidKey  = safe.vapidKey;
  const persistToken = (typeof safe.persistToken === 'function') ? safe.persistToken : null;

  if (!_isSecureContext()) {
    return _result({ reason: 'unsupported_browser' });
  }
  if (!messaging || typeof messaging.getToken !== 'function') {
    return _result({ reason: 'messaging_unavailable' });
  }
  if (!vapidKey || typeof vapidKey !== 'string') {
    return _result({ reason: 'missing_vapid_key' });
  }

  // ── Permission ─────────────────────────────────────────────
  const permission = await _requestPermission();
  if (permission === 'denied' || permission === 'unsupported') {
    return _result({ reason: 'permission_denied' });
  }
  if (permission !== 'granted') {
    return _result({ reason: 'permission_dismissed' });
  }

  // ── Token ──────────────────────────────────────────────────
  let token = null;
  try {
    token = await messaging.getToken({ vapidKey });
  } catch {
    return _result({ reason: 'token_failed' });
  }
  if (!token || typeof token !== 'string') {
    return _result({ reason: 'no_token' });
  }

  // ── Persist ────────────────────────────────────────────────
  if (persistToken) {
    try {
      await persistToken(token);
    } catch {
      // Token works locally; backend save failed. We still consider
      // this a successful local register so push CAN fire — the
      // caller decides whether to retry the persist or fall back.
      return _result({ ok: true, token, reason: 'persist_failed' });
    }
  }

  return _result({ ok: true, token });
}

/**
 * Read-only current permission state. Returns one of:
 *   'granted' | 'denied' | 'default' | 'unsupported'
 *
 * Surfaces use this to decide whether to render the "Allow
 * notifications" CTA or skip it entirely.
 *
 * @returns {string}
 */
export function getCurrentPushPermission() {
  return _currentPermission();
}

/**
 * Whether the current environment can support web push at all.
 * Use this to gate the registration UI entirely on unsupported
 * browsers (e.g. older Safari).
 *
 * @returns {boolean}
 */
export function isPushCapable() {
  return _isSecureContext();
}

export default {
  registerForPush,
  getCurrentPushPermission,
  isPushCapable,
};
