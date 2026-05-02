/**
 * analytics.js — spec-shaped analytics service for the
 * Farroway data moat (Data Moat Layer §1).
 *
 *   import { trackEvent } from '../core/analytics.js';
 *
 *   trackEvent('task_completed', {
 *     // Caller-supplied event-specific bits:
 *     taskId, taskType, durationMs,
 *   });
 *
 *   // The service automatically enriches the payload with the
 *   // spec's wider shape:
 *   //   { userId, activeExperience, gardenId, farmId,
 *   //     cropOrPlant, country, region, growingSetup,
 *   //     farmSizeCategory, weatherSummary, timestamp }
 *
 * Tracked events (from spec §1):
 *   daily_open · task_shown · task_completed · task_skipped
 *   scan_started · scan_completed · scan_failed
 *   health_feedback_submitted · onboarding_completed
 *
 * Why enrich here, not at the call sites
 * ──────────────────────────────────────
 * The call sites (DailyPlanCard, ScanPage, QuickFarmSetup,
 * etc.) shouldn't have to plumb 10 fields through every
 * trackEvent call. The service reads the active context once
 * via contextResolver and merges it into every payload. The
 * caller passes only what's specific to the event.
 *
 * Crash safety (spec §1)
 * ──────────────────────
 * Every step is wrapped in try/catch:
 *   • Context enrichment fails →  send the bare payload
 *   • eventStore write fails    →  legacy mirror still tries
 *   • analyticsStore mirror fails → eventStore already landed
 *   • Both fail                 →  return null, no exception
 * The function never throws. Callers can wrap in their own
 * try/catch if they want, but they don't have to.
 *
 * Coexists with src/analytics/analyticsStore.js
 * ─────────────────────────────────────────────
 * The legacy analyticsStore stays as the secondary mirror so
 * existing surfaces (admin Daily Intelligence Usage card, NGO
 * impact dashboards) keep working without code changes.
 * eventStore is the canonical store going forward — it's what
 * userMemory + insightAggregator read.
 */

import { saveEvent } from './eventStore.js';
import { trackEvent as legacyTrackEvent } from '../analytics/analyticsStore.js';
// Server-sync mirror (Data Moat Layer follow-up). Event writes
// ALSO land on the lightweight offline queue when
// FEATURE_EVENT_SYNC is on; the App.jsx 5s tick drains the
// queue against the server endpoint (api.post('/events',
// payload)). The flag stays OFF at default so we don't
// enqueue doomed POSTs against a route that doesn't exist
// yet. When the server endpoint ships, flipping the flag is
// the only step needed; existing local events stay readable
// on-device for the insightAggregator + admin surfaces.
import { addToQueue } from '../offline/offlineQueue.js';
import { isFeatureEnabled } from '../utils/featureFlags.js';

// Spec §1 event allow-list. Keys are the canonical event
// names; trackEvent silently warns (in dev) when called with
// an unknown name so a typo doesn't fan out as a quietly-
// dropped event. Production never warns; the event still
// lands in the store.
const KNOWN_EVENTS = new Set([
  'daily_open',
  'task_shown',
  'task_completed',
  'task_skipped',
  'scan_started',
  'scan_completed',
  'scan_failed',
  'health_feedback_submitted',
  'onboarding_completed',
  // Adjacent events the existing surfaces already fire.
  // These aren't in the spec list but we accept them so the
  // legacy callers (setup_garden_completed, listing_expiry_sweep)
  // don't get warned about.
  'setup_garden_completed',
  'setup_farm_completed',
  'app_open',
  'listing_expiry_sweep',
]);

// Reasonable cap on the weather-summary string the enriched
// payload carries. We only need 'rainy', 'humid', 'hot', 'dry',
// 'windy', or null — never a full forecast object.
const WEATHER_SUMMARY_MAX = 12;

/**
 * Read the active context (userId / experience / gardenId /
 * farmId / etc.) once per call. Lazy-imported below so a
 * circular import or a broken context module never silences
 * the trackEvent call: the bare payload still lands.
 */
