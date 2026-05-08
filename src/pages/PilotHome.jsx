/**
 * PilotHome — safe-default Home screen for the live pilot.
 *
 * Always renders SOMETHING, no matter what's missing:
 *   • No context providers required — reads from localStorage.
 *   • NEVER calls navigate() — no automatic redirect can fire.
 *   • NEVER returns null. Every code path renders visible UI.
 *
 * Weather pipeline (May 2026 spec):
 *   1. Resolve location from farm record / farroway_location /
 *      farroway_active_farm (cascading — see _resolveLocationObj).
 *   2. Pass resolved location to useLiveWeather(loc).
 *      • If lat/lng found → GET /api/weather with 6s timeout.
 *      • If no coords → hook returns fallback shape with
 *        locationLabel = 'Add location for weather tips'.
 *      • On any failure → hook returns fallback shape. Never throws.
 *   3. Render <WeatherHeroCard weather={weather} /> — animated by
 *      weather.weatherType (sunny/rain/cloudy/wind/heat/dry/unknown).
 *   4. Derive today's task from getWeatherTask(weather) — pure fn.
 *   5. Show "Add location" CTA when no coords found.
 *   6. Debug console.log for weather source + type.
 *
 * Strict-rule audit
 *   • All hooks declared unconditionally — rules-of-hooks safe.
 *   • SSR-safe — every localStorage / window access is wrapped.
 *   • Auth + identity untouched.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FARROWAY_BUILD_VERSION } from '../lib/forceUiReset.js';
import { useLiveWeather } from '../hooks/useLiveWeather.js';
import { getWeatherTask }  from '../lib/weatherTaskEngine.js';
import { trackSafeEvent }  from '../lib/safeEventTracker.js';
import WeatherHeroCard     from '../components/WeatherHeroCard.jsx';

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
 * best available source:
 *   1. farm.latitude / farm.longitude (GPS coordinates)
 *   2. farm.locationName / farm.region / farm.country (label-only)
 *   3. null
 *
 * useLiveWeather handles farroway_location + farroway_active_farm
 * localStorage as its own internal fallback, so we only extract
 * coordinates here to give the hook the earliest possible signal.
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

  // If we have GPS → rich object.
  if (lat != null && lng != null) {
    return { lat, lng, label, region: farm.region || null };
  }
  // Label-only → no coordinates but the hook can still show the
  // label in the fallback card without making a network request.
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
  // useLiveWeather:
  //   • Accepts optional location object (from farm record / profile).
  //   • Falls back to localStorage (farroway_location → farroway_active_farm).
  //   • Returns FALLBACK_WEATHER when no coords found — never throws.
  //   • 6-second AbortController timeout.
  const { weather, loading: weatherLoading, refetch: _refetchWeather } =
    useLiveWeather(local.locationObj);

  // Debug logging spec §7 — fires once when loading settles.
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

  // Today's task — derived from live weather. Pure fn, always returns
  // { title, reason, cta } — never null, never throws.
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

  // Does the user have any saved location (for the Add Location CTA)?
  const hasLocation = !!(
    weather.source === 'weather-api'
    || (weather.locationLabel
        && weather.locationLabel !== 'Add location for weather tips'
        && weather.locationLabel !== 'Your area')
  );
  const showAddLocationCta = !weatherLoading && !hasLocation;

  const setupIncomplete = !local.farm;

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

  // Mark-as-done — cosmetic in PilotHome (sessionStorage only).
  const [taskDone, setTaskDone] = useState(() => {
    try { return sessionStorage.getItem('farroway_pilot_task_done') === '1'; }
    catch { return false; }
  });

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
    try { sessionStorage.setItem('farroway_pilot_task_done', '1'); } catch { /* swallow */ }
    setTaskDone(true);
    trackSafeEvent('task_completed', { taskTitle: weatherTask.title || null });
  }

  return (
    <div style={S.page} data-testid="pilot-home">
      <div style={S.shell}>

        {/* ── Header ──────────────────────────────────────────── */}
        <header style={S.header}>
          <div>
            <p style={S.greeting}>{greeting}, {userTypeLabel}.</p>
            <h1 style={S.title}>Today on Farroway</h1>
          </div>
          <span style={S.statusPill}>
            <span style={S.statusDot} />
            <span>{weatherLoading ? 'Updating…' : 'Live'}</span>
          </span>
        </header>

        {/* ── Animated weather hero ────────────────────────────
             WeatherHeroCard:
               • Renders CSS animation class weather-{weatherType}
               • Derives insight + action text from getWeatherAction()
               • Never throws — fallback displays "Weather unavailable"
             Loading state: show a slim skeleton row above the card. */}
        {weatherLoading && (
          <div style={S.weatherLoading} aria-busy="true" aria-label="Loading weather">
            <span>Checking weather…</span>
          </div>
        )}

        <WeatherHeroCard weather={weather} />

        {/* ── Add location CTA ─────────────────────────────────
             Shown only when:
               • Weather loaded (not loading)
               • No coordinates found in any location source
             Links to /profile/setup — never auto-redirects. */}
        {showAddLocationCta && (
          <section style={S.locationCard} data-testid="pilot-home-add-location">
            <p style={S.locationLabel}>📍 No location set</p>
            <p style={S.locationBody}>
              Add your location to unlock live weather and tailored crop guidance.
            </p>
            <Link
              to="/profile/setup"
              style={S.btnGhost}
              data-testid="pilot-home-add-location-cta"
            >
              Add location
            </Link>
          </section>
        )}

        {/* ── Today's task ─────────────────────────────────────
             Derived from live weather via getWeatherTask().
             Title changes based on weatherType:
               rain  → "Check drainage around your crop"
               heat  → "Water crops early morning or late evening"
               wind  → "Support weak plants"
               dry   → "Check soil moisture"
               other → "Inspect your crops" */}
        <section
          style={taskDone ? S.cardDone : S.card}
          data-testid="pilot-home-task"
        >
          <p style={S.cardLabel}>Today's task</p>
          <h2 style={S.cardTitle}>{weatherTask.title}</h2>
          <p style={S.cardBody}>{weatherTask.reason}</p>
          {taskDone ? (
            <p style={S.doneNote}>✔ Marked as done — nice work.</p>
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

        {/* ── Optional setup card ──────────────────────────────── */}
        {setupIncomplete ? (
          <section style={S.setupCard} data-testid="pilot-home-setup-card">
            <p style={S.setupLabel}>Optional</p>
            <h2 style={S.setupTitle}>Complete your setup</h2>
            <p style={S.setupBody}>
              Add crop or location for better guidance. Home keeps working without it.
            </p>
            <Link
              to="/profile/setup"
              style={S.btnGhost}
              data-testid="pilot-home-setup-cta"
            >
              Add crop or location
            </Link>
          </section>
        ) : null}

        {/* ── Quick links ──────────────────────────────────────── */}
        <section style={S.linksGrid}>
          <Link to="/my-farm"  style={S.linkTile}>My Farm</Link>
          <Link to="/my-grow"  style={S.linkTile}>My Grow</Link>
          <Link to="/tasks"    style={S.linkTile}>Tasks</Link>
          <Link to="/progress" style={S.linkTile}>Progress</Link>
        </section>

        {/* ── Debug footer ─────────────────────────────────────── */}
        <footer style={S.debugFooter} data-testid="pilot-home-debug">
          <span>Build: {FARROWAY_BUILD_VERSION}</span>
          <span>Route: {_safePath()}</span>
          <span>UserType: {local.userType}</span>
          <span>WeatherType: {weather.weatherType || '—'}</span>
          <span>Source: {weather.source || '—'}</span>
        </footer>

      </div>
    </div>
  );
}

// ─── Inline styles ───────────────────────────────────────────────
// Inline so zero CSS-module / theme dependency can cause a blank
// shell. The WeatherHeroCard uses its own global CSS classes from
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
  amber:    '#F59E0B',
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
    display:    'inline-flex',
    alignItems: 'center',
    gap:        '0.4rem',
    padding:    '0.3rem 0.6rem',
    background: 'rgba(34,197,94,0.12)',
    border:     '1px solid rgba(34,197,94,0.32)',
    borderRadius: '999px',
    fontSize:   '0.75rem',
    fontWeight: 700,
    color:      '#86EFAC',
    flexShrink: 0,
  },
  statusDot: {
    width:       8,
    height:      8,
    borderRadius: '50%',
    background:  C.green,
    boxShadow:   '0 0 0 4px rgba(34,197,94,0.18)',
  },
  weatherLoading: {
    padding:    '0.5rem 0.75rem',
    fontSize:   '0.8125rem',
    color:      C.inkFaint,
    fontWeight: 600,
    letterSpacing: '0.04em',
    fontFamily: 'monospace',
  },
  locationCard: {
    background:    'rgba(34,197,94,0.06)',
    border:        '1px dashed rgba(34,197,94,0.28)',
    borderRadius:  '16px',
    padding:       '1rem 1.1rem',
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.35rem',
  },
  locationLabel: {
    margin:         0,
    fontSize:       '0.8125rem',
    fontWeight:     700,
    color:          '#86EFAC',
    letterSpacing:  '0.03em',
  },
  locationBody: {
    margin:     0,
    fontSize:   '0.9rem',
    color:      C.inkDim,
    lineHeight: 1.5,
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
    margin:         0,
    fontSize:       '0.6875rem',
    fontWeight:     700,
    letterSpacing:  '0.08em',
    textTransform:  'uppercase',
    color:          C.inkFaint,
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
  btnGhost: {
    alignSelf:      'flex-start',
    marginTop:      '0.5rem',
    padding:        '0.7rem 1.1rem',
    borderRadius:   '10px',
    border:         '1px solid rgba(255,255,255,0.18)',
    background:     'transparent',
    color:          C.ink,
    fontSize:       '0.875rem',
    fontWeight:     700,
    textDecoration: 'none',
    minHeight:      40,
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
  },
  doneNote: {
    margin:     '0.25rem 0 0',
    fontSize:   '0.875rem',
    fontWeight: 600,
    color:      '#86EFAC',
  },
  setupCard: {
    background:    `rgba(245,158,11,0.06)`,
    border:        '1px dashed rgba(245,158,11,0.35)',
    borderRadius:  '16px',
    padding:       '1.25rem 1.1rem',
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.5rem',
  },
  setupLabel: {
    margin:        0,
    fontSize:      '0.6875rem',
    fontWeight:    700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color:         C.amber,
  },
  setupTitle: {
    margin:     0,
    fontSize:   '1.0625rem',
    fontWeight: 700,
    color:      C.ink,
  },
  setupBody: {
    margin:     0,
    fontSize:   '0.9375rem',
    color:      C.inkDim,
    lineHeight: 1.5,
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
  debugFooter: {
    marginTop:  '1.5rem',
    padding:    '0.6rem 0.75rem',
    borderTop:  '1px dashed rgba(255,255,255,0.08)',
    display:    'flex',
    flexWrap:   'wrap',
    gap:        '0.75rem',
    fontSize:   '0.6875rem',
    color:      C.inkFaint,
    fontFamily: 'monospace',
    letterSpacing: '0.04em',
  },
};
