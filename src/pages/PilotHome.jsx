/**
 * PilotHome — emergency safe-default Home screen for the live
 * pilot. Always renders SOMETHING, no matter what's missing.
 *
 *   <Route path="/home" element={<PilotHome />} />
 *
 * Why this exists
 * ───────────────
 * The previous Home implementation (FarmerDashboardPage) is rich
 * but it depends on a long chain of context providers + server
 * calls + cached state. Any one of those breaking — a missing
 * profile, an empty farms array, a 404 from /me, a stale
 * weather payload — could either redirect the user away or
 * paint a blank screen. PilotHome takes the opposite approach:
 *
 *   • Reads everything from localStorage with try/catch + safe
 *     defaults. No context providers required.
 *   • NEVER calls navigate() — no automatic redirect can fire.
 *   • NEVER returns null. Every code path renders visible UI.
 *   • Hard-coded fallback weather + task copy so the user
 *     always sees actionable content, even on first launch.
 *   • Inline styles only — no CSS-modules / theme dependency
 *     can cause the page to render unstyled.
 *   • A "Complete your setup" card surfaces missing data
 *     INLINE rather than redirecting away. The card is
 *     optional; the page renders fine without it.
 *   • Visible debug footer prints the build version, current
 *     route, and resolved userType so engineers can sanity
 *     check the live deploy at a glance.
 *
 * Strict-rule audit
 *   • Pure presentational. Synchronous render. Never throws.
 *   • Auth + identity untouched. The page assumes the auth
 *     guard upstream has already passed.
 *   • Safe under SSR + locked-down browsers (every storage
 *     access is wrapped).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FARROWAY_BUILD_VERSION } from '../lib/forceUiReset.js';

// ─── Local-storage helpers ─────────────────────────────────────
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
    const parsed = JSON.parse(raw);
    return parsed;
  } catch { return null; }
}

function _safePath() {
  try {
    return (typeof window !== 'undefined' && window.location)
      ? window.location.pathname
      : '/home';
  } catch { return '/home'; }
}

// ─── Resolved view-model with safe defaults ────────────────────
function _resolveUserType() {
  const v = _safeGet('userType') || _safeGet('farroway_user_type');
  if (typeof v === 'string' && v.trim()) return v.trim();
  return 'farmer';
}

function _resolveLocation() {
  // Try a few well-known keys; any of them returning a non-empty
  // string counts as "set." Returning null is fine — the renderer
  // shows a fallback message in that case.
  const farm = _safeJsonGet('farroway_active_farm');
  if (farm && typeof farm === 'object') {
    const candidates = [
      farm.locationName, farm.location, farm.region, farm.country,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
  }
  return null;
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

function _resolveWeather() {
  const w = _safeJsonGet('farroway_cached_weather');
  if (w && typeof w === 'object') {
    const condition = w.condition || w.summary || w.description;
    const temp = (typeof w.temp === 'number') ? w.temp
              : (typeof w.temperature === 'number') ? w.temperature
              : null;
    if (condition || temp != null) {
      return {
        condition: condition || 'Conditions logged',
        advice: 'Plan around current conditions for best results.',
        temp,
      };
    }
  }
  return null;
}

// ─── Component ─────────────────────────────────────────────────
export default function PilotHome() {
  const [now] = useState(() => new Date());

  // Boot diagnostic — single greppable line per mount. Never logs
  // PII; just confirms PilotHome ran.
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.log('PilotHome mounted', {
        path: _safePath(),
        userType: _resolveUserType(),
        hasLocation: !!_resolveLocation(),
        hasFarm: !!_resolveFarm(),
      });
    } catch { /* swallow */ }
  }, []);

  // Resolve view-model with hard fallbacks.
  const view = useMemo(() => {
    const userType  = _resolveUserType();          // never null
    const location  = _resolveLocation();          // string | null
    const farm      = _resolveFarm();              // object | null
    const crop      = _resolveCrop(farm);          // never null
    const weather   = _resolveWeather() || {
      condition: 'Weather unavailable',
      advice:    'Add location later for weather-aware tips',
      temp:      null,
    };
    const task = {
      title:  'Check soil moisture around your ' + crop,
      reason: 'Dry weather can stress plants. Water only if the soil feels dry.',
      cta:    'Mark as done',
    };
    const setupIncomplete = !location || !farm;
    return { userType, location, farm, crop, weather, task, setupIncomplete };
  }, []);

  const greeting = (() => {
    try {
      const hour = now.getHours();
      if (hour < 12) return 'Good morning';
      if (hour < 18) return 'Good afternoon';
      return 'Good evening';
    } catch { return 'Hello'; }
  })();

  const userTypeLabel = view.userType === 'farmer'
    ? 'Farmer'
    : view.userType.charAt(0).toUpperCase() + view.userType.slice(1);

  // Mark-as-done is purely cosmetic in PilotHome — it persists
  // a sessionStorage flag so the same task doesn't re-render
  // mid-session. Real task tracking happens in the richer
  // dashboard once the pilot stabilises.
  const [taskDone, setTaskDone] = useState(() => {
    try {
      return sessionStorage.getItem('farroway_pilot_task_done') === '1';
    } catch { return false; }
  });
  function handleMarkDone() {
    try { sessionStorage.setItem('farroway_pilot_task_done', '1'); }
    catch { /* swallow */ }
    setTaskDone(true);
  }

  return (
    <div style={S.page} data-testid="pilot-home">
      <div style={S.shell}>
        {/* Header */}
        <header style={S.header}>
          <div>
            <p style={S.greeting}>{greeting}, {userTypeLabel}.</p>
            <h1 style={S.title}>Today on Farroway</h1>
          </div>
          <span style={S.statusPill}>
            <span style={S.statusDot} />
            <span>Live</span>
          </span>
        </header>

        {/* Weather card */}
        <section style={S.card} data-testid="pilot-home-weather">
          <p style={S.cardLabel}>Weather</p>
          <h2 style={S.cardTitle}>
            {view.weather.condition}
            {view.weather.temp != null
              ? ' \u00B7 ' + Math.round(view.weather.temp) + '\u00B0'
              : ''}
          </h2>
          <p style={S.cardBody}>{view.weather.advice}</p>
          {view.location ? (
            <p style={S.metaPill}>
              <span style={S.metaLabel}>Location</span>
              <span style={S.metaVal}>{view.location}</span>
            </p>
          ) : null}
        </section>

        {/* Today's task — always present, even with safe defaults */}
        <section
          style={taskDone ? S.cardDone : S.card}
          data-testid="pilot-home-task"
        >
          <p style={S.cardLabel}>Today's task</p>
          <h2 style={S.cardTitle}>{view.task.title}</h2>
          <p style={S.cardBody}>{view.task.reason}</p>
          {taskDone ? (
            <p style={S.doneNote}>{'\u2714'} Marked as done — nice work.</p>
          ) : (
            <button
              type="button"
              onClick={handleMarkDone}
              style={S.btnPrimary}
              data-testid="pilot-home-task-cta"
            >
              {view.task.cta}
            </button>
          )}
        </section>

        {/* Optional "Complete your setup" card — only when needed */}
        {view.setupIncomplete ? (
          <section style={S.setupCard} data-testid="pilot-home-setup-card">
            <p style={S.setupLabel}>Optional</p>
            <h2 style={S.setupTitle}>Complete your setup</h2>
            <p style={S.setupBody}>
              Add crop or location for better guidance. Home will
              keep working without it.
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

        {/* Quick links */}
        <section style={S.linksGrid}>
          <Link to="/tasks"    style={S.linkTile}>Today's tasks</Link>
          <Link to="/my-grow"  style={S.linkTile}>My Grow</Link>
          <Link to="/progress" style={S.linkTile}>Progress</Link>
          <Link to="/scan"     style={S.linkTile}>Scan</Link>
        </section>

        {/* Debug footer (May 2026 spec §6) — visible build,
            route, and resolved userType so engineers can
            confirm the live deploy without DevTools. Compact
            and low-contrast so it never competes with content. */}
        <footer style={S.debugFooter} data-testid="pilot-home-debug">
          <span>Farroway Build: {FARROWAY_BUILD_VERSION}</span>
          <span>Route: {_safePath()}</span>
          <span>UserType: {view.userType}</span>
        </footer>
      </div>
    </div>
  );
}

// ─── Styles (inline, no theme dependency) ──────────────────────
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
    background: 'linear-gradient(180deg, ' + C.bgTop + ' 0%, ' + C.bgBottom + ' 100%)',
    color:      C.ink,
    padding:    '1.5rem 1rem 4rem',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", '
              + 'Roboto, sans-serif',
  },
  shell: {
    maxWidth: '32rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '0.25rem',
  },
  greeting: {
    margin: 0,
    fontSize: '0.875rem',
    color: C.inkDim,
    fontWeight: 600,
  },
  title: {
    margin: '0.25rem 0 0',
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.3rem 0.6rem',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.32)',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#86EFAC',
    flexShrink: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: C.green,
    boxShadow: '0 0 0 4px rgba(34,197,94,0.18)',
  },
  card: {
    background: C.panel,
    border: '1px solid ' + C.border,
    borderRadius: '16px',
    padding: '1.25rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  cardDone: {
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.28)',
    borderRadius: '16px',
    padding: '1.25rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  cardLabel: {
    margin: 0,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.inkFaint,
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 700,
    color: C.ink,
    lineHeight: 1.3,
  },
  cardBody: {
    margin: 0,
    fontSize: '0.9375rem',
    color: C.inkDim,
    lineHeight: 1.55,
  },
  metaPill: {
    margin: '0.5rem 0 0',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.3rem 0.6rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '999px',
    fontSize: '0.75rem',
    alignSelf: 'flex-start',
  },
  metaLabel: {
    color: C.inkFaint,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontSize: '0.6875rem',
  },
  metaVal: { color: C.ink, fontFamily: 'monospace' },
  btnPrimary: {
    alignSelf: 'flex-start',
    marginTop: '0.5rem',
    padding: '0.85rem 1.4rem',
    border: 'none',
    borderRadius: '12px',
    background: C.green,
    color: C.ink,
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 46,
    boxShadow: '0 8px 22px ' + C.greenSh,
  },
  btnGhost: {
    alignSelf: 'flex-start',
    marginTop: '0.5rem',
    padding: '0.7rem 1.1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: C.ink,
    fontSize: '0.875rem',
    fontWeight: 700,
    textDecoration: 'none',
    minHeight: 40,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneNote: {
    margin: '0.25rem 0 0',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#86EFAC',
  },
  setupCard: {
    background: 'rgba(245,158,11,0.06)',
    border: '1px dashed rgba(245,158,11,0.35)',
    borderRadius: '16px',
    padding: '1.25rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  setupLabel: {
    margin: 0,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.amber,
  },
  setupTitle: {
    margin: 0,
    fontSize: '1.0625rem',
    fontWeight: 700,
    color: C.ink,
  },
  setupBody: {
    margin: 0,
    fontSize: '0.9375rem',
    color: C.inkDim,
    lineHeight: 1.5,
  },
  linksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.65rem',
    marginTop: '0.25rem',
  },
  linkTile: {
    padding: '0.95rem 0.85rem',
    background: C.panel,
    border: '1px solid ' + C.border,
    borderRadius: '12px',
    color: C.ink,
    fontSize: '0.9375rem',
    fontWeight: 700,
    textDecoration: 'none',
    textAlign: 'center',
  },
  debugFooter: {
    marginTop: '1.5rem',
    padding: '0.6rem 0.75rem',
    borderTop: '1px dashed rgba(255,255,255,0.08)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    fontSize: '0.6875rem',
    color: C.inkFaint,
    fontFamily: 'monospace',
    letterSpacing: '0.04em',
  },
};
