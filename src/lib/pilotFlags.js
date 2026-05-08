/**
 * pilotFlags.js — emergency feature flags for the live pilot.
 *
 *   import { BYPASS_SETUP_FOR_PILOT } from './lib/pilotFlags.js';
 *
 *   if (BYPASS_SETUP_FOR_PILOT) { ...short-circuit any setup redirect... }
 *
 * Why this file exists
 * ────────────────────
 * The live app was bouncing pilot users through the onboarding
 * flow on every load — landing on "Where are you?" → tapping
 * Continue → crashing on the next render with "We hit a problem
 * rendering this page." The fix in stages will be: stabilise the
 * Continue path, harden Home for missing location/crop, then
 * re-enable the wizard. Until that lands we simply route every
 * authenticated user straight to Home and surface missing data
 * via the in-Home "Complete setup" card.
 *
 * Strict rules
 *   • Keep this file boring. ONE export per concept. No side
 *     effects. No reads from window / localStorage at module
 *     load — every consumer reads the constant directly.
 *   • Booleans only. Nothing user-identifying lives here.
 *   • When the pilot ends, flip BYPASS_SETUP_FOR_PILOT to false
 *     in a single commit; every consumer falls back to its
 *     normal redirect logic on the next deploy.
 */

/**
 * BYPASS_SETUP_FOR_PILOT
 *
 * When true:
 *   • ProfileGuard never auto-redirects to a setup / onboarding
 *     route — authenticated users land on Home directly.
 *   • The location-screen "Continue" handler stamps the
 *     onboarding-complete flag, marks location as skipped,
 *     and navigates straight to Home instead of advancing
 *     through the rest of the wizard.
 *   • main.jsx wipes the loop-state localStorage keys at boot
 *     so a stuck tab can recover without manual DevTools work.
 *
 * Auth + user identity is NEVER touched by anything gated on
 * this flag — the user is not logged out, their role / userType
 * is preserved, and the in-app "Complete setup" card surfaces
 * missing context inline on Home.
 */
export const BYPASS_SETUP_FOR_PILOT = true;

/**
 * LOOP_STATE_KEYS — localStorage keys that have caused
 * setup-loop / onboarding-redirect bugs in the past. Cleared on
 * boot when BYPASS_SETUP_FOR_PILOT is true so a tab that's stuck
 * with mid-flight wizard state can recover automatically.
 *
 * Auth + user identity are NEVER in this list. The contract is:
 * dropping every key here must leave the user signed in and
 * route them to Home, period.
 */
export const LOOP_STATE_KEYS = Object.freeze([
  'farroway_temp_setup_state',
  'farroway_setup_step',
  'farroway_location_required',
  'farroway_location_pending',
  'farroway_onboarding_redirect',
]);

/**
 * DISABLE_EVENTS — hard kill switch for the event-sync system.
 *
 * When true, EVERY event-related code path returns immediately:
 *   • src/core/analytics.trackEvent()   → returns null at the top
 *   • src/analytics/analyticsStore.trackEvent() → same
 *   • src/offline/offlineQueue.addToQueue() refuses 'event' types
 *   • src/App.jsx dispatcher's `event` case resolves with undefined
 *     (so syncQueue removes the entry instead of POSTing)
 *   • main.jsx wipes EVENT_QUEUE_KEYS plus farroway_events +
 *     farroway_event_queue at every boot
 *
 * This is a STRONGER guarantee than FEATURE_EVENT_SYNC = false
 * (which only gated the queue mirror — local writes still ran).
 * Under DISABLE_EVENTS = true, NOTHING related to the analytics
 * pipeline runs: no localStorage writes, no enqueues, no dispatch,
 * no POSTs to /api/events.
 *
 * The intent is the live pilot stays clean even if a future
 * caller forgets to check FEATURE_EVENT_SYNC, or a stale entry
 * survives the boot wipe. DISABLE_EVENTS is the belt-and-braces
 * outermost guard; once the analytics system stabilises, flip
 * this back to false in a single commit.
 *
 * Auth, profile, sync of OTHER queue types (task_complete,
 * farm_update, harvest_record, health_feedback) are entirely
 * unaffected — DISABLE_EVENTS only short-circuits event paths.
 */
export const DISABLE_EVENTS = true;

