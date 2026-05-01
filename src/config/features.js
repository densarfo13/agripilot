/**
 * features.js — frontend mirror of the server feature flags.
 *
 * Defaults to disabled. Override at build time via:
 *   VITE_FARROWAY_FEATURE_<NAME_UPPER>=1
 *
 * The server is always authoritative — if the client opts in
 * but the server flag is off, the API returns 404 and the UI
 * branch degrades to the "feature unavailable" state. This
 * config exists mainly so the UI doesn't bother mounting a
 * feature's entry points when we already know it's disabled.
 */

const DEFAULTS = Object.freeze({
  marketplace: false,
  // Region UX System (spec build): resolves region → experience
  // (farm/backyard/generic), surfaces the RegionBanner, swaps
  // BottomTabNav items, and routes dailyIntelligenceEngine through
  // the genericExperience fallback for unsupported countries.
  // Off by default so existing flows ship unchanged; flip via
  // VITE_FARROWAY_FEATURE_REGIONUXSYSTEM=1 once vetted in pilot.
  regionUxSystem: false,
  // Funding Hub (spec build): region- and role-aware static
  // catalog at /funding. Coexists with the existing per-farm
  // matcher at /opportunities — different surfaces, different
  // intents. Off by default; flip via
  // VITE_FARROWAY_FEATURE_FUNDINGHUB=1.
  fundingHub: false,
  // Smart Funding Recommendations: turns the static catalog into
  // a personalised readiness-aware engine (computes a 0-100 score
  // + emits readiness tips). Sits on top of the Funding Hub —
  // requires `fundingHub` to also be on for the surface to render.
  smartFundingRecommendations: false,
  // NGO Partnership Leads: enables the OrganizationPilotCTA form
  // on the Funding Hub + the pilot-leads count in the admin
  // dashboard tile. Storage is local-first (localStorage) and
  // ready to swap for a backend POST when one exists.
  ngoPartnershipLeads: false,
  // Lightweight Feedback System: gates the QuickFeedback +
  // PulseQuestion widgets on farmer-facing pages. The store is
  // local-first (`farroway_feedback`); when off, the widgets
  // never render even if the gate criteria are met.
  feedbackSystem: false,
  // Behavior Tracking: enables the new generic analyticsStore
  // event log (`farroway_events`). Coexists with the canonical
  // `safeTrackEvent` pipeline — this one is local-first so
  // pilot operators can inspect raw event streams on-device.
  behaviorTracking: false,
  // U.S. Backyard onboarding flow: enables the dedicated 6-step
  // /onboarding/backyard route for U.S. users selecting Backyard
  // Farming or Home Garden. The destination + persistence are
  // gated by this flag; existing onboarding flows for commercial
  // farms stay unchanged when off.
  usBackyardFlow: false,
  // U.S. Experience selection: when on, U.S. users hit a chooser
  // step at /onboarding/us-experience that asks "Backyard / Home
  // Garden" vs "Farm / Agriculture" before either onboarding
  // flow runs. Choice persists so returning users are not asked
  // again. Off by default; non-U.S. flows are unaffected either way.
  usExperienceSelection: false,
  // Scan detection (spec): enables the new /scan route +
  // ScanCapture/Result/History components + scanDetectionEngine
  // fallback. Coexists with the existing /scan-crop surface;
  // VoiceAssistant's "scan" command still routes to /scan-crop.
  scanDetection: false,
  // Scan API enabled: when off, `scanDetectionEngine` returns the
  // rule-based safe fallback without hitting any backend. Flip to
  // true once `/api/scan/analyze` lands on the server. Independent
  // of `scanDetection` so the UI can ship before the API.
  scanApiEnabled: false,
  // Scan-to-task: enables the "Add to Today's Plan" button on
  // the result card and creates up to 2 follow-up tasks from a
  // scan. Off by default so the new scan surface ships read-only
  // until the task pipeline is verified.
  scanToTask: false,
  // Twi voice guidance: enables the short-phrase Twi dictionary
  // + auto-play hooks on Home greeting, Task tap, and Scan
  // result. Reuses the existing voiceEngine 3-tier fallback so
  // prerecorded mp3s win when present. Off by default; the
  // user-facing mute toggle is the day-2 control.
  twiVoiceGuidance: false,
  // Adaptive farm/garden setup: when on, /farm/new routes
  // through AdaptiveFarmSetup, which renders GardenSetupForm
  // for backyard users and the existing NewFarmScreen for farm
  // users. Off by default — flag-off path is the existing
  // NewFarmScreen verbatim.
  adaptiveFarmGardenSetup: false,
  // Fast backyard onboarding (3 steps): when on, the adaptive
  // /farm/new wrapper picks FastBackyardOnboarding for backyard
  // users — value intro → plant card quick-pick → Plan Ready.
  // Auto-fills cropStage/unit/farmType so the user only ever
  // makes one decision (plant). Target completion time < 10s.
  // Requires `adaptiveFarmGardenSetup` to also be on; flag-off
  // path falls back to GardenSetupForm verbatim.
  fastBackyardOnboarding: false,
  // Daily engagement layer: mounts EngagementStrip on the farmer
  // Home tab. Wraps the existing dailyTaskEngine in a "never empty"
  // 2–3 task generator, surfaces a streak chip + weekly plant-
  // health summary, and registers morning + afternoon reminders
  // (afternoon only fires when no completion logged today). The
  // existing /utils/streak streak counter is the single source of
  // truth — this layer reads + bumps it; it never forks the data.
  // Off by default — flag-off path is a no-op (strip returns null).
  dailyEngagement: false,
  // Guided Funding Application: when on, FundingCard's primary CTA
  // changes from "Explore this option" to "Start Application" and
  // opens an ApplicationPreviewModal (readiness score, quick apply
  // kit, trust badges, urgency, 3 steps, 3 buttons:
  //   • Continue Application — opens externalUrl + tracks
  //     `funding_apply_click`
  //   • Get help applying    — fires `farroway:open_pilot_help`
  //     window event consumed by OrganizationPilotCTA's listener
  //   • Remind me later      — bookmarks via fundingBookmarks
  // Flag-off path: existing anchor + `Explore this option` copy
  // unchanged. Existing navigation routes (/funding,
  // /opportunities, /opportunities/:id, /admin/funding,
  // /ngo/funding-readiness) stay verbatim.
  guidedFundingApplication: false,
  // Monetization (free | pro): when on, surfaces the UpgradePrompt
  // below scan results, applies tier-aware scan-history caps via
  // `monetization/scanLimits`, and lets pro-only sections wrap in
  // `<ProGate>` to render the upgrade card for free users. Pure
  // additive — never gates onboarding or the daily plan, even when
  // the user is on the free tier. Flag-off path: every helper
  // returns the unbounded values regardless of stored tier.
  monetization: false,
  // NGO mode: surfaces the NgoModeCard on the farmer Home tab. The
  // card is a *user preference* that decides whether to show
  // shortcut buttons to the existing organisation-facing surfaces
  // (`/admin/funding`, `/ngo/impact`, `/ngo/programs`). It does not
  // grant access — the existing route guards still apply. Flag-off
  // path: card returns null; nothing changes on Home.
  ngoMode: false,
  // Funding screen V2 (UX + conversion): when on, FundingCard adds
  // an inline "Why this fits you" chip group (crop / region /
  // experience match) and a footer badge row (time / difficulty /
  // used-by count). Title rendering also strips a trailing
  // "(SAMPLE)" suffix at render time as a defence-in-depth measure
  // — the static catalog already had the suffix removed. Flag-off
  // path: card visuals stay identical to before. Independent of
  // `guidedFundingApplication` so pilots can A/B card-level vs
  // modal-level upgrades separately.
  fundingScreenV2: false,
});

function envOverride(name) {
  if (typeof import.meta === 'undefined' || !import.meta.env) return undefined;
  const key = `VITE_FARROWAY_FEATURE_${String(name).toUpperCase()}`;
  const raw = import.meta.env[key];
  if (raw == null || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'on', 'yes', 'enabled'].includes(v))  return true;
  if (['0', 'false', 'off', 'no', 'disabled'].includes(v)) return false;
  return undefined;
}

/** isFeatureEnabled — pure predicate. Safe on unknown names. */
export function isFeatureEnabled(name) {
  if (!name || typeof name !== 'string') return false;
  if (!(name in DEFAULTS)) return false;
  const env = envOverride(name);
  if (env === true)  return true;
  if (env === false) return false;
  return DEFAULTS[name] === true;
}

/** FEATURES — snapshot at import time. Use for static branches. */
export const FEATURES = Object.freeze(Object.keys(DEFAULTS).reduce((acc, k) => {
  acc[k] = isFeatureEnabled(k);
  return acc;
}, {}));

export default { FEATURES, isFeatureEnabled };
