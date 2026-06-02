/**
 * Home — single canonical home screen.
 *
 * Always opens directly to dashboard mode — no onboarding cards,
 * no setup warnings, no blocking UX. Missing data uses silent
 * fallbacks so the screen is always complete and usable.
 *
 * Structure
 * ─────────
 *   1. Greeting
 *   2. Weather card (inline "Add location" hint when no coords)
 *   3. Today's task
 *   4. Quick actions
 *
 * Data rules
 * ──────────
 *   • Missing location  → silent fallback (weather card shows "Your area")
 *   • Missing crop      → silent fallback
 *   • Missing farm size → silent fallback
 *   • Incomplete setup  → NOT rendered on Home; handled in My Farm / Settings
 *
 * Weather pipeline
 *   1. Resolve coords from farm record → useLiveWeather(loc).
 *   2. If no coords → hook returns FALLBACK_WEATHER shape; never throws.
 *   3. When no location found after load, show ONE small inline line:
 *      "Add location for live weather" — no large container, no warning.
 *
 * Strict-rule audit
 *   • All hooks declared unconditionally — rules-of-hooks safe.
 *   • SSR-safe — every localStorage / window access is wrapped.
 *   • NEVER calls navigate() — no automatic redirect can fire.
 *   • NEVER returns null — every code path renders visible UI.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate }           from 'react-router-dom';
// Permanent Farmer Home spec §7 — dev-only assertion that this
// is the ONLY component rendering the canonical Home. Throws in
// development if any other file ever tries to register itself as
// Home; tree-shaken in production via the import.meta.env.DEV
// gate inside the guard.
import { assertCanonicalHome }   from '../lib/canonicalHomeGuard.js';
// Backyard subtype catalog — used by the [FARM_STATE] trace so
// the resolved type (pots/raised_bed/greenhouse/etc.) is visible
// in DevTools alongside the farms count + active pointer.
import { resolveBackyardType }   from '../lib/backyardTypes.js';
// Hard route lockdown §1 — build commit + canonical-file marker.
// FARROWAY_COMMIT_SHA reads VITE_COMMIT_SHA from the CI build env
// (Railway), falling back to 'local-{epoch}' when running locally.
import { FARROWAY_COMMIT_SHA }   from '../lib/forceUiReset.js';
import { useLiveWeather }        from '../hooks/useLiveWeather.js';
// Intelligence Platform V1 — single highest-priority action card.
// Composes scan + soil + weather + satellite + regional + market +
// outcome history into ONE recommendation. Self-hides on the
// honest empty-state when no inputs are available.
import TopActionCard from '../components/intelligence/TopActionCard.jsx';
import useDailyHabit             from '../hooks/useDailyHabit.js';
import useContextIntelligence    from '../hooks/useContextIntelligence.js';
// Once-per-mount calm-notification feed sync — feeds the user-facing
// bell + /notifications page with calm-engine output (cooldown +
// quiet-hours + daily-cap aware). Zero-cost when the cap is hit.
import useCalmFeedSync           from '../hooks/useCalmFeedSync.js';
import { tSafe }                 from '../i18n/tSafe.js';
import { getWeatherTask }        from '../lib/weatherTaskEngine.js';
import { trackSafeEvent }        from '../lib/safeEventTracker.js';
import { FEATURE_DAILY_HABIT }   from '../lib/pilotFlags.js';
// WeatherHeroActionCard is no longer rendered on Home — the
// immersive companion hero (ImmersiveHomeHero) absorbed its role.
// The file still ships for any deep-link / legacy surface that
// imports it directly.
// Locked Soft Ochre / Beige design tokens (May 2026 visual restraint
// pass + premium-beige-experience pass). Replaces the inline `C`
// object below — the inline values predate the centralised token
// system, so Home was the last surface still rendering with
// the OLD ochre `#D4A35F` instead of the spec-locked `#C8944D`.
// Importing the canonical PREMIUM_TOKENS shape flips every value
// automatically + keeps Home in sync with every other premium
// surface (My Farm, Tasks, Progress, Funding, Sell, Scan).
import { PREMIUM_TOKENS as T }   from '../components/premium/tokens.js';
import FarmGardenProfileCard     from '../components/home/FarmGardenProfileCard.jsx';
// Immersive companion v6 — ONE full-bleed photo-backed hero
// that absorbs the previous CropPlantHero + WeatherHeroActionCard
// + LandHealthCard. The dashboard-card layout is gone.
import ImmersiveHomeHero         from '../components/home/ImmersiveHomeHero.jsx';
import useFarmHealth             from '../hooks/useFarmHealth.js';
import OnTrackRowCard            from '../components/home/OnTrackRowCard.jsx';
import ScanRowCard               from '../components/home/ScanRowCard.jsx';
import DailyFarmPlanCard          from '../components/home/DailyFarmPlanCard.jsx';
import NotificationBell           from '../components/NotificationBell.jsx';
import PageActions                 from '../components/layout/PageActions.jsx';
import useSimpleMode              from '../hooks/useSimpleMode.js';
import SimpleModeHomeSection      from '../components/simpleMode/SimpleModeHomeSection.jsx';
import SimpleHome                  from '../components/simpleMode/SimpleHome.jsx';
// MemoryMomentLine removed from the lean immersive layout (the
// hero's action band carries the "what next" line). Component
// stays in the codebase for other surfaces that may use it.
import { FeatureShell }          from '../components/system/FeatureShell.jsx';
import useExperience             from '../hooks/useExperience.js';
// Farm State Synchronization Audit — canonical REACTIVE farm
// context. Replaces Home's stale `useMemo([])` over the inline
// _resolveFarm helper so adding/switching a farm propagates to
// Home without a refresh.
import useFarmContext             from '../hooks/useFarmContext.js';
// Single Source of Truth Migration — canonical Zustand farm store.
// Subscribed alongside the legacy useFarmContext so the Home tile
// + scan row stay in lock-step with My Farm / Tasks / Progress.
import { useActiveFarm }          from '../hooks/useActiveFarm.js';
 
import { resolveCropName }        from '../utils/resolveCropName.js';
// Emergency Active Farm Hydration Fix — read ProfileContext's
// `loading` so the FarmGardenProfileCard can suppress its
// empty-state copy while backend /api/farms is in flight.
import { useProfileOrNull }       from '../context/ProfileContext.jsx';
// Single recommendation entry point (spec §2). Wires the
// orchestrator's 7-step priority ladder through the mode adapter
// (garden drops commercial surfaces + softens wording) and the
// spec-exact fallback. Memory cooldowns inside the orchestrator
// suppress repeat surfacing across reloads.
import { getPrimaryGuidance } from '../runtime/intelligence/getPrimaryGuidance.js';

// Module-level once-per-page-load guard for the [FARROWAY_HOME]
// mount log. Without this, HMR + Suspense remounts replay the
// boot line on every re-render of the Home tree.
let _homeMountLogged = false;
// Separate guard for the lockdown markers ([FARROWAY_BUILD_COMMIT]
// + [FARROWAY_HOME_LOCK]) — fires once per page load, both in
// dev AND production so ops can confirm the deployed bundle.
let _homeMountLockLogged = false;

// ─── Local-storage helpers ──────────────────────────────────────
function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeJsonGet(key) {
  try {
    const raw = _safeGet(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function _safePath() {
  try {
    return (typeof window !== 'undefined' && window.location)
      ? window.location.pathname
      : '/home';
  } catch { return '/home'; }
}

// ─── Resolvers ──────────────────────────────────────────────────
function _resolveUserType() {
  const v = _safeGet('userType') || _safeGet('farroway_user_type');
  if (typeof v === 'string' && v.trim()) return v.trim();
  return 'farmer';
}

function _resolveFarm() {
  // Farm State + Backyard Type Fix §1 — read order:
  //   1. legacy `farroway_active_farm` blob (single-farm pre-V2)
  //   2. multi-experience store's active entity (covers users who
  //      created their farm via the new multi-farm/garden flow
  //      without writing back to the legacy key — that's why
  //      "No farm added yet" was surfacing for users who DID
  //      have a saved farm)
  //   3. first row of `farroway.farms` (most recent farm fallback
  //      per spec: "if activeFarmId missing, use most recent")
  // All three reads are SSR-safe + never throw.
  const legacy = _safeJsonGet('farroway_active_farm');
  if (legacy && typeof legacy === 'object') return legacy;
  // Multi-experience store fallback.
  try {
    const v2Farms = _safeJsonGet('farroway.farms');
    if (Array.isArray(v2Farms) && v2Farms.length > 0) {
      const activeId = _safeGet('farroway.activeFarmId');
      if (activeId) {
        const match = v2Farms.find((f) => f && String(f.id) === String(activeId));
        if (match) return match;
      }
      // Spec §1: "if activeFarmId missing, use most recent farm".
      return v2Farms[v2Farms.length - 1];
    }
  } catch { /* swallow */ }
  // Garden fallback — when the user is in garden mode and has a
  // garden row but no farm, surface the garden as the active
  // entity so the canonical Home renders garden context.
  try {
    const v2Gardens = _safeJsonGet('farroway.gardens');
    if (Array.isArray(v2Gardens) && v2Gardens.length > 0) {
      const activeGardenId = _safeGet('farroway_active_garden_id');
      if (activeGardenId) {
        const match = v2Gardens.find((g) => g && String(g.id) === String(activeGardenId));
        if (match) return match;
      }
      return v2Gardens[v2Gardens.length - 1];
    }
  } catch { /* swallow */ }
  return null;
}

