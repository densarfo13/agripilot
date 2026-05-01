/**
 * analyticsStore.js — generic event + feedback log on top of
 * localStorage.
 *
 * Position in the codebase
 * ────────────────────────
 * Sister to (NOT replacement for) `src/lib/analytics.js` — that
 * module is the canonical pipeline that POSTs events to the
 * server when reachable. This module captures EVERY call locally
 * so pilot operators can inspect raw event streams on-device,
 * and the new feedback widgets have a single store to write to.
 *
 * Why both
 *   • Server pipeline can be unreachable in pilot conditions; we
 *     still want a tap-by-tap record on the device.
 *   • The feedback widgets need a typed store with stable keys
 *     for QuickFeedback / PulseQuestion responses.
 *   • Future-API: when `/api/feedback` and `/api/events` exist,
 *     this module flushes upward; until then it's the canonical
 *     local source.
 *
 * Storage keys (NEW — distinct from the existing `farroway.*`
 * dotted keys used by store/farrowayLocal.js)
 *   farroway_events    → AnalyticsEvent[]    (cap 300)
 *   farroway_feedback  → FeedbackEntry[]     (cap 300)
 *
 * Strict-rule audit
 *   • Never throws. Quota / private-mode / corrupt JSON all
 *     degrade silently — the worst case is a single missed write.
 *   • Bounded local growth (300 events × ~200 bytes ≈ 60 KB).
 *   • Best-effort forward to `safeTrackEvent` from the canonical
 *     pipeline so server-side analytics still receive everything
 *     this module records.
 */

const EVENTS_KEY   = 'farroway_events';
const FEEDBACK_KEY = 'farroway_feedback';
const MAX_KEPT     = 300;

/**
 * @typedef {Object} AnalyticsEvent
 * @property {string} name
 * @property {object} [payload]
 * @property {string} timestamp   ISO
 *
 * @typedef {Object} FeedbackEntry
 * @property {string} type        e.g. 'quick_feedback' | 'feedback_reason' | 'pulse_feedback'
 * @property {string} [context]   e.g. 'daily_plan'
 * @property {string} [value]     e.g. 'yes' | 'no'
 * @property {string} [text]      open-ended text
 * @property {string} timestamp   ISO
 */

function _isoNow() {
  try { return new Date().toISOString(); }
  catch { return ''; }
}

function _readList(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _writeList(key, list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(list.slice(-MAX_KEPT)));
  } catch { /* quota / private mode — ignore */ }
}

function _forwardSafeTrack(name, payload) {
  // Lazy-import to keep this module safely importable from any
  // module load order. Failure is silent — the local log is
  // already persisted.
  try {
    import('../lib/analytics.js')
      .then((mod) => {
        try { mod.safeTrackEvent?.(name, payload); }
        catch { /* never propagate */ }
      })
      .catch(() => { /* swallow */ });
  } catch { /* never propagate */ }
}

/**
 * Record a generic event. Spec name; the canonical pipeline gets
 * a parallel notification via `safeTrackEvent`.
 *
 * @param {string} name
 * @param {object} [payload]   short, JSON-serializable bag
 */
export function trackEvent(name, payload = {}) {
  if (!name || typeof name !== 'string') return;
  let safePayload;
  try {
    safePayload = payload && typeof payload === 'object'
      ? JSON.parse(JSON.stringify(payload))
      : {};
  } catch { safePayload = { __unserialisable: true }; }

  const event = {
    name,
    payload:   safePayload,
    timestamp: _isoNow(),
  };

  const list = _readList(EVENTS_KEY);
  list.push(event);
  _writeList(EVENTS_KEY, list);

  _forwardSafeTrack(name, safePayload);
}

/**
 * Persist a feedback entry. The shape is intentionally loose so
 * the various feedback widgets (QuickFeedback / PulseQuestion /
 * future surfaces) can write without a schema migration.
 *
 * @param {object} feedback
 */
export function saveFeedback(feedback) {
  if (!feedback || typeof feedback !== 'object') return;
  let safeFeedback;
  try { safeFeedback = JSON.parse(JSON.stringify(feedback)); }
  catch { safeFeedback = { __unserialisable: true }; }

  const entry = {
    ...safeFeedback,
    timestamp: _isoNow(),
  };

  const list = _readList(FEEDBACK_KEY);
  list.push(entry);
  _writeList(FEEDBACK_KEY, list);

  // Mirror to the canonical pipeline so server-side dashboards
  // get the signal too.
  _forwardSafeTrack('feedback_recorded', {
    type:    safeFeedback.type || 'unknown',
    context: safeFeedback.context || null,
    value:   safeFeedback.value || null,
  });
}

/** Read-only snapshots — for debug screens and the admin tile. */
export function getEvents()   { return _readList(EVENTS_KEY); }
export function getFeedback() { return _readList(FEEDBACK_KEY); }

/** Wipe both logs. Server-pushed copies (when wired) live elsewhere. */
export function clearAnalyticsLogs() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(EVENTS_KEY);
    localStorage.removeItem(FEEDBACK_KEY);
  } catch { /* ignore */ }
}

/**
 * summariseFeedback — for the admin dashboard. Counts feedback
 * entries by `value` ('yes' | 'no') and by `context`.
 */
export function summariseFeedback() {
  const list = _readList(FEEDBACK_KEY);
  const byValue = new Map();
  const byContext = new Map();
  let yesCount = 0, noCount = 0, reasonCount = 0;
  for (const e of list) {
    if (!e) continue;
    if (e.value)   byValue.set(e.value, (byValue.get(e.value) || 0) + 1);
    if (e.context) byContext.set(e.context, (byContext.get(e.context) || 0) + 1);
    if (e.value === 'yes') yesCount += 1;
    if (e.value === 'no')  noCount  += 1;
    if (e.type === 'feedback_reason') reasonCount += 1;
  }
  return {
    total:       list.length,
    yesCount,
    noCount,
    reasonCount,
    byValue:     Object.fromEntries(byValue),
    byContext:   Object.fromEntries(byContext),
    helpfulPct:  (yesCount + noCount) > 0
      ? Math.round((yesCount / (yesCount + noCount)) * 100)
      : null,
  };
}

export default {
  trackEvent,
  saveFeedback,
  getEvents,
  getFeedback,
  summariseFeedback,
  clearAnalyticsLogs,
};
