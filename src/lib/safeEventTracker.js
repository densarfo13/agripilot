/**
 * safeEventTracker.js — lightweight pilot event tracker.
 *
 *   import { trackSafeEvent } from './lib/safeEventTracker.js';
 *   trackSafeEvent('task_completed', { taskTitle: 'Check drainage' });
 *
 * Contract
 *   • Fire-and-forget: callers NEVER await this. The POST runs
 *     asynchronously so it cannot block render or user interaction.
 *   • Five permitted event types only (allow-list enforced):
 *       app_opened · task_viewed · task_completed
 *       weather_loaded · weather_fallback_used
 *   • Validates before sending — drops invalid events with a
 *     one-time console.warn per invalid key. Does NOT enqueue.
 *   • 400 from /api/events → permanent drop, no retry.
 *   • Network / timeout / 5xx → max 1 retry, then drop silently.
 *   • Kill switch: localStorage.farroway_disable_events = 'true'.
 *   • Feature flag: FEATURE_EVENT_SYNC must be enabled.
 *
 * Why no offline queue
 *   The original /api/events 400-loop was caused by the offline
 *   queue's backoff-retry path hitting a permanently-malformed
 *   payload repeatedly. This module skips the queue entirely:
 *   every event is a one-shot POST (max one retry). A miss is
 *   silently dropped — pilot stability > completeness.
 *
 * Strict-rule audit
 *   • No React. No hooks. Pure module-level singleton.
 *   • All localStorage / fetch / window access wrapped in
 *     try/catch — safe in SSR and locked-down browsers.
 *   • Nothing from this module ever propagates (outermost catch).
 *   • No global mutable state except the warn-once Set and the
 *     anonymous-id cache, both intentional.
 */

import { isFeatureEnabled } from '../utils/featureFlags.js';

// ─── Allow-list ───────────────────────────────────────────────
export const ALLOWED_EVENTS = Object.freeze(new Set([
  'app_opened',
  'task_viewed',
  'task_completed',
  'weather_loaded',
  'weather_fallback_used',
]));

// ─── Storage keys ─────────────────────────────────────────────
const KILL_KEY = 'farroway_disable_events';   // runtime kill switch
const ANON_KEY = 'farroway_anon_id';          // anonymous session id

// ─── HTTP config ──────────────────────────────────────────────
const ENDPOINT   = '/api/events';
const TIMEOUT_MS = 8_000;

// ─── Warn-once registry ──────────────────────────────────────
// Key format: '<eventType>:<failureReason>'. Warns at most once
// per (type, reason) pair across the lifetime of the page.
const _warnedKeys = new Set();
function _warnOnce(key, ...args) {
  if (_warnedKeys.has(key)) return;
  _warnedKeys.add(key);
  try {
    // eslint-disable-next-line no-console
    console.warn('[safeEventTracker]', ...args);
  } catch { /* swallow */ }
}

// ─── Kill switch ──────────────────────────────────────────────
function _isKilled() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(KILL_KEY) === 'true';
  } catch { return false; }
}

// ─── Identity helpers ────────────────────────────────────────
function _readUserId() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem('farroway_user_profile')
             || window.localStorage.getItem('farroway_user');
    if (!raw) return null;
    const p = JSON.parse(raw);
    return (p && typeof p === 'object' && (p.id || p.userId || p.uuid)) || null;
  } catch { return null; }
}

/**
 * Reads or mints a stable anonymous session ID. Stored in
 * localStorage so it survives page reloads (but NOT across
 * devices / incognito resets — privacy-safe by design).
 */
function _readOrMintAnonId() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    let id = window.localStorage.getItem(ANON_KEY);
    if (id) return id;
    id = (typeof globalThis.crypto !== 'undefined'
          && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : ('anon-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));
    try { window.localStorage.setItem(ANON_KEY, id); } catch { /* quota */ }
    return id;
  } catch { return null; }
}

// ─── Validation ──────────────────────────────────────────────
/**
 * Returns an error-key string when the event is invalid,
 * null when it is valid.
 *
 * Required fields (spec §1):
 *   type          — string, non-empty, in ALLOWED_EVENTS
 *   timestamp     — finite number (ms epoch)
 *   payload       — plain object (not array, not null)
 *   userId OR anonymousId — at least one identity present
 *
 * @param {{ type, timestamp, payload, userId, anonymousId }} event
 * @returns {string|null}
 */
