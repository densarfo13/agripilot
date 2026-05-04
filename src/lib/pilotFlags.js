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
 * FEATURE_EVENT_SYNC is false so a queue that's been 400-looping
 * empties out without manual DevTools work.
 *
 * `farroway_events` (the local event-log read by the admin
 * surfaces) is NOT in this list — it's the source of truth for
 * on-device analytics and must survive the wipe.
 */
export const EVENT_QUEUE_KEYS = Object.freeze([
  'farroway_offline_queue',     // src/offline/offlineQueue.js
  'farroway.offlineQueue.v1',   // src/lib/sync/offlineQueue.js (legacy)
  'farroway_queue',             // src/offline/farrowayQueue.js (spec facade)
  'farroway_sync_queue',        // legacy / per-spec drop list
  'farroway_event_queue',       // legacy / per-spec drop list
]);

export default BYPASS_SETUP_FOR_PILOT;
