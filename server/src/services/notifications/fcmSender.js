/**
 * fcmSender.js — calm-push sender for Firebase Cloud Messaging.
 *
 *   await sendCalmPush({
 *     userId,
 *     token,
 *     title:       'Rain expected later',
 *     body:        'Water earlier today.',
 *     dedupeKey:   'risk_fungal:2026-05-12',
 *     clickAction: '/today',
 *   });
 *
 * Contract
 * ────────
 *   • Daily cap: at most 2 pushes per user per local day (spec rule).
 *   • Quiet hours: no pushes between 22:00 and 06:00 local time
 *     (configurable; default per spec convention).
 *   • Dedupe: a dedupeKey already sent today returns
 *     { delivered: false, fallback: false, reason: 'duplicate' }
 *     and the caller surfaces it as an in-app notification only.
 *   • Send-failure fallback: when the FCM SDK rejects (bad token,
 *     network, quota), returns { fallback: true } so the caller
 *     can surface the same content as an in-app notification.
 *   • Never throws. Returns a structured outcome object every time.
 *   • SDK is INJECTED so this code path tests cleanly without a
 *     real Firebase admin SDK installed — ops swaps in the real
 *     adapter when AMBEE_API_KEY-equivalent FCM credentials land
 *     in env.
 *
 * Spec wording examples (the caller composes; this module only
 * enforces the rails):
 *   "Rain expected later. Water earlier today."
 *   "Check lower leaves tomorrow morning."
 *   "Your scan needs a follow-up check."
 *
 * Required env (for the real SDK adapter, when wired):
 *   FCM_PROJECT_ID
 *   FCM_CLIENT_EMAIL
 *   FCM_PRIVATE_KEY          (multi-line; escape newlines as \\n)
 *   FCM_VAPID_PUBLIC_KEY     (also exposed to the frontend build)
 */

// ─── Defaults ────────────────────────────────────────────────

export const DEFAULT_DAILY_CAP        = 2;
export const DEFAULT_QUIET_START_HR   = 22;   // 22:00 → 06:00 local
export const DEFAULT_QUIET_END_HR     = 6;
export const DEFAULT_DEDUPE_TTL_MS    = 24 * 60 * 60 * 1000;

// ─── In-process tracking (replace with Redis / DB in real prod) ──

const _dailyCount = new Map();   // `${userId}:${YYYY-MM-DD}` → count
const _dedupeLog  = new Map();   // `${userId}:${dedupeKey}` → expiresAt

/** Test helper — wipe in-memory tracking. */
export function _resetFcmTracking() {
  _dailyCount.clear();
  _dedupeLog.clear();
}