function _validate(event) {
  if (typeof event.type !== 'string' || !event.type.trim()) {
    return 'missing_type';
  }
  if (typeof event.timestamp !== 'number' || !Number.isFinite(event.timestamp)) {
    return 'missing_timestamp';
  }
  if (!event.payload
      || typeof event.payload !== 'object'
      || Array.isArray(event.payload)) {
    return 'missing_payload';
  }
  if (!event.userId && !event.anonymousId) {
    return 'missing_identity';
  }
  return null;
}

// ─── HTTP transport ───────────────────────────────────────────
/**
 * Fire one POST to /api/events.
 *
 * @returns {Promise<'ok'|'drop'>}
 *   'drop' — 400: payload permanently invalid, do not retry.
 *   'ok'   — 2xx success.
 * @throws on network error / timeout / 5xx so the caller can retry.
 */
async function _postOnce(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    try { controller.abort(); } catch { /* swallow */ }
  }, TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:        JSON.stringify(body),
      signal:      controller.signal,
      credentials: 'same-origin',
      cache:       'no-store',
    });
    // 400 → permanent validation failure — resolve as 'drop'
    // so the caller knows not to retry.
    if (res.status === 400) return 'drop';
    // Any non-2xx other than 400 → throw so the retry path runs.
    if (!res.ok) throw new Error('http_' + res.status);
    return 'ok';
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ──────────────────────────────────────────────
/**
 * trackSafeEvent — fire-and-forget pilot event.
 *
 * Returns undefined immediately. The actual network call runs
 * asynchronously in a microtask. Callers must NOT await this.
 *
 * @param {string}  type          One of ALLOWED_EVENTS.
 * @param {object} [extraPayload] Optional key-value pairs merged
 *                                into the event payload.
 */
export function trackSafeEvent(type, extraPayload) {
  // Schedule in a microtask so this is truly non-blocking.
  void Promise.resolve().then(async () => {
    try {
      // ── Early exits (synchronous, no network) ────────────
      if (typeof window === 'undefined') return;   // SSR
      if (_isKilled()) return;                     // runtime kill switch
      if (!ALLOWED_EVENTS.has(type)) return;       // not in allow-list
      if (!isFeatureEnabled('FEATURE_EVENT_SYNC')) return; // flag off

      // ── Build event ───────────────────────────────────────
      const userId      = _readUserId();
      const anonymousId = userId ? null : _readOrMintAnonId();

      const event = {
        type,
        timestamp:   Date.now(),
        payload:     (extraPayload
                      && typeof extraPayload === 'object'
                      && !Array.isArray(extraPayload))
                       ? extraPayload
                       : {},
        userId,
        anonymousId,
      };

      // ── Validate (client-side, before any network call) ───
      const validationErr = _validate(event);
      if (validationErr) {
        _warnOnce(
          type + ':' + validationErr,
          'dropping invalid event "' + type + '" —', validationErr,
        );
        return;
      }

      // ── Compose server-side payload ───────────────────────
      // Server shape: { name, payload, timestamp }
      // Anonymous ID goes into the payload so the admin metrics
      // aggregator can count unique anonymous users without
      // requiring auth.
      const body = {
        name:      event.type,
        payload:   event.anonymousId
                     ? { ...event.payload, anonymousId: event.anonymousId }
                     : { ...event.payload },
        timestamp: event.timestamp,
      };

      // ── Send — max 1 retry on non-400 failure ─────────────
      let outcome;
      try {
        outcome = await _postOnce(body);
      } catch {
        // First attempt failed (network / timeout / 5xx).
        // One retry only — then drop silently.
        try {
          outcome = await _postOnce(body);
        } catch {
          // Second failure → drop. No queue, no loop.
          return;
        }
      }

      // 400 on either attempt → already 'drop' — nothing to do.
      void outcome;

    } catch {
      // Outermost guard: nothing from this module ever propagates.
    }
  });
}

// ─── Test hook ────────────────────────────────────────────────
export const _internal = Object.freeze({
  ALLOWED_EVENTS,
  KILL_KEY,
  ANON_KEY,
  TIMEOUT_MS,
  _isKilled,
  _validate,
});

export default trackSafeEvent;
