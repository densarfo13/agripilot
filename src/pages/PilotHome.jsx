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
import { useLiveWeather }  from '../hooks/useLiveWeather.js';
import useDailyHabit       from '../hooks/useDailyHabit.js';
import { getWeatherTask }  from '../lib/weatherTaskEngine.js';
import { trackSafeEvent }  from '../lib/safeEventTracker.js';
import { FEATURE_DAILY_HABIT } from '../lib/pilotFlags.js';
import WeatherHeroCard     from '../components/WeatherHeroCard.jsx';
import { FeatureShell }    from '../components/system/FeatureShell.jsx';

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
  const [now] = useState(() => new Date());

  // ─── Daily habit hook (always called — rules-of-hooks) ──────
  // Provides streak, completedToday, markDone backed by localStorage.
  // When FEATURE_DAILY_HABIT is false, values are unused but the hook
  // still runs safely (pure localStorage reads, no side-effects).
  const habit = useDailyHabit();

  // Boot diagnostic — single greppable line per mount.
  useEffect(() => {
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

  // Debug console — fires once when loading settles.
  const _debugFiredRef = useRef(false);
  useEffect(() => {
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

  const userTypeLabel = (() => {
    try {
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
    trackSafeEvent('task_completed', { taskTitle: weatherTask.title || null });
  }

  return (
    <div style={S.page} data-testid="pilot-home">
      <div style={S.shell}>

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

        {/* ── 2. Weather card ──────────────────────────────────
             Slim skeleton while loading; FeatureShell isolates
             any render crash so a broken card never blanks Home. */}
        {weatherLoading && (
          <div style={S.weatherLoading} aria-busy="true" aria-label="Loading weather">
            <span>Checking weather…</span>
          </div>
        )}

        <FeatureShell name="weather" silent>
          <WeatherHeroCard weather={weather} />
        </FeatureShell>

        {/* Inline location hint — one calm line, no container,
            no warning. Links to My Farm where location is edited. */}
        {showLocationHint && (
          <p style={S.locationHint} data-testid="pilot-home-location-hint">
            <Link to="/my-farm" style={S.locationHintLink}>Add location</Link>
            {' '}for live weather
          </p>
        )}

        {/* ── 3. Today's task ──────────────────────────────────
             Title changes with weather: rain → drainage,
             heat → water timing, wind → support plants, etc. */}
        <section
          style={taskDone ? S.cardDone : S.card}
          data-testid="pilot-home-task"
        >
          <p style={S.cardLabel}>Today's task</p>
          <h2 style={S.cardTitle}>{weatherTask.title}</h2>
          <p style={S.cardBody}>{weatherTask.reason}</p>
          {taskDone ? (
            <p style={S.doneNote} data-testid="pilot-home-done-note">
              {FEATURE_DAILY_HABIT
                ? '✔ All done for today. Check tomorrow\'s task.'
                : '✔ Marked as done — nice work.'}
            </p>
          ) : (
            <button
              type="button"
              onClick={handleMarkDone}
              style={S.btnPrimary}
              data-testid="pilot-home-task-cta"
            >
              {weatherTask.cta}
            </button>
          )}
        </section>

        {/* ── 4. Quick actions ─────────────────────────────────── */}
        <section style={S.linksGrid}>
          <Link to="/my-farm"  style={S.linkTile}>My Farm</Link>
          <Link to="/my-grow"  style={S.linkTile}>My Grow</Link>
          <Link to="/tasks"    style={S.linkTile}>Tasks</Link>
          <Link to="/progress" style={S.linkTile}>Progress</Link>
        </section>

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
  card: {
    background:    C.panel,
    border:        `1px solid ${C.border}`,
    borderRadius:  '16px',
    padding:       '1.25rem 1.1rem',
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.5rem',
  },
  cardDone: {
    background:    'rgba(34,197,94,0.06)',
    border:        '1px solid rgba(34,197,94,0.28)',
    borderRadius:  '16px',
    padding:       '1.25rem 1.1rem',
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.5rem',
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
  linksGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap:                 '0.65rem',
    marginTop:           '0.25rem',
  },
  linkTile: {
    padding:        '0.95rem 0.85rem',
    background:     C.panel,
    border:         `1px solid ${C.border}`,
    borderRadius:   '12px',
    color:          C.ink,
    fontSize:       '0.9375rem',
    fontWeight:     700,
    textDecoration: 'none',
    textAlign:      'center',
  },
};
