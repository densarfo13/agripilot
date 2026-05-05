/**
 * featureFlags.js — single source of truth for runtime feature
 * gates. Reads three layers, in priority order:
 *
 *   1. window.__FARROWAY_FLAGS__   (set by tests / Storybook /
 *                                   admin override consoles)
 *   2. localStorage 'farroway:flag:<NAME>' === '1' | '0'
 *      (per-device opt-in; great for staging dogfooding)
 *   3. import.meta.env.VITE_FEATURE_<NAME> === 'true' | '1'
 *      (default for the build)
 *   4. hard-coded default below
 *
 * No React, no I/O outside the three reads above. Safe in SSR
 * and locked-down browsers.
 */

const DEFAULTS = Object.freeze({
  // §16 of the localization rollout spec — guards the
  // language-suggestion banner, the LanguageSwitcher, and the
  // crop-name overlay. Default ON in development, OFF until
  // explicitly enabled in production builds.
  FEATURE_LOCALIZATION: true,

  // Voice assistant (§14 of the voice rollout spec). The mic
  // launcher + suggested-question sheet ride this flag — when
  // off, the launcher hides quietly and existing UI surfaces
  // are unaffected.
  FEATURE_VOICE_ASSISTANT: true,

  // Open-ended LLM-backed voice chat. MUST stay off until the
  // safety review the spec calls out lands — guided questions
  // only for now.
  FEATURE_OPEN_ENDED_VOICE: false,

  // Photo Intelligence (rollout v1). Guards the "Scan crop"
  // entry points + analyze flow + result card. Default on in
  // dev; production builds gate via VITE_FEATURE_PHOTO_INTELLIGENCE.
  FEATURE_PHOTO_INTELLIGENCE: true,

  // Voice playback ON the photo intelligence result card.
  // Independent of FEATURE_VOICE_ASSISTANT so the assistant
  // sheet can stay off while the photo flow still reads
  // results aloud.
  FEATURE_VOICE_RESPONSE: true,

  // OpenAI / vision-LLM diagnosis path. MUST stay off — the
  // app uses safe rule-based placeholder responses until a
  // medical-style review of the AI output lands.
  FEATURE_OPEN_AI_DIAGNOSIS: false,

  // Daily Intelligence (rollout v1) — generates today's top
  // 3 actions on Home from crop + planting date + weather +
  // recent activity. Engine is rule-based; no AI claims.
  FEATURE_DAILY_INTELLIGENCE: true,

  // Auto-task generation — when on, the daily plan also
  // surfaces tasks the farmer can mark done from the card.
  // When off, the card still renders but the "Mark done"
  // path no-ops (useful during pilot).
  FEATURE_AUTO_TASK_GENERATION: true,

  // Retention Loop spec §6 follow-up — server sync for the
  // micro health-feedback prompt (Yes / Not sure / No).
  // Default OFF: the local store at `farroway_health_feedback`
  // is the source of truth, and we don't want to enqueue
  // doomed POSTs against a server route that doesn't exist
  // yet. When the server endpoint at /api/health-feedback
  // ships, flip this flag to start mirroring writes into the
  // offline queue (which then drains on the App.jsx 5s tick).
  // Existing local entries are unaffected by the flip — they
  // stay readable on-device for the admin aggregator.
  FEATURE_HEALTH_FEEDBACK_SYNC: false,

  // Pilot event tracker — re-enabled 2026-05-04 via the new
  // safeEventTracker.js (src/lib/safeEventTracker.js). The old
  // offline-queue path that caused the tight 400 loop is still
  // dead (DISABLE_EVENTS=true in pilotFlags.js kills it before
  // it can reach this flag). This flag now exclusively gates
  // safeEventTracker, which:
  //   • Sends directly to /api/events (no offline queue)
  //   • Drops on 400 — no retry loop possible
  //   • Max 1 retry on network failure, then drops
  //   • Tracks only 5 allow-listed events
  // App.jsx's queue dispatcher still reads PILOT_FEATURE_EVENT_SYNC
  // from pilotFlags.js (still false) — the old path stays off.
  FEATURE_EVENT_SYNC: true,

  // AI Task Engine v1 — when ON, the home screen mounts
  // TodayTaskCard at the top and calls POST /api/tasks/today
  // for the primary action. The legacy FirstActionGate stays
  // registered so flipping the flag back to OFF is a one-line
  // rollback if production traffic surfaces a regression.
  // Flipped ON 2026-05-03 — the server endpoint has shipped,
  // the engine's CTA matching is wired, and the Calm-UI spec
  // surfaces (weather header, scan prompt, tomorrow hook,
  // spec-literal fallbacks) only render via this path.
  FEATURE_AI_TASK_ENGINE: true,

  // ── Diagnostic-build surface gates (May 2026) ───────────
  // Per the deploy-diagnostic spec §9, these flags exist so a
  // pilot build can hide unstable modules without ripping
  // their routes out of the codebase. Default values match
  // the diagnostic spec exactly: only the four core farmer
  // surfaces (Home / My Grow / Tasks / Progress) stay
  // enabled. Production env can flip any of these on via
  // VITE_FEATURE_<NAME>=true at build time.
  //
  // Note: these flags do NOT remove the routes from App.jsx
  // — the routes are always mounted so deep links don't
  // 404. Each surface checks its flag at render time and
  // shows "Feature temporarily disabled for pilot." when off.
  FEATURE_SCAN:    true,   // Phase 4 restore — 2026-05-04
  FEATURE_SELL:    true,  // Phase 1 restore — 2026-05-04
  FEATURE_BUYER:           true,   // Phase 2 restore — 2026-05-04 (listing browse)
  // Phase 3 restore — buyer interest sending + farmer approve/decline.
  // Buyer: Send interest button, My Interests tracking, /buyer/interests route.
  // Farmer: FarmerInterestPanel in Sell (gated separately by marketTransactionFlow).
  // Farmer contact revealed to buyer ONLY after farmer accepts (server-enforced).
  FEATURE_BUYER_INTEREST:  true,
  FEATURE_NGO:     true,   // Phase 5 restore — 2026-05-04
  FEATURE_ADMIN:   true,   // Phase 6 restore — 2026-05-04
  FEATURE_FUNDING: false,
  // Pilot stability restore (May 2026 spec §1) — public pricing
  // page hidden until the live pilot stabilises. Reachable
  // routes still render <DisabledFeatureFallback /> with the
  // canonical "Feature temporarily disabled for pilot." copy.
  FEATURE_PRICING: true,   // Phase 7A restore — pricing engine 2026-05-05

  // Advanced AI recommendations — LLM-backed forward
  // planning. Stays off until safety review lands.
  FEATURE_ADVANCED_AI_RECOMMENDATIONS: false,

  // Ghana-ready Simple Onboarding (rollout v1) — under-2-minute
  // farmer setup that lands on Today's Plan. Lives under
  // /onboarding/simple route. Existing FastFlow / OnboardingV3
  // flows stay registered so the rollout can A/B without code
  // changes, controlled by this flag.
  FEATURE_SIMPLE_ONBOARDING: true,

  // Global Expansion System — region-config-driven adaptation
  // for crops / language / nav / experience. When off, the
  // app falls through to its existing Ghana/EN defaults so
  // pilots running today are unaffected.
  FEATURE_GLOBAL_REGION_CONFIG: true,

  // U.S. backyard experience (garden language, no sell-flow,
  // frost/heat-aware watering). Reads through experience helpers
  // gated by getRegionConfig().enableBackyardMode.
  FEATURE_US_BACKYARD_EXPERIENCE: true,

  // Ghana farm experience (rainfall/humidity-aware tasks, sell
  // flow enabled, NGO reporting). On by default — matches the
  // current pilot behaviour.
  FEATURE_GHANA_FARM_EXPERIENCE: true,

  // Advanced Wave-3/4 country activation (India / Philippines /
  // Brazil / Mexico / Indonesia full localisation). MUST stay
  // off until each market clears the launch checklist; the
  // region config keeps them in 'planned' status regardless.
  FEATURE_ADVANCED_GLOBAL_EXPANSION: false,

  // Safe session bootstrap + recovery. When on, callers can
  // wrap protected routes in <DashboardSafeLoader/> for the
  // load → recover → render chain. When off, existing
  // ProfileGuard / route logic runs unchanged so pilot tenants
  // see no behaviour change.
  FEATURE_SAFE_SESSION: true,
});