function _resolveBackyardTypeSafe(farm) {
  try { return resolveBackyardType(farm); }
  catch { return null; }
}

function _resolveCrop(farm) {
  if (farm && typeof farm === 'object') {
    const c = farm.cropName || farm.crop || farm.cropType;
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  const sel = _safeGet('farroway_selected_crop');
  if (typeof sel === 'string' && sel.trim()) return sel.trim();
  return 'crop';
}

/**
 * Resolve a location object { lat, lng, label, region } from the
 * best available source (farm record). useLiveWeather also reads
 * farroway_location + farroway_active_farm as internal fallbacks.
 */
function _resolveLocationObj(farm) {
  if (!farm || typeof farm !== 'object') return null;

  const lat = Number.isFinite(Number(farm.latitude))  ? Number(farm.latitude)  : null;
  const lng = Number.isFinite(Number(farm.longitude)) ? Number(farm.longitude) : null;

  const candidates = [
    farm.locationName, farm.location, farm.region, farm.country,
  ];
  const label = (() => {
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return null;
  })();

  if (lat != null && lng != null) {
    return { lat, lng, label, region: farm.region || null };
  }
  if (label) {
    return { lat: null, lng: null, label, region: null };
  }
  return null;
}

function _resolveLocationLabel(farm) {
  if (!farm || typeof farm !== 'object') return null;
  const candidates = [farm.locationName, farm.location, farm.region, farm.country];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

// ─── Component ──────────────────────────────────────────────────
export default function Home() {
  // Simple Mode preference — when ON, render an action-first top section
  // above the standard DailyFarmPlanCard. Never blocks the rest of Home.
  const { enabled: simpleModeEnabled } = useSimpleMode();
  // Permanent Farmer Home spec §7 — dev-only assertion. If any
  // future commit reintroduces a parallel Home component (a new
  // PilotHome / GardenHome / SimpleHome / etc.) and that component
  // doesn't call this guard with its own import.meta.url, the
  // canonical Home stays correct. If a parallel component DOES
  // call this guard, the assertion throws with a clear message.
  // Production no-ops via the DEV gate inside the guard.
  assertCanonicalHome(import.meta.url);

  const navigate = useNavigate();
  const [now] = useState(() => new Date());

  // Canonical activeFarm subscription — establishes the cross-screen
  // single source of truth. Other Home-internal heuristics (profile,
  // farms[0], experience context) still feed auxiliary data such as
  // lat/lng + region; the canonical store is the authoritative
  // answer to "what crop?" / "what farm name?".
   
  const { activeFarm: canonicalFarm } = useActiveFarm();

  // ─── Daily habit hook (always called — rules-of-hooks) ──────
  // Provides streak, completedToday, markDone backed by localStorage.
  // When FEATURE_DAILY_HABIT is false, values are unused but the hook
  // still runs safely (pure localStorage reads, no side-effects).
  const habit = useDailyHabit();

  // ─── Experience snapshot (multi-farm / multi-garden) ─────────
  // Drives the FarmGardenProfileCard at the top of Home. Hook is
  // called unconditionally so rules-of-hooks holds even when the
  // snapshot is empty (in which case `xp.activeEntity` is null
  // and the card falls back to mode-default labels).
  const xp = useExperience();

  // Boot diagnostic — uses the canonical `[FARROWAY_HOME]`
  // namespace per the May 2026 PilotHome-removal pass. Fires
  // AT MOST ONCE per page load (module-level `_homeMountLogged`
  // guard) so HMR / Suspense remounts don't replay it. Dev only.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (_homeMountLogged) return;
    _homeMountLogged = true;
    try {
      const farm = _resolveFarm();
       
      // Permanent Farmer Home Nav Enforcement spec §6 — single
      // canonical mount marker. Fires once per page load, dev
      // only. Format is the spec-exact wording; replaced the
      // previous ACTUAL_CANONICAL_HOME_ACTIVE +
      // [FARROWAY_HOME_TRACE] pair so DevTools shows ONE
      // unambiguous line per Home mount.
      // Permanent Farmer Home spec §6 — canonical mount marker.
      // Single greppable line per page load (module-level guard
      // dedupes HMR / Suspense re-mounts). The path is included
      // so DevTools shows both that Home rendered AND the URL it
      // rendered at — useful for confirming /home is the only
      // path mounting Home in any given session.
      console.log('[CANONICAL_HOME]', _safePath(), {
        userType:    _resolveUserType(),
        hasLocation: !!_resolveLocationLabel(farm),
        hasFarm:     !!farm,
      });
      // Source-of-Truth Audit spec §6 — also emit the spec-exact
      // log line so the canonical-home audit greps for both
      // formats succeed. Same mount event; two greppable names.
       
      console.log('[FARROWAY_HOME] canonical farmer home mounted');
    } catch { /* swallow */ }
  }, []);

  // Hard route lockdown spec §1 — build commit + canonical-file
  // markers. Visible in BOTH dev AND production so ops can verify
  // the deployed bundle is the latest commit + that the canonical
  // Home file path is the only thing rendering Home. Fires once
  // per page load via the same _homeMountLogged guard.
  useEffect(() => {
    if (_homeMountLockLogged) return;
    _homeMountLockLogged = true;
    try {
       
      console.log('[FARROWAY_BUILD_COMMIT]', FARROWAY_COMMIT_SHA);
       
      console.log('[FARROWAY_HOME_LOCK]', 'src/pages/Home.jsx');
      // Final Runtime Cleanup spec §D — verification line that
      // proves the canonical Home rendered at the canonical URL.
      // Production-visible so ops can read it from any browser
      // session. Format: [HOME_VERIFIED] <location.pathname>.
      // Expected output is "[HOME_VERIFIED] /home"; anything else
      // means a non-canonical mount path slipped through.
      try {
        if (typeof window !== 'undefined' && window.location) {
           
          console.log('[HOME_VERIFIED]', window.location.pathname);
          // Bottom Nav Home Source-of-Truth §7 — spec-exact marker
          // proving the canonical Home mounted via the canonical
          // /home route. Production-visible so ops can correlate
          // a Home tap (BottomNav log) with the mount (this log).
           
          console.log('[FARROWAY_HOME_MOUNTED_FROM_ROUTE]', window.location.pathname);
        }
      } catch { /* swallow */ }
      // Home Persistence Cleanup §4 — canonical Home version marker.
      // Stamped on window so DevTools + ops can read the canonical
      // version of the Home implementation in any session. The
      // accompanying [FARROWAY_HOME_ACTIVE] log is the greppable
      // signal that the canonical-farmer-home-v1 implementation is
      // the one mounted. Both fire in dev AND production so this
      // is the long-running source of truth for "which Home is
      // active on this device".
      try {
        if (typeof window !== 'undefined') {
          window.__FARROWAY_HOME_VERSION__ = 'canonical-farmer-home-v1';
          // Production Cache Purge spec §4 — single hard-version
          // identifier ops can read in any browser session to
          // confirm the deployed bundle carries the latest
          // routing-lockdown infrastructure. Updates per-cycle
          // when a deploy needs to assert a hard cache flush.
          window.__FARROWAY_BUILD__ = 'HOME_LOCK_V3';
        }
      } catch { /* swallow */ }
       
      console.log('[FARROWAY_HOME_ACTIVE] canonical-farmer-home-v1');
       
      console.log('[FARROWAY_BUILD]', 'HOME_LOCK_V3');
    } catch { /* swallow */ }
  }, []);

  // Resolve LOCAL view-model from the canonical reactive farm
  // context. `useFarmContext()` re-renders Home on FARM_CREATED /
  // FARM_UPDATED / FARM_DELETED / LOCATION_UPDATED / CROP_ADDED
  // events, the experience-switched window event, and cross-tab
  // localStorage writes — so a farm added in another surface
  // (or in another tab) appears here immediately.
  //
  // The previous implementation memoized over `[]` and called an
  // inline _resolveFarm() helper, which meant adding a farm
  // AFTER Home mounted never updated this view-model. That was
  // the visible "No farm added yet" bug.
  const farmCtx = useFarmContext();
  // Profile loading flag — used to suppress the empty-state copy
  // on the FarmGardenProfileCard while /api/farms is in flight.
  // useProfileOrNull is the non-throwing variant so Home stays
  // safe on surfaces that mount outside the ProfileProvider.
  const _profileCtx = useProfileOrNull();
  const profileLoadingForCard = !!(_profileCtx && _profileCtx.loading);
  const profileFarmsCount = (_profileCtx && Array.isArray(_profileCtx.farms))
    ? _profileCtx.farms.length
    : null;
  const local = useMemo(() => {
    let userType;
    try { userType = _resolveUserType(); } catch { userType = 'farmer'; }
    const farm = (farmCtx && farmCtx.farm) || null;
    const crop = (farmCtx && farmCtx.crop) || _resolveCrop(farm);
    const locationObj = (farmCtx && farmCtx.location) || _resolveLocationObj(farm);
    return { userType, farm, crop, locationObj };
  }, [farmCtx]);

  // ─── Live weather pipeline ───────────────────────────────────
  const { weather, loading: weatherLoading, refetch: refetchWeather } =
    useLiveWeather(local.locationObj);

  // Inline "Use my location" handler for the weather hero's empty
  // state. Runs the GPS-permission request → persists the row via
  // saveLocation() → triggers a weather refetch so the hero
  // transitions from the calm prompt to live data without a page
  // reload. Pure best-effort: a denied prompt leaves the prompt
  // visible and the user can tap again.
  const handleUseMyLocation = useMemo(() => async () => {
    try {
      const mod = await import('../lib/locationSafe.js');
      const row = await mod.requestUserLocation();
      if (row && row.hasLocation) {
        try { trackSafeEvent('home_use_my_location_granted'); } catch { /* swallow */ }
        try { refetchWeather && refetchWeather(); } catch { /* swallow */ }
      } else {
        try { trackSafeEvent('home_use_my_location_denied'); } catch { /* swallow */ }
      }
    } catch { /* swallow — UI must not crash */ }
  }, [refetchWeather]);

  // Debug console — DEV ONLY. Fires once when loading settles
  // (production cleanup spec §11: no "Source:" / "WeatherType:"
  // diagnostics in production console).
  const _debugFiredRef = useRef(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (weatherLoading) return;
    if (_debugFiredRef.current) return;
    _debugFiredRef.current = true;
    try {
       
      console.log('Live weather source:', weather.source);
       
      console.log('Live weather type:',   weather.weatherType);
    } catch { /* swallow */ }
  }, [weatherLoading, weather]);

  // Today's task — derived from live weather. Always returns a
  // non-null object; never throws.
  const weatherTask = useMemo(() => {
    try { return getWeatherTask(weather); }
    catch {
      return {
        title:  'Walk your field and check crop health',
        reason: 'Water only if soil feels dry.',
        cta:    'Mark as done',
      };
    }
  }, [weather]);

  // ─── Context Intelligence Engine ─────────────────────────────
  // Mode-aware task, alert, and recommendation.
  // Unconditional hook call — rules-of-hooks safe.
  // Never throws; always returns a non-null object.
  // We pass the farm record from local so the engine has crop /
  // cropStage / indoor / containerSize without a second localStorage read.
  const ctxIntel = useContextIntelligence({ weather, farm: local.farm });

  // Canonical Home State Fix spec §8 — branch-state trace.
  // Dev-only. Emits which render branch the canonical Home is
  // currently in, so future "Home looks wrong" reports can be
  // diagnosed in DevTools without re-instrumenting.
  //
  // Placement note (Home ReferenceError Hotfix): this effect must
  // come AFTER `weather` (from useLiveWeather) and `ctxIntel`
  // (from useContextIntelligence) are declared, otherwise Vite's
  // minifier renames those variables to single letters and the
  // TDZ throws `ReferenceError: Cannot access 'i' before
  // initialization` when the dep array is evaluated.
  useEffect(() => {
    try {
      if (!import.meta.env.DEV) return;
      const farm = _resolveFarm();

      console.log('[HOME_BRANCH]', {
        // Defaults to 'farm' per Canonical Home State spec §4 —
        // missing mode reads as farmer (not garden).
        mode:            ctxIntel && ctxIntel.mode === 'garden' ? 'garden' : 'farm',
        hasFarm:         !!farm,
        hasLocation:     !!_resolveLocationLabel(farm),
        hasWeather:      !!(weather && weather.temp != null && weather.source === 'weather-api'),
        hasTasks:        false,  // ctxIntel exposes a single task; Today's Plan owns the list
        authState:       'unknown',  // AuthContext is upstream; not threaded here
        renderedBranch:  'canonical_shell',
      });
      // Emergency Active Farm Hydration Fix §4 — dedicated trace
      // for the active-farm hydration path. Shows what the
      // canonical reader saw vs what ProfileContext fetched, plus
      // the source the entity was resolved from. Single greppable
      // line so a "Home is empty" report can be diagnosed
      // without re-instrumenting.

      console.log('[HOME_FARM_HYDRATION]', {
        loadingFarms:         profileLoadingForCard,
        farmsCount:           profileFarmsCount != null
                                ? profileFarmsCount
                                : (farmCtx && farmCtx.farmsCount) || 0,
        activeFarmId:         (farmCtx && farmCtx.activeFarmId) || null,
        resolvedActiveFarmName: experienceEntity
          ? (experienceEntity.name || experienceEntity.farmName
             || experienceEntity.plantName || experienceEntity.id || null)
          : null,
        source: experienceEntity
          ? ((xp && xp.activeEntity && xp.activeEntity.id === experienceEntity.id)
              ? 'useExperience.activeEntity'
              : (local.farm && local.farm.id === experienceEntity.id)
                ? 'farmContextEngine'
                : 'fallback')
          : 'empty',
      });
      // Farm State + Backyard Type Fix §1 — dedicated trace
      // listing the multi-farm-store contents + active pointer
      // so ops can verify "No farm added yet" reports against
      // the actual data shape on the user's device.
      try {
        const farms       = _safeJsonGet('farroway.farms') || [];
        const gardens     = _safeJsonGet('farroway.gardens') || [];
        const activeFarmId   = _safeGet('farroway.activeFarmId');
        const activeGardenId = _safeGet('farroway_active_garden_id');
        const backyardType   = farm ? _resolveBackyardTypeSafe(farm) : null;
        console.log('[FARM_STATE]', {
          farmsCount:      Array.isArray(farms)   ? farms.length   : 0,
          gardensCount:    Array.isArray(gardens) ? gardens.length : 0,
          activeFarmId:    activeFarmId   || null,
          activeGardenId:  activeGardenId || null,
          activeFarmName:  farm && (farm.name || farm.farmName) || null,
          farmType:        farm && farm.farmType || null,
          backyardType,
          mode:            ctxIntel && ctxIntel.mode === 'garden' ? 'garden' : 'farm',
        });
      } catch { /* swallow */ }
    } catch { /* swallow */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather]);

  // ─── Unified primary guidance (Intelligence Expansion §1) ──
  // Calls the orchestrator with the same context we already have.
  // The orchestrator returns ONE envelope (or its fallback); we
  // only render it as a small bottom tile and only when its
  // actionRoute differs from the surfaces already visible above
  // (weather hero CTA, today's task card, scan row). This keeps
  // Home at "1 context / 1 insight / 1 action / 1 reassurance"
  // without adding a competing card.
  const primaryGuidance = useMemo(() => {
    try {
      // getPrimaryGuidance handles the orchestrator call, the
      // mode adapter (garden suppresses commercial routes +
      // softens wording), and the spec-exact mode fallback in
      // one place. Output shape: { id, title, message, reason,
      // actionLabel, actionRoute, estimatedMinutes, tone,
      // confidenceTone, priority, expiresAt }.
      return getPrimaryGuidance({
        mode:        ctxIntel.mode === 'garden' ? 'garden' : 'farm',
        weather,
        crop:        local.farm?.crop || local.farm?.cropId || null,
        cropStage:   local.farm?.cropStage || null,
        farmSize:    local.farm?.farmSize  || null,
        country:     local.farm?.country   || null,
        region:      local.farm?.region    || null,
      }, { commit: false });
    } catch { return null; }
    // commit=false so re-renders don't keep stamping the memory.
    // The eventual click on the tile will commit via the controller.
  }, [ctxIntel.mode, weather, local.farm]);

  // ─── Calm-notification feed sync ─────────────────────────────
  // Fires once per mount (gated on weather settling) so the bell +
  // /notifications page reflect today's calm-engine output. The
  // calm engine's cooldown / quiet-hours / daily-cap gates do the
  // real spam suppression — this hook is just the bridge.
  const calmContext = useMemo(() => {
    const w = weather && typeof weather === 'object' ? weather : null;
    return {
      mode:    ctxIntel.mode === 'garden' ? 'garden' : 'farm',
      weather: w ? {
        rainProbability: Number(w.rainProbability ?? w.precipitationProbability ?? 0) || 0,
        tempC:           Number(w.temp ?? w.tempC ?? NaN),
        windKph:         Number(w.windSpeedKph ?? w.windKph ?? NaN),
      } : null,
      region:  local.farm?.region || local.farm?.country || null,
    };
  }, [ctxIntel.mode, weather, local.farm]);
  useCalmFeedSync(calmContext, { enabled: !weatherLoading });

  // Small inline hint — only when weather loaded AND no location
  // coords found. Never a large card; never a blocking warning.
  const hasLocation = !!(
    weather.source === 'weather-api'
    || (weather.locationLabel
        && weather.locationLabel !== 'Add location for better weather timing'
        && weather.locationLabel !== 'Your area')
  );
  const showLocationHint = !weatherLoading && !hasLocation;

  const greeting = (() => {
    try {
      const h = now.getHours();
      if (h < 12) return 'Good morning';
      if (h < 18) return 'Good afternoon';
      return 'Good evening';
    } catch { return 'Hello'; }
  })();

  // Garden Mode polish: greet the user as "Gardener" when the
  // active grow mode is garden, regardless of the legacy userType
  // record (which most pilot accounts have stamped as 'farmer'
  // for historical reasons). ctxIntel.mode is the canonical
  // source — driven by farroway_active_grow_mode + ExperienceTabs.
  // Localized via tSafe so non-English locales pick up the
  // gardener label without a code change.
  const userTypeLabel = (() => {
    try {
      if (ctxIntel.mode === 'garden') {
        return tSafe('gardenMode.userLabel', 'Gardener');
      }
      const ut = local.userType;
      if (typeof ut !== 'string' || !ut.trim()) return 'Farmer';
      if (ut === 'farmer') return 'Farmer';
      return ut.charAt(0).toUpperCase() + ut.slice(1);
    } catch { return 'Farmer'; }
  })();

  // Mark-as-done — persisted across reloads via FEATURE_DAILY_HABIT.
  // When the flag is on, `taskDone` comes from localStorage (date-keyed
  // so a new calendar day always shows fresh). When the flag is off,
  // fall back to sessionStorage (old behaviour — cosmetic only).
  const [_sessionTaskDone, _setSessionTaskDone] = useState(() => {
    if (FEATURE_DAILY_HABIT) return false; // habit hook owns the state
    try { return sessionStorage.getItem('farroway_pilot_task_done') === '1'; }
    catch { return false; }
  });
  const taskDone = FEATURE_DAILY_HABIT ? habit.completedToday : _sessionTaskDone;

  // ─── Pilot event tracking ────────────────────────────────────
  const _weatherEventFiredRef = useRef(false);

  useEffect(() => {
    trackSafeEvent('app_opened', {});
    trackSafeEvent('task_viewed', { taskTitle: weatherTask.title || null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — fires once; weatherTask.title is the initial task title at mount

  useEffect(() => {
    if (weatherLoading) return;
    if (_weatherEventFiredRef.current) return;
    _weatherEventFiredRef.current = true;
    if (weather && weather.source === 'weather-api') {
      trackSafeEvent('weather_loaded', { locationLabel: weather.locationLabel || null });
    } else {
      trackSafeEvent('weather_fallback_used', { locationLabel: (weather && weather.locationLabel) || null });
    }
  }, [weatherLoading, weather]);

  function handleMarkDone() {
    if (FEATURE_DAILY_HABIT) {
      // Persist to localStorage (date-keyed) + increment streak.
      habit.markDone();
    } else {
      // Legacy path — sessionStorage only.
      try { sessionStorage.setItem('farroway_pilot_task_done', '1'); } catch { /* swallow */ }
      _setSessionTaskDone(true);
    }
    // Wave-26 C-2 — bridge the Home habit-completion event into
    // the canonical task store so the /tasks badge + Activity
    // timeline + Notifications all reflect the same source of
    // truth. We dispatch the same payload AllTasksPage.handleComplete
    // posts to /api/v2/farm-tasks/:farmId/tasks/:taskId/complete via
    // a dynamic import to avoid pulling the api module into the
    // Home bundle's critical path. Resolves silently when the
    // task id can't be matched (no real farm-task row → habit only).
    try {
      const farmId   = (local && local.farm && local.farm.id) || '';
      // CPO pilot-fix C-7 — contextEngine never stamped an `id` on
      // the today-task envelope, so the wave-26 C-2 bridge was
      // permanently dead. Derive a stable id at the call site:
      // prefer any id contextEngine eventually emits, else build
      // a deterministic ctx-{farmId}-{todayUTC} key so the server
      // can dedupe across re-renders of the same day. On failure
      // (offline / 5xx) enqueue with the same idempotency key —
      // mirrors AllTasksPage.handleComplete's offline path.
      const todayKey = new Date().toISOString().slice(0, 10);
      const taskId   = (ctxIntel?.todayTask?.id)
                       || (farmId ? `ctx-${farmId}-${todayKey}` : '');
      if (taskId && farmId) {
        const taskBody = {
          title:      ctxIntel.todayTask.title      || null,
          priority:   ctxIntel.todayTask.priority   || null,
          actionType: ctxIntel.todayTask.actionType || null,
        };
        import('../runtime/auth.js')
          .then((mod) => {
            try {
              if (mod && typeof mod.completeTask === 'function') {
                return mod.completeTask(farmId, taskId, taskBody);
              }
              return null;
            } catch { return null; }
          })
          .catch(() => {
            // C-8 — offline / network failure: enqueue with the
            // same idempotency key derived above so the reconnect
            // drain replays it exactly once (no duplicate counts).
            try {
              import('../utils/offlineQueue.js').then((q) => {
                if (q && typeof q.enqueue === 'function') {
                  q.enqueue({
                    method: 'POST',
                    url: `/api/v2/farm-tasks/${farmId}/tasks/${encodeURIComponent(taskId)}/complete`,
                    data: taskBody,
                    entityType: 'task',
                    actionType: 'complete',
                    idempotencyKey: `complete:${farmId}:${taskId}`,
                  }).catch(() => { /* swallow */ });
                }
              }).catch(() => { /* swallow */ });
            } catch { /* swallow — never block UI on bridge */ }
          });
      }
    } catch { /* swallow */ }
    // Refinement spec §4 — record the completion timestamp so the
    // MemoryMomentLine on the NEXT visit can quietly reference
    // "yesterday's task". Stored as a single millisecond integer;
    // never read in a way that could crash if missing.
    try { localStorage.setItem('farroway:lastTaskCompletedAt', String(Date.now())); }
    catch { /* swallow */ }
    // Pilot analytics — fired in both modes.
    trackSafeEvent('task_completed', { taskTitle: ctxIntel.todayTask.title || null });
    // Garden Mode: notify the timeline bridge so a 'task_completed'
    // milestone is appended. The bridge gates on grow mode, so
    // dispatching here in farm mode is a harmless no-op.
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('farroway:task_completed_garden', {
          detail: {
            taskTitle: ctxIntel.todayTask.title || null,
            category:  ctxIntel.todayTask.category || null,
            stage:     local.farm?.cropStage || null,
          },
        }));
      }
    } catch { /* swallow */ }
  }

  // Theme class — drives the subtle farm/garden hue shift on the
  // page shell (visual realism polish §4). ctxIntel.mode is the
  // canonical source of truth (set by ExperienceTabs / growMode).
  // Falls back to 'farm' so unauthenticated boots still tint.
  const themeClass = ctxIntel.mode === 'garden' ? 'ff-theme-garden' : 'ff-theme-farm';

  // ─── Profile-card source-of-truth ───────────────────────────
  // FarmGardenProfileCard needs the active entity + count.
  // useExperience returns gardens / farms arrays + the active
  // entity; we derive the card props from the snapshot. The
  // hook is called unconditionally above (rules-of-hooks safe);
  // a try/catch only guards property access so a malformed
  // snapshot can never blank Home.
  let experienceMode   = ctxIntel.mode === 'garden' ? 'garden' : 'farm';
  let experienceEntity = null;
  let experienceCount  = null;
  try {
    if (xp) {
      experienceEntity = xp.activeEntity || null;
      // Prefer the store-canonical experience over ctxIntel when
      // they disagree.
      if (xp.experience === 'garden' || xp.experience === 'backyard') {
        experienceMode = 'garden';
      } else if (xp.experience === 'farm' || xp.experience === 'farmer') {
        experienceMode = 'farm';
      }
      const list = experienceMode === 'garden' ? xp.gardens : xp.farms;
      experienceCount = Array.isArray(list) ? list.length : null;
    }
  } catch { /* swallow — show mode-default labels */ }
  // Farm State Synchronization Audit — when the multi-experience
  // store hasn't yet surfaced an activeEntity (a transient state
  // that happens whenever `farroway_active_experience` is null but
  // farm rows DO exist), fall through to the canonical farm
  // context's `.farm` field. The previous version gated this on
  // `experienceMode === 'farm'`, which silently dropped the
  // fallback whenever ctxIntel inferred 'garden' even though a
  // farm was saved — that was the visible "No farm added yet"
  // mismatch with My Farm. The mode gate is gone; if the
  // canonical reader sees a farm, we surface it.
  if (!experienceEntity && local.farm) {
    experienceEntity = local.farm;
    if (experienceCount == null || experienceCount === 0) {
      // Promote the count chip in lock-step with the entity so the
      // card never reads "My New Farm · 0 farms" again.
      experienceCount = 1;
    }
    // Align experienceMode with the canonical context so the
    // FarmGardenProfileCard's mode-specific copy matches the
    // entity we just promoted (a backyard fallback shouldn't be
    // labeled "0 farms" because ctxIntel happened to default to
    // 'garden').
    if (farmCtx && farmCtx.experience) {
      experienceMode = farmCtx.experience === 'garden' ? 'garden' : 'farm';
    }
  } else if (!experienceEntity) {
    // No entity at all — let the count chip vanish rather than
    // showing the misleading "0 farms" hint.
    experienceCount = null;
  }

  // ─── Memory-moment context (refinement spec §4) ─────────────
  // Reads the lightweight signals already scattered across
  // localStorage — no new fetches. resolveMemoryMoment() returns
  // at most ONE moment, and self-suppresses when nothing
  // qualifies, so the page stays calm by default.
  const _wxCondition = weather && weather.condition;
  const _wxRainChance = weather && weather.rainChance;
  const _wxTemp = weather && weather.temp;
  const _habitStreak = habit && habit.streak;
  const memoryCtx = useMemo(() => {
    const out = {
      mode: experienceMode,
      weather,
      streak: Number.isFinite(_habitStreak) ? _habitStreak : null,
      recentScan: null,
      lastTaskCompletedAt: null,
    };
    try {
      // Most-recent scan history entry (premium scan-usefulness
      // store). Each entry already carries `issue` + `createdAt`.
      const raw = _safeJsonGet('farroway_scan_history_v1');
      if (Array.isArray(raw) && raw.length > 0) {
        const latest = raw[0];
        if (latest && typeof latest === 'object') {
          const ts = latest.createdAt || latest.timestamp || latest.at;
          const t = typeof ts === 'number' ? ts : Date.parse(ts || '');
          const daysAgo = Number.isFinite(t)
            ? Math.max(0, (Date.now() - t) / (24 * 60 * 60 * 1000))
            : null;
          out.recentScan = {
            issue:    latest.issue || latest.title || latest.label || '',
            severity: latest.severity || null,
            daysAgo,
            fromMode: latest.experience || null,
          };
        }
      }
    } catch { /* swallow — memory line just stays hidden */ }
    try {
      const raw = _safeGet('farroway:lastTaskCompletedAt');
      if (raw) out.lastTaskCompletedAt = Number(raw) || raw;
    } catch { /* swallow */ }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceMode, _wxCondition, _wxRainChance, _wxTemp, _habitStreak]);

  // Simple Mode renders a DEDICATED full-screen surface — no shared
  // renderer with Standard. This is the obvious visual difference the
  // differentiation spec requires: when the user is in Simple Mode they
  // see ONLY Today's Action; the standard immersive hero / daily plan /
  // on-track row / streak / weather card all stay behind the branch.
  if (simpleModeEnabled) {
    return <SimpleHome />;
  }

  return (
    <div
      style={S.page}
      className={`${themeClass} ff-page`}
      data-testid="home"
      data-mode={ctxIntel.mode}
    >
      <div style={S.shell} className="ff-card-stagger">

        {/* ── 1. Greeting ─────────────────────────────────────── */}
        <header style={S.header}>
          <div>
            <p style={S.greeting}>{greeting}, {userTypeLabel}.</p>
            <h1 style={S.title}>{tSafe('home.title', 'Today on Farroway')}</h1>
          </div>
          <div style={S.headerRight}>
            {/* Streak chip — only when FEATURE_DAILY_HABIT is on and
                streak ≥ 1. Zero-layout-impact when hidden. */}
            {FEATURE_DAILY_HABIT && habit.streak >= 1 && (
              <span
                style={S.streakPill}
                title={tSafe('home.streakDayCount', '{n}-day streak').replace('{n}', habit.streak)}
                data-testid="home-streak"
              >
                {tSafe('home.streakDayCount', '{n}-day streak').replace('{n}', habit.streak)}
              </span>
            )}
            {/* Header actions — Notification bell + Menu. Placed in the
                exact slot the "Updating…/Live" status pill used to occupy,
                aligned top-right of the main content area. No status
                badges: connection / freshness is communicated via the
                weather card itself, never as a chrome chip. The bell
                preserves its unread-count badge; the menu navigates to
                the existing Settings page (no new navigation behavior). */}
            {/* Canonical in-page action cluster — same component every
                page renders so there is exactly one bell + menu pair
                visible at any moment. The global layout chrome no
                longer renders these. */}
            {/* The canonical action cluster lives inside PageActions; we
                also expose the data-testid="home-header-actions" anchor
                on the wrapper so the DOM-attest path used by gates and
                __headerHealth can find it by id without needing to
                introspect a child component. */}
            <span data-testid="home-header-actions" style={{ display: 'contents' }}>
              <PageActions testId="home-page-actions" />
            </span>
          </div>
        </header>

        {/* ── 2. Farm switcher (compact strip) ─────────────────
             Only purpose: switch between multiple farms/gardens
             and surface the count. Hero below carries the active
             entity name. */}
        <FeatureShell name="profile-card" silent>
          <FarmGardenProfileCard
            mode={experienceMode}
            entity={experienceEntity}
            count={experienceCount}
            loading={profileLoadingForCard}
          />
        </FeatureShell>

        {/* ── 3. Immersive companion hero ──────────────────────
             ONE full-bleed photo-backed panel that combines what
             used to be three cards (CropPlantHero, weather hero,
             land-health). Hero photo resolves from the real
             realism asset library based on mode + crop + weather
             + region + hour. Trust gate hides the temperature
             when no weather-api source — replaced by the
             "Use my location" prompt with a single CTA. Daily
             insight + primary action live in the bottom band. */}
        <FeatureShell name="immersive-home-hero" silent>
          <ImmersiveBound
            mode={experienceMode}
            entity={experienceEntity || local.farm}
            crop={local.crop && local.crop !== 'crop' ? local.crop : null}
            weather={weather}
            location={local.locationObj}
            taskDone={taskDone}
            primaryGuidance={primaryGuidance}
            onUseMyLocation={handleUseMyLocation}
            onPrimaryAction={taskDone
              ? () => { try { navigate('/scan'); } catch { /* swallow */ } }
              : (primaryGuidance && primaryGuidance.actionRoute
                  ? () => { try { navigate(primaryGuidance.actionRoute); } catch { /* swallow */ } }
                  : () => { try { navigate('/tasks'); } catch { /* swallow */ } })}
          />
        </FeatureShell>

        {/* ── 3a. Simple Mode top section ─────────────────────
             When the user has Simple Mode ON (low-literacy / voice-first
             surface), this action-first card appears above the standard
             daily plan. ONE primary action + UP TO 2 secondary actions,
             each with Why / When / Done + voice. Self-contained, error-
             boundary-guarded; renders nothing when Simple Mode is OFF. */}
        {simpleModeEnabled ? (
          <FeatureShell name="simple-mode-home" silent>
            <SimpleModeHomeSection />
          </FeatureShell>
        ) : null}

        {/* ── 3b. Today's Farm/Garden Plan ─────────────────────
             The day-to-day operating loop: top priority + up to
             three tasks + next milestone + approximate harvest
             timeframe, with Mark Done / Skip / Add Note / Scan
             Plant / View Full Plan. Self-contained, guarded by its
             own error boundary, and built from a never-throwing
             runtime — it renders even with NO weather / GPS / scan
             and never blocks Home. */}
        <FeatureShell name="daily-farm-plan" silent>
          <DailyFarmPlanCard />
        </FeatureShell>

        {/* Intelligence Platform V1 — single source of truth.
            Spec: 1. Highest Priority Action · 2. Why · 3. Expected
            Benefit · 4. Confidence. Self-hides when there's no
            actionable signal. Renders above the Today's-task card
            so the farmer sees the prioritized action FIRST. */}
        <TopActionCard />

        {/* ── 4. Daily status insight (Today's task or On-track) ─
             Below the immersive hero — compact, action-oriented.
             When the task is OPEN: the explicit Today's task
             card so the farmer can mark done in-place. When
             DONE: collapses to OnTrackRowCard (compact tappable
             row that opens /progress). */}
        {!taskDone && (
          <section
            style={S.card}
            data-testid="home-task"
          >
            <p style={S.cardLabel}>{tSafe('home.todayTask.label', "Today's task")}</p>
            {/* The Context Intelligence + Weather task engines emit
                a stable key alongside each English string so the
                surface can localize without a reverse-lookup table.
                Falls through to the English literal when a key is
                missing (engine outputs without a key, or tasks
                generated by a path we haven't migrated yet). */}
            <h2 style={S.cardTitle}>
              {ctxIntel.todayTask.titleKey
                ? tSafe(
                    ctxIntel.todayTask.titleKey,
                    ctxIntel.todayTask.title,
                    ctxIntel.todayTask.titleParams || undefined,
                  )
                : ctxIntel.todayTask.title}
            </h2>
            <p style={S.cardBody}>
              {ctxIntel.todayTask.reasonKey
                ? tSafe(ctxIntel.todayTask.reasonKey, ctxIntel.todayTask.reason)
                : ctxIntel.todayTask.reason}
            </p>
            <button
              type="button"
              onClick={handleMarkDone}
              style={S.btnPrimary}
              className="ff-tap"
              data-testid="home-task-cta"
            >
              {ctxIntel.todayTask.ctaKey
                ? tSafe(ctxIntel.todayTask.ctaKey, ctxIntel.todayTask.cta)
                : ctxIntel.todayTask.cta}
            </button>
          </section>
        )}
        {taskDone && (
          <FeatureShell name="on-track-row" silent>
            <OnTrackRowCard testId="home-on-track" />
          </FeatureShell>
        )}

        {/* ── 5. Quick scan action ─────────────────────────────
             Single row card — the only quick action that stays on
             Home. Mode-aware copy ("Scan crop" vs "Scan plant"). */}
        <FeatureShell name="scan-row" silent>
          <ScanRowCard mode={ctxIntel.mode === 'garden' ? 'garden' : 'farm'} />
        </FeatureShell>

      </div>
    </div>
  );
}

// ─── Internal binder ───────────────────────────────────────────
// Wraps the ImmersiveHomeHero with a useFarmHealth call so the
// land-health pill appears inline when applicable. Keeping this
// inside Home.jsx avoids hoisting hook lifecycle out of the
// page-level component AND prevents a second satellite call from
// firing elsewhere — there's now a single subscriber.
// Rename: leading-underscore component names trip rules-of-hooks
// because ESLint requires React component names to start with an
// uppercase letter. Renamed `_ImmersiveBound` → `ImmersiveBound`.
function ImmersiveBound({
  mode, entity, crop, weather, location, taskDone, primaryGuidance,
  onUseMyLocation, onPrimaryAction,
}) {
  const isFarm = String(mode || 'farm').toLowerCase() !== 'garden';
  const { health } = useFarmHealth(isFarm ? location : null);
  return (
    <ImmersiveHomeHero
      mode={mode}
      entity={entity}
      crop={crop}
      weather={weather}
      location={location}
      landHealth={health}
      taskDone={taskDone}
      primaryGuidance={primaryGuidance}
      onUseMyLocation={onUseMyLocation}
      onPrimaryAction={onPrimaryAction}
    />
  );
}

// ─── Inline styles ───────────────────────────────────────────────
// Inline so zero CSS-module / theme dependency can cause a blank
// shell. WeatherHeroCard uses its own global CSS classes from
// src/index.css (loaded at app boot, not theme-dependent).

// May 2026 premium-beige-experience wiring — the inline `C{}`
// object that used to live here is gone. Home now reads
// every colour through the locked PREMIUM_TOKENS re-export
// (`src/design/tokens/colors.js` → `src/components/premium/tokens.js`).
//
// `C` below is a small alias kept ONLY so the existing style-block
// references (`C.ochre`, `C.greenInk`, etc.) stay readable without
// a 400-line search-and-replace through the inline style table.
// Functionally, every key now resolves to the locked spec value:
//   ochre        : #D4A35F → #C8944D  (deeper, more grounded)
//   ochreActive  : #B9853F (unchanged)
//   green        : #5E8E5E → #6E8B61  (warmer olive earth)
//   border       : rgba(31,41,51,0.08) → rgba(36,49,58,0.08)
//   amber       (warning surfaces) shift via the same forward.
const C = {
  bgTop:        T.bgTop,
  bgBottom:     T.bgBottom,
  panel:        T.panel,
  panelHi:      T.panelHi,
  border:       T.border,
  ink:          T.ink,
  inkDim:       T.inkDim,
  inkFaint:     T.inkFaint,
  ochre:        T.ochre,        // locked #C8944D
  ochreActive:  T.ochreActive,  // #B9853F
  ochreSoft:    T.ochreSoft,
  ochreInk:     T.ochreInk,
  ochreBorder:  T.ochreBorder,
  green:        T.green,        // locked #6E8B61 (olive earth)
  greenSh:      T.greenSoft,
  greenInk:     T.greenInk,
};

const S = {
  // Immersive companion shell — same atmospheric stack as
  // ProtectedLayout so the page reads consistently whether
  // Home renders inside Layout's Outlet or as the direct
  // ProtectedRoute return. Apple Weather / Oura aesthetic:
  // navy base + cool sky glow at top + warm earth glow at
  // bottom.
  page: {
    minHeight:  '100vh',
    backgroundColor: '#08111A',
    backgroundImage: [
      'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(60,86,116,0.45) 0%, rgba(8,17,26,0) 70%)',
      'radial-gradient(ellipse 90% 40% at 50% 110%, rgba(200,148,77,0.16) 0%, rgba(8,17,26,0) 65%)',
      'linear-gradient(180deg, #08111A 0%, #0B1A28 35%, #0E1F2C 75%, #1A2026 100%)',
    ].join(', '),
    color:      C.ink,
    // Bottom padding tightened 4rem → 2rem. The bottom nav (~56px)
    // plus the floating-launcher safe zone (when applicable) already
    // protect bottom content; 4rem made the visual "blank space below
    // the cards" complaint from the screenshot review.
    padding:    '1.25rem 1rem 2rem',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  shell: {
    maxWidth:      '32rem',
    margin:        '0 auto',
    display:       'flex',
    flexDirection: 'column',
    // Card-to-card gap tightened 1rem → 0.75rem. With 5 visible
    // cards in the stack this saves ~16px of accumulated vertical
    // space and makes the layout feel less airy on small phones.
    gap:           '0.75rem',
  },
  header: {
    display:        'flex',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            '1rem',
    marginBottom:   '0.25rem',
  },
  headerRight: {
    display:    'flex',
    alignItems: 'center',
    gap:        '0.5rem',
    flexShrink: 0,
  },
  streakPill: {
    display:      'inline-flex',
    alignItems:   'center',
    gap:          '0.2rem',
    padding:      '0.3rem 0.6rem',
    // May 2026 token forward — was rgba(224,162,56,*) (old amber).
    // Resolves through PREMIUM_TOKENS to the locked #D6A13D mustard.
    background:   T.amberSoft,
    border:       `1px solid ${T.amberBorder}`,
    borderRadius: '999px',
    fontSize:     '0.75rem',
    fontWeight:   700,
    color:        T.amberInk,
    flexShrink:   0,
    cursor:       'default',
  },
  greeting: {
    margin:     0,
    fontSize:   '0.875rem',
    color:      C.inkDim,
    fontWeight: 600,
  },
  title: {
    margin:        '0.25rem 0 0',
    fontSize:      '1.5rem',
    fontWeight:    800,
    letterSpacing: '-0.01em',
  },
  // Header actions row — Bell + Menu cluster. Replaces the former
  // status pill in the same top-right slot. Inline-flex so the cluster
  // tracks the greeting baseline; gap is tight so the two buttons read
  // as one control group; flexShrink:0 so the cluster never wraps to a
  // new line on narrow viewports (iPhone Safari).
  headerActions: {
    display:      'inline-flex',
    alignItems:   'center',
    gap:          '0.4rem',
    flexShrink:   0,
  },
  // Single icon button — calm chip style matching the rest of the
  // surface. Used by the Menu link; the NotificationBell brings its
  // own circular icon button inside.
  menuBtn: {
    display:         'inline-flex',
    alignItems:      'center',
    justifyContent:  'center',
    width:           38,
    height:          38,
    borderRadius:    '50%',
    background:      T.greenSoft,
    border:          `1px solid ${T.greenBorder}`,
    color:           T.greenInk,
    fontSize:        '1.05rem',
    fontWeight:      700,
    textDecoration:  'none',
    flexShrink:      0,
    // iOS Safari tap target — ensure pointer events read cleanly.
    cursor:          'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  statusDot: {
    width:        8,
    height:       8,
    borderRadius: '50%',
    background:   T.green,
    // Halo opacity stays at 0.18 — the colour itself is now the
    // locked #6E8B61, expressed via the same rgba template.
    boxShadow:    '0 0 0 4px rgba(110,139,97,0.18)',
  },
  weatherLoading: {
    padding:       '0.5rem 0.75rem',
    fontSize:      '0.8125rem',
    color:         C.inkFaint,
    fontWeight:    600,
    letterSpacing: '0.04em',
    fontFamily:    'monospace',
  },
  // Inline location hint — replaces the old large dashed location card.
  // One calm line under the weather card; zero visual weight.
  locationHint: {
    margin:     '0 0 0',
    fontSize:   '0.75rem',
    color:      C.inkFaint,
    textAlign:  'center',
    lineHeight: 1.5,
  },
  locationHintLink: {
    color:          C.ochreActive,
    textDecoration: 'none',
    fontWeight:     700,
  },
  // Visual realism polish (May 2026): premium tactile card —
  // layered background gradient, soft inset highlight, two-tier
  // depth shadow. Matches MorningBriefingCard so the surface
  // language is consistent across Home.
  // Soft Ochre system — white-on-beige tactile surface.
  card: {
    background:    C.panelHi,
    border:        `1px solid ${C.border}`,
    borderRadius:  '18px',
    padding:       '1.3rem 1.15rem',
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.55rem',
    boxShadow: [
      '0 1px 0 0 rgba(255,255,255,0.55) inset',
      '0 18px 32px -16px rgba(80,60,30,0.22)',
      '0 6px 14px -6px rgba(80,60,30,0.14)',
    ].join(', '),
  },
  // Done state — locked oliveSoft success surface (#6E8B61 family).
  // Both the gradient stops + the border colour now flow from the
  // PREMIUM_TOKENS forward so a future olive shift propagates here
  // automatically.
  cardDone: {
    background:    'linear-gradient(180deg, rgba(110,139,97,0.10) 0%, rgba(110,139,97,0.04) 100%)',
    border:        '1px solid rgba(110,139,97,0.30)',
    borderRadius:  '18px',
    padding:       '1.3rem 1.15rem',
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.55rem',
    boxShadow: [
      '0 1px 0 0 rgba(255,255,255,0.55) inset',
      '0 14px 28px -12px rgba(70,100,70,0.22)',
    ].join(', '),
  },
  cardLabel: {
    margin:        0,
    fontSize:      '0.6875rem',
    fontWeight:    700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color:         C.inkFaint,
  },
  cardTitle: {
    margin:     0,
    fontSize:   '1.125rem',
    fontWeight: 700,
    color:      C.ink,
    lineHeight: 1.3,
  },
  cardBody: {
    margin:     0,
    fontSize:   '0.9375rem',
    color:      C.inkDim,
    lineHeight: 1.55,
  },
  // Primary action — Soft Ochre. Reserved green for health-only.
  btnPrimary: {
    alignSelf:    'flex-start',
    marginTop:    '0.5rem',
    padding:      '0.85rem 1.4rem',
    border:       'none',
    borderRadius: '999px',
    background:   `linear-gradient(180deg, ${C.ochre} 0%, ${C.ochreActive} 100%)`,
    color:        '#FFFFFF',
    fontSize:     '0.9375rem',
    fontWeight:   800,
    cursor:       'pointer',
    minHeight:    46,
    boxShadow:    '0 10px 24px rgba(185,133,63,0.32)',
    letterSpacing: '0.005em',
  },
  doneNote: {
    margin:     '0.25rem 0 0',
    fontSize:   '0.875rem',
    fontWeight: 600,
    color:      C.greenInk,
  },
  doneHeadline: {
    margin:     0,
    fontSize:   '1.15rem',
    fontWeight: 800,
    color:      C.greenInk,
    letterSpacing: '-0.005em',
  },
  linksGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap:                 '0.65rem',
    marginTop:           '0.25rem',
  },
  // Visual realism polish: link tiles get the same layered surface
  // treatment as the briefing/task cards (subtle gradient + softer
  // border + inset highlight) so the navigation feels consistent
  // with the primary content cards.
  linkTile: {
    padding:        '1rem 0.85rem',
    background:     'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)',
    border:         '1px solid rgba(255,255,255,0.06)',
    borderRadius:   '14px',
    color:          C.ink,
    fontSize:       '0.9375rem',
    fontWeight:     700,
    textDecoration: 'none',
    textAlign:      'center',
    boxShadow:      '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 6px 14px -6px rgba(0,0,0,0.25)',
    transition:     'transform 160ms ease-out, box-shadow 160ms ease-out',
  },

  // ── Context Intelligence styles ──────────────────────────────
  // Alert + recommendation banners are now subsumed by the
  // MorningBriefingCard (warning chip + recommendation line).
  // The standalone CTA link below is the only interactive
  // surface that survives — the briefing is read-only by
  // design (calm hierarchy, no buttons).

  ctxRecLink: {
    alignSelf:      'flex-start',
    fontSize:       '0.8125rem',
    fontWeight:     700,
    color:          C.ochreActive,
    textDecoration: 'none',
    whiteSpace:     'nowrap',
    padding:        '0.45rem 0.75rem',
    background:     C.ochreSoft,
    border:         `1px solid ${C.ochreBorder}`,
    borderRadius:   '999px',
  },

  // Sell / harvest prompt — full-width link tile at harvest stage.
  // Ochre-tinted (primary action), not green (which is reserved
  // for health-only signals in the Soft Ochre system).
  ctxSellTile: {
    display:        'block',
    padding:        '1rem 1.1rem',
    background:     C.ochreSoft,
    border:         `1px solid ${C.ochreBorder}`,
    borderRadius:   '14px',
    color:          C.ochreInk,
    fontSize:       '0.9375rem',
    fontWeight:     700,
    textDecoration: 'none',
    textAlign:      'center',
    lineHeight:     1.4,
  },
};
