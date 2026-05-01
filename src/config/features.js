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
  // Daily habit V2: when on AND `dailyEngagement` is also on, the
  // EngagementStrip swaps in:
  //   • TodaysPriorityCard — 1 priority + 1-2 optional rows with
  //     a daily progress bar, value-led why text, and value-aware
  //     completion toasts. Replaces the V1 EngagementPlanCard.
  //   • Single 1/day notification (default 7am) via
  //     habitNotifications, replacing the morning + afternoon
  //     pair from engagementReminders. Mutually exclusive — no
  //     duplicate fires.
  // The streak chip and weekly summary stay across both V1 and V2.
  // DEFAULT ON — the spec ships unconditionally. Flag retained as
  // an opt-out lever: set VITE_FARROWAY_FEATURE_DAILYHABIT=0 at
  // build time to revert to the V1 plan card + dual reminder.
  // Note: this surface only renders when `dailyEngagement` is also
  // on (the parent strip gate); pilots not on the engagement track
  // see no change either way.
  dailyHabit: true,
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
  // Flag-off path: existing anchor + the legacy CTA copy. Existing
  // navigation routes (/funding, /opportunities, /opportunities/:id,
  // /admin/funding, /ngo/funding-readiness) stay verbatim.
  // DEFAULT ON — the spec ships unconditionally. Flag retained as
  // an opt-out lever: set VITE_FARROWAY_FEATURE_GUIDEDFUNDINGAPPLICATION=0
  // at build time to revert to the direct external-link CTA.
  guidedFundingApplication: true,
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
  // Investor metrics: surfaces `/internal/metrics` with headline
  // KPIs, growth + retention block, and per-market breakdown.
  // Pure read aggregator over existing stores — no new
  // persistence keys. Revenue figures are pilot ladder prices ×
  // event counts (the codebase has no billing integration yet,
  // by design); production drop-in is one swap in growthMetrics.
  // DEFAULT ON — the spec ships unconditionally so the live
  // metrics surface is reachable for any investor demo. Flag
  // retained as opt-out: set
  // VITE_FARROWAY_FEATURE_INVESTORMETRICS=0 at build time to
  // revert to the "internal only" notice.
  investorMetrics: true,
  // Operator tools: per-market dashboard at /operator with a
  // pending-interests queue and quick actions to mark contacted /
  // close the deal / copy buyer info. Reads the same partition
  // boundary as the buyer feed (marketFilter), so an operator
  // sees exactly what a buyer in the same market sees, plus the
  // pending interests not yet acted on by the farmer. Every
  // action emits a `marketId`-tagged analytics event via
  // trackMarketEvent for per-region funnel reporting.
  // Stacks on top of `multiMarket` (which provides the partition
  // boundary). DEFAULT ON — the spec ships unconditionally.
  // Flag retained as an opt-out lever: set
  // VITE_FARROWAY_FEATURE_OPERATORTOOLS=0 at build time to revert
  // to the "coming soon" notice on /operator.
  operatorTools: true,
  // Multi-market expansion: replicates Farroway across pilot
  // markets without breaking the existing surface.
  //   §1 marketCatalog — frozen per-country config (GH/KE/NG/TZ/
  //      IN/US) with currency, primary unit, suggested crops,
  //      and seed listings + buyers.
  //   §2 marketCatalog also carries default + fallback languages
  //      so localization can swap copy by market.
  //   §3 marketSeeder lazy-seeds sample listings + buyer
  //      interests on first market entry; idempotent stamp
  //      prevents reseeding.
  //   §4 marketFilter enforces "no cross-region mixing": Buy.jsx
  //      drops listings that don't belong to the user's active
  //      market BEFORE the priority sort runs.
  //   §5 marketResolver auto-resolves the market from
  //      country/profile + manual override
  //      (`farroway_active_market`); MarketSwitcherChip on Home
  //      surfaces the override + auto-detect picker.
  //   §6 marketAnalytics.trackMarketEvent auto-attaches marketId
  //      to events so dashboards partition cleanly.
  // DEFAULT ON — the spec ships unconditionally. Flag retained
  // as an opt-out lever: set VITE_FARROWAY_FEATURE_MULTIMARKET=0
  // at build time to revert to the single-market surface.
  multiMarket: true,
  // User growth: self-sustaining acquisition layer.
  //   §1 ScanShareButton on ScanResultCard — shares result via
  //      Web Share API or clipboard fallback. Includes the user's
  //      stable invite URL so a shared scan is also a referral.
  //   §2 InviteFriendsCard on Home — surfaces this device's stable
  //      referral code, builds an invite URL, and routes to the
  //      OS share sheet or clipboard. Records every outbound
  //      invite to `farroway_referral_invites`.
  //   §3 SellPromptCard on Home — onboarding-conversion CTA shown
  //      when the user has a farm + activity but no listings yet.
  //   §4 Tracking events: share_clicked, share_completed,
  //      invite_sent, invite_rewarded, signup_via_invite,
  //      sell_prompt_view / _click / _dismiss.
  //   §5 Region focus — `growthRegion` resolves the pilot focus
  //      (default Greater Accra, Ghana; override at build time
  //      via VITE_FARROWAY_GROWTH_REGION="Country:Region"). The
  //      InviteFriendsCard headline switches based on whether the
  //      user's location matches the focus.
  // DEFAULT ON — the spec ships unconditionally. Flag retained as
  // an opt-out lever: set VITE_FARROWAY_FEATURE_USERGROWTH=0 at
  // build time to revert to the prior surfaces.
  userGrowth: true,
  // Long-term moat: crystallises value from the data Farroway has
  // already captured. Mounts:
  //   • InsightsDigest on the farmer Home tab — 1-5 personalised
  //     rows pulled from listings + interests + price catalog +
  //     reputation + recurring orders. Self-suppresses when the
  //     engine produces no insights, so a brand-new install stays
  //     calm.
  //   • VerifiedBadge on every ListingCard — surfaces the existing
  //     verificationStore's GPS + photo + timestamp level so a
  //     verified seller earns a "Verified" chip on each card.
  //
  // No new persistence — every signal is read from existing stores.
  // DEFAULT ON — the spec ships unconditionally. Flag retained as
  // an opt-out lever: set VITE_FARROWAY_FEATURE_FARROWAYMOAT=0 at
  // build time to revert to the prior surface.
  farrowayMoat: true,
  // Marketplace revenue scale: stacks on top of marketScale +
  // marketMonetization to grow revenue per user.
  //   §1 top-selling crops bumped in the buyer-feed sort (+50 pts)
  //   §2 weekly recurring-supply toggle in the InterestForm
  //      success state; persists to `farroway_recurring_orders`
  //   §3 priority listings — boosted-first sort (already part of
  //      marketScale, retained here so the spec line is met when
  //      marketScale is off but revenue scale is on)
  //   §4 scarcity badges on each ListingCard
  //      ("Limited quantity" / "High demand")
  //   §5 buyer preferences + Quick Reorder strip on /buy
  //   §6 sticky A/B/C pricing variants for boost + assist
  //
  // DEFAULT ON — the spec ships unconditionally. Flag retained as
  // an opt-out lever: set VITE_FARROWAY_FEATURE_MARKETREVENUESCALE=0
  // at build time to revert to the prior listing surface.
  marketRevenueScale: true,
  // Marketplace monetization: simple, non-blocking paid layers
  // on top of the free marketplace.
  //   §1 Boost listing — farmer-side 24h paid placement; the
  //      listingPriority sort gives boosted listings the top slot.
  //      A "Boosted" badge renders on the buyer card.
  //   §2 Assisted deal — "Get help closing deal" CTA next to
  //      each active listing. Saves to `farroway_assist_requests`
  //      so pilot operators can pick up the request.
  //   §3 Buyer priority — opt-in toggle on /buy. Persists to
  //      `farroway_buyer_priority`; in pilot it is a preference
  //      surface (boosted listings already lead via the existing
  //      sort).
  //   §5 Tracking events emitted: boost_click, assist_request,
  //      deal_closed (the last via marketTransaction's sold
  //      transition).
  // Critical rule: NEVER blocks the free flows — listing creation
  // and buyer interest stay unconditional regardless of this flag
  // or any paid status. Flag-off path: every paid surface returns
  // null. Independent of `marketScale` so pilots can run paid
  // layers on top of the simple v1 buyer feed.
  marketMonetization: false,
  // Marketplace scale: stacks on top of marketTransactionFlow +
  // buyMarketplace. When on:
  //   • Buyers see "new listing" alerts on /buy when a freshly
  //     created listing matches their past interest crop.
  //   • Listings are sorted by relevance: same-crop matches first,
  //     then dense-cluster crops, then newest.
  //   • ListingCard surfaces seller reputation badges
  //     (active seller / fast response).
  //   • InterestForm shows a "What else do you need?" repeat
  //     prompt right after a successful interest submission.
  //   • FarmerInterestPanel shows a "List another crop?" repeat
  //     prompt right after a sale closes.
  // Flag-off path: every surface above renders unchanged.
  marketScale: false,
  // Marketplace transaction flow: when on, the /sell page mounts
  // an inline FarmerInterestPanel under each active-listing card.
  // The panel surfaces an interest count headline ("1 buyer is
  // interested"), a per-interest status pill (interested →
  // contacted → negotiating → sold), action buttons (Contact /
  // Mark negotiating / Accept), a stale-interest nudge banner,
  // and the prefilled Contact-buyer modal. The /buy InterestForm
  // additionally prefills the optional message field with a
  // buyer-to-farmer template when this flag is on. Flag-off path:
  // legacy "View buyers" chip + /marketplace deep-link unchanged.
  marketTransactionFlow: false,
  // Buy marketplace (simple): mounts the /buy route as a clean
  // buyer-facing list. Each card shows crop / quantity / location
  // / ready date and an inline "I'm interested" form (name +
  // location + optional message). Submits via the existing
  // `saveBuyerInterest` so the farmer notification +
  // BUYER_INTEREST_SUBMITTED + spec-name `buyer_interest` events
  // all fire through the canonical pipeline. Coexists with
  // /marketplace + /market/browse — those richer routes stay
  // verbatim. Flag-off path: /buy renders a "coming soon" notice.
  buyMarketplace: false,
  // Sell screen V2 (UX + conversion): when on, the /sell form adds
  // a Market Insight card (demand level / average price / nearby
  // buyers), an auto price suggestion via the existing priceEngine,
  // a smart region chip with city/state detection (fallback "Set
  // your location"), a "Not sure yet" quantity option, a buyer
  // explanation line, and a 3-step "What happens next" panel on
  // the success card. Tracking emits the spec-name events
  // `listing_viewed`, `listing_created`, and `buyer_interest` (the
  // marketStore continues to emit MARKET_LISTING_* alongside).
  // Flag-off path: existing form renders verbatim. The CTA copy
  // refresh ("Create Listing" → "List my produce") happens via the
  // i18n key, which applies regardless of this flag.
  sellScreenV2: false,
  // Funding screen V2 (UX + conversion): when on, FundingCard adds
  // an inline "Why this fits you" chip group (crop / region /
  // experience match) and a footer badge row (time / difficulty /
  // used-by count). Title rendering also strips a trailing
  // "(SAMPLE)" suffix at render time as a defence-in-depth measure
  // — the static catalog already had the suffix removed. Flag-off
  // path: card visuals stay identical to before. Independent of
  // `guidedFundingApplication` so pilots can A/B card-level vs
  // modal-level upgrades separately.
  // DEFAULT ON — the spec ships unconditionally. Flag retained as
  // an opt-out lever in case a pilot needs the legacy card layout
  // back: set VITE_FARROWAY_FEATURE_FUNDINGSCREENV2=0 to disable.
  fundingScreenV2: true,
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