/**
 * LIVE_WEATHER_ENABLED — kill switch for the live /api/weather
 * fetch in `useWeatherSafe`.
 *
 * When true (re-enabled 2026-05-04): `useWeatherSafe` fetches
 * /api/weather with a 6s timeout and AbortController. On any
 * failure it paints the documented fallback shape:
 *
 *   { temp: null,
 *     condition: 'Weather unavailable',
 *     rainChance: null,
 *     windSpeed: null,
 *     locationLabel: 'Your area',
 *     source: 'fallback' }
 *
 * Spec §3 (no-location skip): when the user has no saved
 * lat/lng, the hook skips the network call entirely and
 * returns the fallback with locationLabel set to
 * 'Add location for better weather tips'. No /api/weather
 * request is issued without coordinates.
 *
 * The downstream UI is unchanged — PilotHome still renders the
 * weather hero card, weatherActionEngine still picks a task,
 * and useTodayTaskSafe still ships the spec-literal default.
 *
 * Why a kill switch (and not a removal): the network code is
 * production-ready and well-tested. Flip back to false in a
 * single commit if a regression surfaces post-deploy.
 */
export const LIVE_WEATHER_ENABLED = true;

/**
 * FEATURE_EVENT_SYNC
 *
 * When false (default for the pilot):
 *   • analytics.trackEvent() does NOT enqueue an `event` action
 *     onto the offline queue.
 *   • The dispatcher in App.jsx no-ops the 'event' branch.
 *   • syncQueue() short-circuits when only event-type entries
 *     are due — no POSTs to /api/events fire.
 *   • Boot in main.jsx wipes EVENT_QUEUE_KEYS so any pre-existing
 *     queue entries (which were 400-ing in a tight loop and
 *     spamming the console) get dropped exactly once.
 *
 * Local persistence at `farroway_events` (the on-device event
 * store the insightAggregator + admin surfaces read from) is
 * unaffected — that's a SEPARATE storage path; flipping this
 * flag only touches the server-mirror queue.
 *
 * When the /api/events endpoint stabilises and the Zod schema
 * lines up with the client's enqueued shape, flip this to true
 * in a single commit.
 */
export const FEATURE_EVENT_SYNC = false;

/**
 * EVENT_QUEUE_KEYS — localStorage keys the offline event queue
 * has used across versions. Cleared on every boot when
 * DISABLE_EVENTS is true (or FEATURE_EVENT_SYNC is false) so a
 * queue that's been 400-looping empties out without manual
 * DevTools work.
 *
 * Under DISABLE_EVENTS the user spec §4 explicitly asks us to
 * also drop `farroway_events` (the local event-log the admin
 * surfaces read from). The on-device analytics history is
 * acceptable collateral while the pipeline is on fire — the
 * server-side aggregator is the long-term source of truth and
 * resumes once events flip back on.
 */
export const EVENT_QUEUE_KEYS = Object.freeze([
  'farroway_offline_queue',     // src/offline/offlineQueue.js
  'farroway.offlineQueue.v1',   // src/lib/sync/offlineQueue.js (legacy)
  'farroway_queue',             // src/offline/farrowayQueue.js (spec facade)
  'farroway_sync_queue',        // legacy / per-spec drop list
  'farroway_event_queue',       // legacy / per-spec drop list
  'farroway_events',            // local event log — DISABLE_EVENTS spec §4
]);

/**
 * FEATURE_OFFLINE_SAFE — enable the focused offline-reliability layer.
 *
 * When true:
 *   • OfflineSafeStatusBanner mounts in the app shell showing:
 *       offline → "Offline mode — changes will save on this device."
 *       back online → "Back online — syncing safely." (auto-hides 3s)
 *   • Task completions are queued locally at OFFLINE_TASK_QUEUE_KEY
 *     and synced when the device reconnects (max 1 retry; 400s dropped).
 *   • Listing drafts are saved locally at OFFLINE_LISTING_DRAFTS_KEY.
 *   • Home renders using cached data when offline — no blank screen.
 *
 * What FEATURE_OFFLINE_SAFE does NOT restore:
 *   • No background polling / setInterval syncs
 *   • No service-worker / PWA cache
 *   • No bulk sync engine or IndexedDB conflict resolution
 *   • No /api/events pipeline (DISABLE_EVENTS remains true)
 *   • No aggressive retries (max 1 retry per action entry)
 */
export const FEATURE_OFFLINE_SAFE = true;

/**
 * OFFLINE_TASK_QUEUE_KEY — localStorage key for the task completion
 * queue managed by src/lib/offline/taskActionQueue.js.
 */
export const OFFLINE_TASK_QUEUE_KEY = 'farroway_offline_task_actions_v1';

/**
 * OFFLINE_LISTING_DRAFTS_KEY — localStorage key for the listing draft
 * store managed by src/lib/offline/listingDraftStore.js.
 */
export const OFFLINE_LISTING_DRAFTS_KEY = 'farroway_listing_drafts_v1';

export default BYPASS_SETUP_FOR_PILOT;
