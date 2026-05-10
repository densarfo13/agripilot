/**
 * PilotHome — operational Home screen for the live pilot.
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
import { tSafe }                 from '../i18n/tSafe.js';
import { getWeatherTask }        from '../lib/weatherTaskEngine.js';
import { trackSafeEvent }        from '../lib/safeEventTracker.js';
import { FEATURE_DAILY_HABIT }   from '../lib/pilotFlags.js';
import WeatherHeroActionCard     from '../components/WeatherHeroActionCard.jsx';
// Locked Soft Ochre / Beige design tokens (May 2026 visual restraint
// pass + premium-beige-experience pass). Replaces the inline `C`
// object below — the inline values predate the centralised token
// system, so PilotHome was the last surface still rendering with
// the OLD ochre `#D4A35F` instead of the spec-locked `#C8944D`.
// Importing the canonical PREMIUM_TOKENS shape flips every value
// automatically + keeps Home in sync with every other premium
// surface (My Farm, Tasks, Progress, Funding, Sell, Scan).
import { PREMIUM_TOKENS as T }   from '../components/premium/tokens.js';
import FarmGardenProfileCard     from '../components/home/FarmGardenProfileCard.jsx';
import OnTrackRowCard            from '../components/home/OnTrackRowCard.jsx';
import ScanRowCard               from '../components/home/ScanRowCard.jsx';
import MemoryMomentLine          from '../components/home/MemoryMomentLine.jsx';
import { FeatureShell }          from '../components/system/FeatureShell.jsx';
import useExperience             from '../hooks/useExperience.js';
// Unified recommendation controller (Intelligence Expansion §1).
// Walks the spec's safety → weather → crop → soil → harvest →
// buyer/funding → progress ladder and returns ONE primary guidance
// envelope. Memory cooldowns inside the orchestrator suppress
// repeat surfacing across reloads, so Home never nags.
import { getNextBestRecommendation } from '../orchestration/orchestrator.js';
// Elite Garden Polish §6 — gardener-tone substitution layered on
// top of the orchestrator title before render. Pure / never throws;
// in farm mode we pass the resolved title through unchanged.
import { softenForGarden } from '../core/scanResultPolicy.js';

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
export default function PilotHome() {
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

  // Boot diagnostic — DEV ONLY (production cleanup spec §11:
  // suppress boot console spam in production builds).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      const farm = _resolveFarm();
      // eslint-disable-next-line no-console
      console.log('PilotHome mounted', {
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
  const { weather, loading: weatherLoading } =
    useLiveWeather(local.locationObj);

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
      return getNextBestRecommendation({
        mode:    ctxIntel.mode === 'garden' ? 'garden' : 'farm',
        weather,
        crop:      local.farm?.crop || local.farm?.cropId || null,
        cropStage: local.farm?.cropStage || null,
        farmSize:  local.farm?.farmSize  || null,
        country:   local.farm?.country   || null,
        region:    local.farm?.region    || null,
      }, { commit: false });
    } catch { return null; }
    // commit=false so re-renders don't keep stamping the memory.
    // The eventual click on the tile will commit via the controller.
  }, [ctxIntel.mode, weather, local.farm]);

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
  if (!experienceEntity && local.farm && experienceMode === 'farm') {
    experienceEntity = local.farm;
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
      data-testid="pilot-home"
      data-mode={ctxIntel.mode}
    >
      <div style={S.shell} className="ff-card-stagger">

        {/* ── 1. Greeting ─────────────────────────────────────── */}
        <header style={S.header}>
          <div>
            <p style={S.greeting}>{greeting}, {userTypeLabel}.</p>
            <h1 style={S.title}>Today on Farroway</h1>
          </div>
          <div style={S.headerRight}>
            {/* Streak chip — only when FEATURE_DAILY_HABIT is on and
                streak ≥ 1. Zero-layout-impact when hidden. */}
            {FEATURE_DAILY_HABIT && habit.streak >= 1 && (
              <span
                style={S.streakPill}
                title={`${habit.streak}-day streak`}
                data-testid="pilot-home-streak"
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

        {/* ── 1b. Farm/Garden profile selector ─────────────────
             Compact dark-glass card — active grow name + count
             chevron. Tapping opens /my-farm or /my-grow. Replaces
             the old "Tip for today" briefing card; the
             WeatherHeroActionCard below now carries the daily
             insight + recommendation surface. */}
        <FeatureShell name="profile-card" silent>
          <FarmGardenProfileCard
            mode={experienceMode}
            entity={experienceEntity}
            count={experienceCount}
          />
        </FeatureShell>

        {/* ── 2. Weather Hero Action Card ──────────────────────
             Premium realistic hero — temperature, condition, rain,
             wind, location PLUS one short insight + one
             recommended action + a single CTA. Drives the next
             action when the day's task isn't done; switches to a
             positive "on track" surface once it is. Visuals reuse
             the global .weather-hero CSS animations (rain drops,
             sun glow, wind streaks) — pure CSS, prefers-reduced-
             motion-respecting. */}
        {weatherLoading && (
          <div style={S.weatherLoading} aria-busy="true" aria-label="Loading weather">
            <span>Checking weather…</span>
          </div>
        )}

        <FeatureShell name="weather-hero-action" silent>
          <WeatherHeroActionCard
            weather={weather}
            mode={ctxIntel.mode === 'garden' ? 'garden' : 'farm'}
            taskDone={taskDone}
            onCta={taskDone
              ? () => { try { navigate('/scan'); } catch { /* swallow */ } }
              // Wire-up audit (May 2026 §6) — when the daily task
              // is OPEN, the weather CTA navigates to /tasks so
              // the user can actually work the task. Marking it
              // done is reserved for the explicit "Mark done"
              // button on the Today's task card below — clicking
              // a hero CTA should never silently complete work
              // the user hasn't actually performed yet.
              : () => { try { navigate('/tasks'); } catch { /* swallow */ } }}
          />
        </FeatureShell>

        {/* May 2026 Garden Home refinement (spec §1) — the
            standalone "Add location for weather tips" hint
            paragraph that used to live here is REMOVED. The
            weather card itself shows the location label in
            its header, so this surface duplicated the same
            message + tap target one element below. The
            location-missing state is still discoverable: the
            weather card reads "Your area" when no coords are
            set, and tapping the weather card routes to the
            tasks/setup flow where the user can add location. */}

        {/* ── 3. Today's task / Done state ─────────────────────
             When the task is open: shows the action surface where
             the user marks done. When done: replaced by a single
             positive line ("All set for now") + one optional
             secondary action (Scan crop / Scan plant). The
             WeatherHeroActionCard above has already echoed the
             "on track" message + offered the same scan CTA, so
             this card stays calm and complementary. */}
        {/* Memory moment (refinement spec §4 — emotional continuity).
            Shows ONE small contextual line drawn from existing
            signals (recent scan, recent weather, care streak,
            last-task recency). Self-suppresses when no signal
            qualifies, so the page stays calm by default. */}
        <FeatureShell name="memory-moment" silent>
          <MemoryMomentLine ctx={memoryCtx} />
        </FeatureShell>

        {/* Mockup-aligned (May 2026) — when the task is OPEN we
            still surface a compact "Today's task" card so the
            user can mark done in-place; when DONE we collapse
            to the OnTrackRowCard (compact tappable row that
            opens /progress). */}
        {!taskDone && (
          <section
            style={S.card}
            data-testid="pilot-home-task"
          >
            <p style={S.cardLabel}>Today's task</p>
            <h2 style={S.cardTitle}>{ctxIntel.todayTask.title}</h2>
            <p style={S.cardBody}>{ctxIntel.todayTask.reason}</p>
            <button
              type="button"
              onClick={handleMarkDone}
              style={S.btnPrimary}
              className="ff-tap"
              data-testid="pilot-home-task-cta"
            >
              {ctxIntel.todayTask.cta}
            </button>
          </section>
        )}

        {taskDone && (
          <FeatureShell name="on-track-row" silent>
            <OnTrackRowCard testId="pilot-home-on-track" />
          </FeatureShell>
        )}

        {/* Single Scan secondary action — full-width row card
            that mirrors the FarmGardenProfileCard / OnTrackRowCard
            visual family. Mode-aware copy ("Scan crop" vs
            "Scan plant"). Always visible on Home (mockup §10). */}
        <FeatureShell name="scan-row" silent>
          <ScanRowCard mode={ctxIntel.mode === 'garden' ? 'garden' : 'farm'} />
        </FeatureShell>

        {/* ── 4. Unified primary-guidance tile ─────────────────
             Replaces the harvest-only sell prompt with whichever
             tile the orchestrator picks (sell, funding, buyer,
             scan follow-up, soil follow-up, …). Suppresses itself
             when the chosen route duplicates a surface already
             rendered above (weather hero CTA, today's task,
             ScanRowCard) so Home never doubles up. */}
        {(() => {
          const above = new Set([
            taskDone ? '/scan' : '/tasks', // weather hero CTA target
            '/scan',                       // ScanRowCard target
          ]);
          const route = primaryGuidance && primaryGuidance.actionRoute;
          const showSellLegacy = !!ctxIntel.sellPrompt && (!route || above.has(route));
          if (showSellLegacy) {
            return (
              <Link
                to="/sell"
                style={S.ctxSellTile}
                className="ff-tap"
                data-testid="pilot-home-ctx-sell-prompt"
              >
                {ctxIntel.sellPrompt}
              </Link>
            );
          }
          if (!route || above.has(route)) return null;
          // Elite Garden Polish §6 — apply the gardener-tone
          // softener to the orchestrator's title only when the
          // active mode is garden. Farm-mode tiles render the
          // canonical wording untouched.
          const resolved = tSafe(primaryGuidance.titleKey, primaryGuidance.titleKey);
          const titleText = ctxIntel.mode === 'garden'
            ? (softenForGarden(resolved) || resolved)
            : resolved;
          return (
            <Link
              to={route}
              style={S.ctxSellTile}
              className="ff-tap"
              data-testid="pilot-home-primary-guidance"
              data-route={route}
            >
              {titleText}
            </Link>
          );
        })()}

      </div>
    </div>
  );
}

// ─── Inline styles ───────────────────────────────────────────────
// Inline so zero CSS-module / theme dependency can cause a blank
// shell. WeatherHeroCard uses its own global CSS classes from
// src/index.css (loaded at app boot, not theme-dependent).

// May 2026 premium-beige-experience wiring — the inline `C{}`
// object that used to live here is gone. PilotHome now reads
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
  page: {
    minHeight:  '100vh',
    background: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgBottom} 100%)`,
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