function _readActiveContext() {
  try {
    // We use the existing core/contextResolver which already
    // handles missing/legacy storage shapes + never throws.
    // Lazy-required so the analytics module can be imported
    // before contextResolver is ready (boot-time call sites).
    // Since this is ESM, dynamic import returns a promise —
    // but trackEvent is fire-and-forget, so we read from a
    // local cache that the FIRST call populates.
    return _getCachedContext();
  } catch { return {}; }
}

let _cachedCtx = null;
let _ctxLoadStarted = false;
function _getCachedContext() {
  if (_cachedCtx) return _cachedCtx;
  if (_ctxLoadStarted) return {};
  _ctxLoadStarted = true;
  try {
    // Synchronous-ish: import the module once + cache its
    // resolveUserContext output. Subsequent calls re-read
    // localStorage on every invocation (cheap) so a context
    // change mid-session (e.g. user switches farms) reflects
    // in events fired afterwards.
    import('./contextResolver.js')
      .then((mod) => {
        _cachedCtx = mod && typeof mod.resolveUserContext === 'function'
          ? () => {
              try { return mod.resolveUserContext(); } catch { return {}; }
            }
          : (() => ({}));
      })
      .catch(() => { _cachedCtx = (() => ({})); });
  } catch { _cachedCtx = (() => ({})); }
  // First call before the dynamic import resolves: fall through
  // to the bare payload. Subsequent calls (after the next tick)
  // will get the enriched shape.
  return {};
}

/**
 * Read the active user record from localStorage. Stays narrow
 * (userId only) so we don't accidentally leak a name or email
 * into the payload — privacy spec §7 mandates region-level
 * identification only.
 */
function _readUserId() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_user_profile')
             || localStorage.getItem('farroway_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed.id || parsed.userId || parsed.uuid || null;
  } catch { return null; }
}

/**
 * Read the cached weather snapshot and reduce it to a single
 * short summary string (e.g. 'rainy', 'humid', 'hot', 'dry',
 * 'windy'). Privacy spec §7: never store the full forecast in
 * the event payload — a 1-word label is enough for the
 * insightAggregator to bucket events by weather state.
 */
function _summariseWeather() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_weather_cache')
             || localStorage.getItem('farroway_weather');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const w = parsed && typeof parsed === 'object'
      ? (parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed)
      : null;
    if (!w) return null;
    const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
    const rain     = num(w.rainChance) ?? num(w.rain) ?? num(w.precipChance);
    const humidity = num(w.humidity)   ?? num(w.relativeHumidity);
    const temp     = num(w.temp)       ?? num(w.temperatureC) ?? num(w.temperature);
    const wind     = num(w.wind)       ?? num(w.windKmh) ?? num(w.windSpeed);
    if (rain != null && rain >= 60) return 'rainy';
    if (humidity != null && humidity > 70) return 'humid';
    if (temp != null && temp > 30) return 'hot';
    if (wind != null && wind > 25) return 'windy';
    if (humidity != null && humidity < 30) return 'dry';
    return 'normal';
  } catch { return null; }
}

/**
 * trackEvent(eventName, payload?) → record | null.
 *
 * Spec §1 entry point. Enriches the caller-supplied payload
 * with the active context + a weather summary, then writes
 * to BOTH eventStore (canonical) AND analyticsStore (legacy
 * mirror). Returns the persisted record so the caller can
 * forward an id if needed; returns null on any failure.
 *
 * This function NEVER throws.
 */
