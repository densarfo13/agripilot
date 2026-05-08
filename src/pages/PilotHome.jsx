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
import ScanSecondaryButton       from '../components/home/ScanSecondaryButton.jsx';
import FarmGardenProfileCard     from '../components/home/FarmGardenProfileCard.jsx';
import { FeatureShell }          from '../components/system/FeatureShell.jsx';
import useExperience             from '../hooks/useExperience.js';

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
                🔥 {habit.streak}
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

        {/* Inline location hint — one calm line, no container,
            no warning. Links to My Farm where location is edited.
            Wire-up audit (May 2026 §3) — copy aligned to "Add
            location for weather tips". */}
        {showLocationHint && (
          <p style={S.locationHint} data-testid="pilot-home-location-hint">
            <Link to="/my-farm" style={S.locationHintLink}>
              {tSafe('home.locationHint.cta', 'Add location')}
            </Link>
            {' '}
            {tSafe('home.locationHint.body', 'for weather tips')}
          </p>
        )}

        {/* ── 3. Today's task / Done state ─────────────────────
             When the task is open: shows the action surface where
             the user marks done. When done: replaced by a single
             positive line ("All set for now") + one optional
             secondary action (Scan crop / Scan plant). The
             WeatherHeroActionCard above has already echoed the
             "on track" message + offered the same scan CTA, so
             this card stays calm and complementary. */}
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
              data-testid="pilot-home-task-cta"
            >
              {ctxIntel.todayTask.cta}
            </button>
          </section>
        )}

        {taskDone && (
          <section
            style={S.cardDone}
            data-testid="pilot-home-task"
            data-state="done"
          >
            <h2 style={S.doneHeadline} data-testid="pilot-home-done-note">
              {tSafe('home.allSetForNow', 'All set for now ✓')}
            </h2>
            <p style={S.cardBody}>
              {tSafe('home.checkTomorrow', 'Check again tomorrow morning.')}
            </p>
            {/* ONE optional secondary action — keeps the surface
                useful without re-introducing dashboard clutter. */}
            <ScanSecondaryButton
              mode={ctxIntel.mode === 'garden' ? 'garden' : 'farm'}
            />
          </section>
        )}

        {/* ── 4. Sell / funding prompt ─────────────────────────
             Visible only at harvest stage (farm mode only).
             The Quick Actions grid + the Recommendation CTA strip
             have been removed (Home Mockup spec §1: bottom nav
             owns navigation, no dashboard overload on Home). The
             sell/funding prompt is the single conditional CTA
             allowed below the on-track surface, gated to harvest. */}
        {ctxIntel.sellPrompt && (
          <Link
            to="/sell"
            style={S.ctxSellTile}
            data-testid="pilot-home-ctx-sell-prompt"
          >
            {ctxIntel.sellPrompt}
          </Link>
        )}

      </div>
    </div>
  );
}

// ─── Inline styles ───────────────────────────────────────────────
// Inline so zero CSS-module / theme dependency can cause a blank
// shell. WeatherHeroCard uses its own global CSS classes from
// src/index.css (loaded at app boot, not theme-dependent).

const C = {
  bgTop:    '#0B1D34',
  bgBottom: '#081423',
  panel:    'rgba(255,255,255,0.04)',
  border:   'rgba(255,255,255,0.08)',
  ink:      '#FFFFFF',
  inkDim:   'rgba(255,255,255,0.65)',
  inkFaint: 'rgba(255,255,255,0.45)',
  green:    '#22C55E',
  greenSh:  'rgba(34,197,94,0.25)',
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
    background:   'rgba(251,191,36,0.14)',
    border:       '1px solid rgba(251,191,36,0.35)',
    borderRadius: '999px',
    fontSize:     '0.75rem',
    fontWeight:   700,
    color:        '#FCD34D',
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
    background:   'rgba(34,197,94,0.12)',
    border:       '1px solid rgba(34,197,94,0.32)',
    borderRadius: '999px',
    fontSize:     '0.75rem',
    fontWeight:   700,
    color:        '#86EFAC',
    flexShrink:   0,
  },
  statusDot: {
    width:        8,
    height:       8,
    borderRadius: '50%',
    background:   C.green,
    boxShadow:    '0 0 0 4px rgba(34,197,94,0.18)',
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
    color:          '#86EFAC',
    textDecoration: 'none',
    fontWeight:     600,
  },
  // Visual realism polish (May 2026): premium tactile card —
  // layered background gradient, soft inset highlight, two-tier
  // depth shadow. Matches MorningBriefingCard so the surface
  // language is consistent across Home.
  card: {
    background:    'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)',
    border:        '1px solid rgba(255,255,255,0.07)',
    borderRadius:  '18px',
    padding:       '1.3rem 1.15rem',
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.55rem',
    boxShadow: [
      '0 1px 0 0 rgba(255,255,255,0.04) inset',
      '0 12px 28px -8px rgba(0,0,0,0.30)',
      '0 4px 8px -2px rgba(0,0,0,0.18)',
    ].join(', '),
  },
  cardDone: {
    background:    'linear-gradient(180deg, rgba(34,197,94,0.085) 0%, rgba(34,197,94,0.04) 100%)',
    border:        '1px solid rgba(34,197,94,0.28)',
    borderRadius:  '18px',
    padding:       '1.3rem 1.15rem',
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.55rem',
    boxShadow: [
      '0 1px 0 0 rgba(255,255,255,0.04) inset',
      '0 10px 24px -8px rgba(0,0,0,0.28)',
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
  btnPrimary: {
    alignSelf:    'flex-start',
    marginTop:    '0.5rem',
    padding:      '0.85rem 1.4rem',
    border:       'none',
    borderRadius: '12px',
    background:   C.green,
    color:        C.ink,
    fontSize:     '0.9375rem',
    fontWeight:   700,
    cursor:       'pointer',
    minHeight:    46,
    boxShadow:    `0 8px 22px ${C.greenSh}`,
  },
  doneNote: {
    margin:     '0.25rem 0 0',
    fontSize:   '0.875rem',
    fontWeight: 600,
    color:      '#86EFAC',
  },
  doneHeadline: {
    margin:     0,
    fontSize:   '1.15rem',
    fontWeight: 800,
    color:      '#86EFAC',
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
    color:          '#86EFAC',
    textDecoration: 'none',
    whiteSpace:     'nowrap',
    padding:        '0.45rem 0.75rem',
    background:     'rgba(34,197,94,0.07)',
    border:         '1px solid rgba(34,197,94,0.18)',
    borderRadius:   '999px',
  },

  // Sell / harvest prompt — full-width link tile at harvest stage.
  // Green-tinted to signal opportunity, not urgency.
  ctxSellTile: {
    display:        'block',
    padding:        '1rem 1.1rem',
    background:     'rgba(34,197,94,0.10)',
    border:         '1px solid rgba(34,197,94,0.32)',
    borderRadius:   '14px',
    color:          '#86EFAC',
    fontSize:       '0.9375rem',
    fontWeight:     700,
    textDecoration: 'none',
    textAlign:      'center',
    lineHeight:     1.4,
  },
};