function _dayKey(userId, nowMs) {
  const d = new Date(nowMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${userId}:${yyyy}-${mm}-${dd}`;
}

function _isInQuietHours(nowMs, startHr, endHr, timezoneOffsetMinutes) {
  // Default: server-local time. Caller can pass timezoneOffsetMinutes
  // from the user's profile so quiet hours respect their local clock.
  const localMs = (typeof timezoneOffsetMinutes === 'number')
    ? nowMs + timezoneOffsetMinutes * 60 * 1000
    : nowMs;
  const hour = new Date(localMs).getUTCHours();
  if (startHr <= endHr) {
    // Same-day window (e.g. 22 → 6 doesn't apply, but defensive).
    return hour >= startHr && hour < endHr;
  }
  // Wrap-around window (22 → 6 means "after 22 OR before 6").
  return hour >= startHr || hour < endHr;
}

// ─── Helpers ──────────────────────────────────────────────────

function _safeStr(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
}

function _outcome(extra) {
  return Object.freeze({
    delivered: false,
    fallback:  false,
    reason:    null,
    ...extra,
  });
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Send a calm push notification subject to the rails.
 *
 * @param {object} input
 * @param {string} input.userId
 * @param {string} input.token              — FCM device token
 * @param {string} input.title
 * @param {string} input.body
 * @param {string} input.dedupeKey          — caller-supplied stable key
 * @param {string} [input.clickAction]      — frontend route to open
 * @param {object} [options]
 * @param {object} [options.fcmSdk]         — injected admin SDK
 *                                              (with .send(message))
 * @param {number} [options.nowMs]
 * @param {number} [options.timezoneOffsetMinutes]
 * @param {number} [options.dailyCap=2]
 * @param {number} [options.quietStartHr=22]
 * @param {number} [options.quietEndHr=6]
 * @param {boolean} [options.bypassQuietHours]
 * @returns {Promise<{ delivered: boolean, fallback: boolean, reason: string|null }>}
 */
export async function sendCalmPush(input, options) {
  const safe = (input && typeof input === 'object') ? input : {};
  const opts = (options && typeof options === 'object') ? options : {};
  const nowMs = (typeof opts.nowMs === 'number') ? opts.nowMs : Date.now();

  const userId = _safeStr(safe.userId);
  const token  = _safeStr(safe.token);
  const title  = _safeStr(safe.title);
  const body   = _safeStr(safe.body);
  const dedupeKey = _safeStr(safe.dedupeKey);

  // ── 1. Validate required fields ────────────────────────────
  if (!userId || !token || !title || !body || !dedupeKey) {
    return _outcome({ reason: 'invalid_input' });
  }

  // ── 2. Dedupe ──────────────────────────────────────────────
  const dKey = `${userId}:${dedupeKey}`;
  const dEntry = _dedupeLog.get(dKey);
  if (dEntry && dEntry > nowMs) {
    return _outcome({ reason: 'duplicate' });
  }

  // ── 3. Quiet hours ─────────────────────────────────────────
  const quietStart = (typeof opts.quietStartHr === 'number') ? opts.quietStartHr : DEFAULT_QUIET_START_HR;
  const quietEnd   = (typeof opts.quietEndHr === 'number')   ? opts.quietEndHr   : DEFAULT_QUIET_END_HR;
  if (!opts.bypassQuietHours
      && _isInQuietHours(nowMs, quietStart, quietEnd, opts.timezoneOffsetMinutes)) {
    return _outcome({ fallback: true, reason: 'quiet_hours' });
  }

  // ── 4. Daily cap ───────────────────────────────────────────
  const dailyCap = (typeof opts.dailyCap === 'number') ? opts.dailyCap : DEFAULT_DAILY_CAP;
  const dayKey = _dayKey(userId, nowMs);
  const todayCount = _dailyCount.get(dayKey) || 0;
  if (todayCount >= dailyCap) {
    return _outcome({ fallback: true, reason: 'daily_cap' });
  }

  // ── 5. Send via injected SDK ───────────────────────────────
  const sdk = opts.fcmSdk;
  if (!sdk || typeof sdk.send !== 'function') {
    return _outcome({ fallback: true, reason: 'no_sdk' });
  }

  const message = {
    token,
    notification: { title, body },
    data: {
      dedupeKey,
      clickAction: _safeStr(safe.clickAction) || '/',
    },
    webpush: {
      fcmOptions: {
        link: _safeStr(safe.clickAction) || '/',
      },
    },
  };

  try {
    await sdk.send(message);
  } catch {
    // Send failed — caller falls back to in-app notification.
    return _outcome({ fallback: true, reason: 'send_failed' });
  }

  // ── 6. Persist counters (best-effort) ─────────────────────
  _dailyCount.set(dayKey, todayCount + 1);
  _dedupeLog.set(dKey, nowMs + DEFAULT_DEDUPE_TTL_MS);

  return _outcome({ delivered: true });
}

/**
 * Read-only helper for diagnostics + tests. Returns the count of
 * notifications already sent to the user today.
 *
 * @param {string} userId
 * @param {number} [nowMs]
 * @returns {number}
 */
export function getDailyCount(userId, nowMs) {
  if (!userId) return 0;
  return _dailyCount.get(_dayKey(userId, nowMs || Date.now())) || 0;
}

export default {
  sendCalmPush,
  getDailyCount,
  _resetFcmTracking,
  DEFAULT_DAILY_CAP,
  DEFAULT_QUIET_START_HR,
  DEFAULT_QUIET_END_HR,
};