export function trackEvent(eventName, payload = {}) {
  let record = null;
  try {
    if (typeof eventName !== 'string' || !eventName.trim()) return null;
    const name = eventName.trim();

    // Dev-only warning for unknown event names. Production
    // accepts them so a future spec extension doesn't have
    // to land a flag flip first.
    if (!KNOWN_EVENTS.has(name)) {
      try {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[analytics] unknown event name:', name);
        }
      } catch { /* swallow */ }
    }

    // Build the enriched payload. Each field is a best-effort
    // read; failure leaves the field null so the event still
    // lands.
    const ctx = _readActiveContext();
    const safeCtx = (ctx && typeof ctx === 'object') ? ctx : {};
    const enrichedPayload = {
      // Caller-supplied first (spec-shape extras live here).
      ...(payload && typeof payload === 'object' ? payload : {}),
      // Spec §1 enrichment fields. Caller can override any of
      // these by passing the same key in `payload`.
      userId:           safeCtx.userId           || _readUserId(),
      activeExperience: safeCtx.activeExperience || safeCtx.experience || null,
      gardenId:         safeCtx.gardenId         || null,
      farmId:           safeCtx.farmId           || null,
      cropOrPlant:      safeCtx.cropOrPlant      || null,
      country:          safeCtx.country          || null,
      region:           safeCtx.region           || null,
      growingSetup:     safeCtx.growingSetup     || null,
      farmSizeCategory: safeCtx.farmSizeCategory || safeCtx.sizeCategory || null,
      weatherSummary:   String(_summariseWeather() || '').slice(0, WEATHER_SUMMARY_MAX) || null,
      timestamp:        Date.now(),
    };

    // Canonical write — eventStore is what userMemory +
    // insightAggregator read. Wrapped so a write failure
    // never blocks the legacy mirror below.
    try {
      record = saveEvent({
        name,
        payload:   enrichedPayload,
        timestamp: enrichedPayload.timestamp,
      });
    } catch { /* swallow — legacy mirror is still tried */ }

    // Legacy mirror — the older analytics surfaces (admin
    // Daily Intelligence Usage card, NGO impact dashboard)
    // still read from analyticsStore. Forwarding keeps them
    // working without a code change.
    try { legacyTrackEvent(name, enrichedPayload); }
    catch { /* swallow — primary write already landed */ }

    // Server-sync mirror. Gated by FEATURE_EVENT_SYNC so we
    // don't enqueue doomed POSTs against a server route that
    // doesn't exist yet. Each event becomes one queue entry
    // of type 'event'; the App.jsx dispatcher maps it onto
    // api.post('/events', { name, payload }). Wrapped in
    // try/catch so a queue failure never blocks the local
    // write that already landed.
    try {
      if (isFeatureEnabled('FEATURE_EVENT_SYNC')) {
        addToQueue({
          type: 'event',
          payload: { name, payload: enrichedPayload },
        });
      }
    } catch { /* swallow — local write already landed */ }

    return record;
  } catch {
    // The whole call should never throw. If we get here, both
    // writes failed and we return null silently per spec §1
    // ("never crash app if analytics fails").
    return null;
  }
}

/**
 * clearFarrowayActivityData() — privacy spec §7. Wipes every
 * local activity store the data-moat layer reads.
 *
 *   • farroway_events           — eventStore log
 *   • farroway_health_feedback  — outcome-feedback answers
 *   • farroway_streak_count     — retention streak count
 *   • farroway_last_completed_date
 *   • farroway_last_home_open_date
 *   • farroway_user_memory      — userMemory derived state
 *
 * The function does NOT touch onboarding flags, the active
 * farm/garden row, or the saved language. It's strictly the
 * activity log that the user can opt to clear from a Settings
 * surface.
 *
 * Returns the number of keys removed (0 in SSR / private mode).
 */
export function clearFarrowayActivityData() {
  let removed = 0;
  try {
    if (typeof localStorage === 'undefined') return 0;
    const keys = [
      'farroway_events',
      'farroway_health_feedback',
      'farroway_streak_count',
      'farroway_last_completed_date',
      'farroway_last_home_open_date',
      'farroway_user_memory',
      'farroway_last_scan_issue',
    ];
    for (const k of keys) {
      try {
        if (localStorage.getItem(k) != null) {
          localStorage.removeItem(k);
          removed += 1;
        }
      } catch { /* swallow */ }
    }
  } catch { /* swallow */ }
  return removed;
}

export default trackEvent;
