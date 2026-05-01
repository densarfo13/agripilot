/**
 * regionAnalytics.js — minimal event tracker for the Region UX
 * System rollout.
 *
 * Why this exists
 * ───────────────
 * The spec calls for a small, dedicated tracker so we can
 * answer "is the new region routing actually firing in the
 * pilot?" without grepping through generic analytics events.
 * The existing `safeTrackEvent` (`src/lib/analytics.js`) stays
 * the canonical pipeline for product analytics; this file
 * piggybacks on it for the durable forward path AND keeps a
 * 200-entry rolling local log for offline visibility (the
 * pilot field officer can show the slate on the device when
 * the network is down).
 *
 * Strict-rule audit
 *   • Never throws. Every storage / forward call is wrapped.
 *   • Bounded local storage (last 200 events) so the slot
 *     never grows unbounded.
 *   • PII safe: callers pass payloads — this module does not
 *     read user state. Refusal-to-log on payload shape errors.
 *
 * Public API
 * ──────────
 *   trackRegionUXEvent(eventName, payload)
 *   getRecordedRegionEvents()              // for debug screens
 *   clearRecordedRegionEvents()
 *
 * Event names (spec §12)
 *   region_detected
 *   region_banner_shown
 *   region_banner_dismissed
 *   fallback_region_used
 *   backyard_experience_used
 *   farm_experience_used
 *   generic_experience_used
 */

const STORAGE_KEY = 'farroway_region_events';
const MAX_KEPT = 200;

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR */ }
  return false;
}

function _safeReadList() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWriteList(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_KEPT)));
  } catch { /* quota / private mode — ignore */ }
}

function _forward(eventName, payload) {
  // Best-effort handoff to the canonical analytics pipeline.
  // Lazy dynamic import keeps this file safely importable from
  // pure-JS modules (e.g. dailyIntelligenceEngine) without
  // pulling in the analytics graph at load time.
  try {
    import('../lib/analytics.js')
      .then((mod) => {
        try { mod.safeTrackEvent?.(eventName, payload); }
        catch { /* never propagate */ }
      })
      .catch(() => { /* swallow */ });
  } catch { /* never propagate */ }
}

/**
 * @param {string} eventName  one of the spec §12 names
 * @param {object} [payload]  short, JSON-serializable bag
 * @returns {void}
 */
export function trackRegionUXEvent(eventName, payload = {}) {
  if (!eventName || typeof eventName !== 'string') return;
  let safePayload;
  try {
    // Guarantee the stored payload round-trips through JSON;
    // anything that doesn't (functions, cycles) is dropped to
    // a placeholder so the rest of the event still records.
    safePayload = payload && typeof payload === 'object'
      ? JSON.parse(JSON.stringify(payload))
      : {};
  } catch {
    safePayload = { __unserialisable: true };
  }

  const event = {
    eventName,
    payload:   safePayload,
    timestamp: (() => { try { return new Date().toISOString(); } catch { return ''; } })(),
  };

  if (_isDev()) {
    try { console.log('[RegionUX Analytics]', event); } catch { /* ignore */ }
  }

  // Local rolling log (bounded).
  const list = _safeReadList();
  list.push(event);
  _safeWriteList(list);

  // Forward to the canonical analytics pipeline.
  _forward(eventName, safePayload);
}

/** Read-only snapshot of the local rolling log (debug tool). */
export function getRecordedRegionEvents() {
  return _safeReadList();
}

/** Wipe the local rolling log. Does NOT touch the canonical pipeline. */
export function clearRecordedRegionEvents() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

export default {
  trackRegionUXEvent,
  getRecordedRegionEvents,
  clearRecordedRegionEvents,
};
