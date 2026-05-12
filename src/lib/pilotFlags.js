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

// BYPASS_SETUP_FOR_PILOT was removed in the May 2026 permanent-
// PilotHome-removal pass. Home is the only canonical farmer
// surface; the loop-state cleanup it gated now runs unconditionally
// at boot (see main.jsx). Consumers that imported this flag have
// been updated to either omit the gate or use the always-on path.

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
 * The downstream UI is unchanged — Home still renders the
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

/**
 * FEATURE_DAILY_HABIT — enable the focused daily habit loop.
 *
 * When true:
 *   • Daily streak counter is maintained in localStorage at
 *     HABIT_STREAK_KEY. Streak increments once per day on task
 *     completion; resets to 0 after 2 consecutive missed days.
 *   • Task completion persists across page refreshes at
 *     HABIT_LAST_COMPLETED_KEY (localStorage, not sessionStorage).
 *     If the stored date ≠ today, a fresh task is shown.
 *   • After completion, Home shows:
 *       "All done for today. Check tomorrow's task."
 *   • Streak chip appears in the Home header when streak ≥ 1.
 *   • Simple reminder preference stored at HABIT_REMINDER_PREF_KEY
 *     (no push/SMS/email — preference only, for future use).
 *
 * What FEATURE_DAILY_HABIT does NOT restore:
 *   • No push notifications / SMS / email automation
 *   • No gamified leaderboards or XP systems
 *   • No complex scheduling workers or background cron
 *   • No /api/events traffic
 */
export const FEATURE_DAILY_HABIT = true;

/** localStorage key for the daily streak (farroway_daily_streak_v1). */
export const HABIT_STREAK_KEY = 'farroway_daily_streak_v1';

/**
 * localStorage key for the last task-completed date
 * (farroway_last_task_completed_date_v1). Persists across reloads.
 */
export const HABIT_LAST_COMPLETED_KEY = 'farroway_last_task_completed_date_v1';

/**
 * localStorage key for the simple reminder preference
 * (farroway_daily_reminder_pref_v1). No push/SMS — preference only.
 */
export const HABIT_REMINDER_PREF_KEY = 'farroway_daily_reminder_pref_v1';

/**
 * FEATURE_SCAN_USEFULNESS — enable the focused crop scan polish layer.
 *
 * When true:
 *   • ScanPage renders UsefulResultCard instead of the complex multi-
 *     layer result stack. The card shows per-category farmer-friendly
 *     guidance: what we noticed / what to check next / suggested task.
 *   • "Add follow-up task" button appears inline on the result card;
 *     tapping it persists the task via scanToTask and shows an inline
 *     ✅ toast — no page reload.
 *   • Scan results are saved to farroway_scan_history_v1 (a new local-
 *     first slot keyed on the scan date + id) so the history strip can
 *     read without depending on the older per-farm history key.
 *   • UsefulScanHistory renders below the result with the 6 most
 *     recent entries; tapping a row opens the detail page.
 *
 * Safe categories (no ML required — always has a useful fallback):
 *   healthy | yellowing | holes or pest damage |
 *   spots or disease concern | unclear photo (needs_review)
 *
 * What FEATURE_SCAN_USEFULNESS does NOT restore:
 *   • No heavy browser ML model or external AI dependency
 *   • No disease certainty claims ("confirmed disease" etc.)
 *   • No pesticide treatment instructions or dosage claims
 *   • No automatic camera startup
 *   • No blocking render
 */
export const FEATURE_SCAN_USEFULNESS = true;

/**
 * SCAN_HISTORY_KEY — localStorage key for the scan usefulness history
 * (farroway_scan_history_v1). Managed by src/lib/scan/scanHistoryStore.js.
 */
export const SCAN_HISTORY_KEY = 'farroway_scan_history_v1';

/**
 * FEATURE_ACTIVATION_POLISH — enable buyer + funding activation polish.
 *
 * When true:
 *   • Sell page shows a polished empty state when no produce is listed:
 *       "No produce listed yet."
 *       "When your crop is ready, list it so buyers can find it."
 *       CTA: "List produce"
 *   • Sell page shows a "Ready to sell?" banner when the farmer's active
 *     farm is in a harvest-ready stage (harvest / post_harvest /
 *     ready_to_sell / ready). The banner does NOT force any action.
 *   • Funding Hub shows a calm empty state when no recommendations match:
 *       "Funding options will appear based on your crop and region."
 *       CTA: "Add region for better funding options"
 *   • Funding Hub shows a "View funding options" eligibility prompt when
 *     the farmer has a crop but no region on record.
 *   • Buyer interest status labels use farmer-friendly wording:
 *       Pending / Approved / Declined / Needs response
 *     (shown alongside the existing FarmerInterestPanel pills).
 *
 * What FEATURE_ACTIVATION_POLISH does NOT restore:
 *   • No complex matching engine, no auto-apply grants
 *   • No underwriting or payment flows
 *   • No advanced buyer messaging
 *   • No private farmer data exposure
 *   • No API polling loop
 */
export const FEATURE_ACTIVATION_POLISH = true;

// Default export removed alongside BYPASS_SETUP_FOR_PILOT. Every
// known consumer used the named-export form; verified with
// `grep "import [a-zA-Z]+ from .*pilotFlags"` returning zero hits.