function safeWindowFlag(name) {
  try {
    if (typeof window === 'undefined') return undefined;
    const bag = window.__FARROWAY_FLAGS__;
    if (bag && Object.prototype.hasOwnProperty.call(bag, name)) {
      return !!bag[name];
    }
  } catch { /* swallow */ }
  return undefined;
}

function safeLocalStorageFlag(name) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    const raw = window.localStorage.getItem(`farroway:flag:${name}`);
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  } catch { /* swallow */ }
  return undefined;
}

function safeEnvFlag(name) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const raw = import.meta.env[`VITE_${name}`];
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    }
  } catch { /* SSR / non-Vite */ }
  try {
    if (typeof process !== 'undefined' && process.env) {
      const raw = process.env[name] || process.env[`VITE_${name}`];
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    }
  } catch { /* swallow */ }
  return undefined;
}

/**
 * isFeatureEnabled — returns whether the named flag is on.
 *
 *   isFeatureEnabled('FEATURE_LOCALIZATION')
 *
 * Unknown flag names default to false.
 */
export function isFeatureEnabled(name) {
  if (!name) return false;
  const w = safeWindowFlag(name);
  if (w !== undefined) return w;
  const ls = safeLocalStorageFlag(name);
  if (ls !== undefined) return ls;
  const env = safeEnvFlag(name);
  if (env !== undefined) return env;
  return !!DEFAULTS[name];
}

/**
 * setFeatureFlagOverride — admin override at the localStorage
 * layer. Persists across reloads on the same device.
 *
 *   setFeatureFlagOverride('FEATURE_LOCALIZATION', true)
 *   setFeatureFlagOverride('FEATURE_LOCALIZATION', null)  // clear
 */
export function setFeatureFlagOverride(name, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const key = `farroway:flag:${name}`;
    if (value == null) { window.localStorage.removeItem(key); return; }
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch { /* swallow */ }
}

export const _internal = Object.freeze({ DEFAULTS });
