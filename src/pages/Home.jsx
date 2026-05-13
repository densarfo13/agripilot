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
import { useLiveWeather }        from '../hooks/useLiveWeather.js';
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
// MemoryMomentLine removed from the lean immersive layout (the
// hero's action band carries the "what next" line). Component
// stays in the codebase for other surfaces that may use it.
import { FeatureShell }          from '../components/system/FeatureShell.jsx';
import useExperience             from '../hooks/useExperience.js';
// Single recommendation entry point (spec §2). Wires the
// orchestrator's 7-step priority ladder through the mode adapter
// (garden drops commercial surfaces + softens wording) and the
// spec-exact fallback. Memory cooldowns inside the orchestrator
// suppress repeat surfacing across reloads.
import { getPrimaryGuidance } from '../intelligence/recommendations/getPrimaryGuidance.js';

// Module-level once-per-page-load guard for the [FARROWAY_HOME]
// mount log. Without this, HMR + Suspense remounts replay the
// boot line on every re-render of the Home tree.
let _homeMountLogged = false;

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
  const farm = _safeJsonGet('farroway_active_farm');
  if (farm && typeof farm === 'object') return farm;
  return null;
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
  const navigate = useNavigate();
  const [now] = useState(() => new Date());

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
      // eslint-disable-next-line no-console
      // Permanent Farmer Home Nav Enforcement spec §6 — single
      // canonical mount marker. Fires once per page load, dev
      // only. Format is the spec-exact wording; replaced the
      // previous ACTUAL_CANONICAL_HOME_ACTIVE +
      // [FARROWAY_HOME_TRACE] pair so DevTools shows ONE
      // unambiguous line per Home mount.
      console.log('[FARROWAY_HOME] canonical farmer home mounted', {
        path:        _safePath(),
        userType:    _resolveUserType(),
        hasLocation: !!_resolveLocationLabel(farm),
        hasFarm:     !!farm,
      });
    } catch { /* swallow */ }
  }, []);

  // Resolve LOCAL view-model from localStorage. Pure + synchronous.
  const local = useMemo(() => {
    let userType, farm, crop, locationObj;
    try {
      userType    = _resolveUserType();
      farm        = _resolveFarm();
      crop        = _resolveCrop(farm);
      locationObj = _resolveLocationObj(farm);
    } catch {
      userType    = 'farmer';
      farm        = null;
      crop        = 'crop';
      locationObj = null;
    }
    return { userType, farm, crop, locationObj };
  }, []);

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
      // eslint-disable-next-line no-console
      console.log('Live weather source:', weather.source);
      // eslint-disable-next-line no-console
      console.log('Live weather type:',   weather.weatherType);
    } catch { /* swallow */ }
  }, [weatherLoading, weather]);

  // Today's task — derived from live weather. Always returns a
  // non-null object; never throws.
  const weatherTask = useMemo(() => {
    try { return getWeatherTask(weather); }
    catch {
      return {
        title:  'Check soil moisture around your crop',
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
        && weather.locationLabel !== 'Add location for weather tips'
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
  // Fall back to the localStorage farm record so first-run pilot
  // accounts (one farm, no multi-experience entries yet) still
  // see a populated card.
  //
  // Farm-state hardening — keep the entity + count in lock-step.
  // Previously the card could render "My New Farm" (from
  // local.farm fallback) alongside "0 farms" (from xp.farms.length
  // when the multi-experience store hadn't been seeded yet). Two
  // different sources of truth = visible mismatch. When we use
  // the local.farm fallback as the entity, we ALSO promote the
  // count to at least 1; when we have no entity at all, we let
  // the count chip self-hide by setting it to null.
  if (!experienceEntity && local.farm && experienceMode === 'farm') {
    experienceEntity = local.farm;
    if (experienceCount == null || experienceCount === 0) {
      experienceCount = 1;
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
                title={`${habit.streak}-day streak`}
                data-testid="home-streak"
              >
                {habit.streak}-day streak
              </span>
            )}
            <span style={S.statusPill}>
              <span style={S.statusDot} />
              <span>{weatherLoading ? 'Updating…' : 'Live'}</span>
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
          <_ImmersiveBound
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
            <h2 style={S.cardTitle}>{ctxIntel.todayTask.title}</h2>
            <p style={S.cardBody}>{ctxIntel.todayTask.reason}</p>
            <button
              type="button"
              onClick={handleMarkDone}
              style={S.btnPrimary}
              className="ff-tap"
              data-testid="home-task-cta"
            >
              {ctxIntel.todayTask.cta}
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
function _ImmersiveBound({
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
    padding:    '1.5rem 1rem 4rem',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  shell: {
    maxWidth:      '32rem',
    margin:        '0 auto',
    display:       'flex',
    flexDirection: 'column',
    gap:           '1rem',
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
  statusPill: {
    display:      'inline-flex',
    alignItems:   'center',
    gap:          '0.4rem',
    padding:      '0.3rem 0.6rem',
    // May 2026 token forward — was rgba(94,142,94,*) (old olive).
    // Resolves to the locked #6E8B61 oliveSoft via greenSoft +
    // greenBorder which both use rgba(110,139,97,*).
    background:   T.greenSoft,
    border:       `1px solid ${T.greenBorder}`,
    borderRadius: '999px',
    fontSize:     '0.75rem',
    fontWeight:   700,
    color:        T.greenInk,
    flexShrink:   0,
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
