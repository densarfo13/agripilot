/**
 * funnelEvents.js — pure tracking helpers for the funnel
 * optimisation spec.
 *
 * Spec coverage (Funnel optimisation §10)
 *   • first_action_rate     — fired once per device on first
 *                              meaningful action (scan, task,
 *                              listing).
 *   • time_to_value         — first-visit-to-first-action delta
 *                              in milliseconds; emitted with
 *                              `first_action_completed`.
 *   • day2_return_rate      — fired once on the first session of
 *                              the second calendar day after a
 *                              first visit.
 *   • task_completion_rate, listing_created, interest_clicked —
 *                              already wired from prior commits;
 *                              this module exposes typed wrappers
 *                              so call sites stay self-documenting.
 *
 * Storage
 *   farroway_funnel_first_visit       : ISO of first mount
 *   farroway_funnel_first_action      : ISO of first action
 *   farroway_funnel_last_session_day  : YYYY-MM-DD of last session
 *   farroway_funnel_day2_seen         : 'true' once D2 fires
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Pure module functions; safe to import from any surface.
 *   • Every helper is idempotent on the relevant stamp so a
 *     re-mount (StrictMode, hot reload) doesn't double-fire.
 */

import { trackEvent } from './analyticsStore.js';
import { getAttributionContext } from './attribution.js';

// Every funnel event auto-attaches the attribution context
// (source / country / experience) so by-source dashboards can
// partition without re-deriving on the read side. Helper merges
// only non-null fields so payloads stay clean.
function _withContext(payload) {
  let ctx = {};
  try { ctx = getAttributionContext() || {}; } catch { ctx = {}; }
  return { ...(payload || {}), ...(ctx || {}) };
}

const FIRST_VISIT_KEY  = 'farroway_funnel_first_visit';
const FIRST_ACTION_KEY = 'farroway_funnel_first_action';
const LAST_SESSION_DAY = 'farroway_funnel_last_session_day';
const DAY2_SEEN_KEY    = 'farroway_funnel_day2_seen';
// Growth Analytics §2 — additional retention markers. The
// existing day2_return wrap-around marker stays untouched; the
// d1/d7 markers run alongside via the same idempotent pattern.
const DAY1_SEEN_KEY    = 'farroway_funnel_day1_seen';
const DAY7_SEEN_KEY    = 'farroway_funnel_day7_seen';

function _safeRead(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeWrite(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value || ''));
  } catch { /* swallow */ }
}

function _todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * stampFirstVisit — call from a top-level mount (e.g. App or
 * the entry route). Idempotent — only the FIRST call per device
 * actually writes.
 */
export function stampFirstVisit({ source = 'app_mount' } = {}) {
  const existing = _safeRead(FIRST_VISIT_KEY);
  if (existing) return existing;
  const stamp = new Date().toISOString();
  _safeWrite(FIRST_VISIT_KEY, stamp);
  try {
    trackEvent('first_visit', _withContext({ source, at: stamp }));
  } catch { /* swallow */ }
  return stamp;
}

/**
 * trackFirstAction — call when the user performs the first
 * meaningful action (scan submitted, task completed, listing
 * created). Idempotent across calls on the same device. Emits
 * `first_action_completed` with `time_to_value_ms` derived from
 * the first-visit stamp.
 *
 * @param {string} action  scan | task_completed | listing_created
 * @param {object} [extra]
 */
export function trackFirstAction(action, extra = {}) {
  if (!action) return null;
  const existing = _safeRead(FIRST_ACTION_KEY);
  if (existing) return existing;
  const now = Date.now();
  const stamp = new Date(now).toISOString();
  _safeWrite(FIRST_ACTION_KEY, stamp);

  const visitISO = _safeRead(FIRST_VISIT_KEY);
  const visitMs = Date.parse(visitISO || '');
  const timeToValueMs = Number.isFinite(visitMs)
    ? Math.max(0, now - visitMs)
    : null;

  try {
    trackEvent('first_action_completed', _withContext({
      action,
      timeToValueMs,
      at: stamp,
      ...(extra && typeof extra === 'object' ? extra : {}),
    }));
  } catch { /* swallow */ }
  return stamp;
}

/**
 * markSessionStart — fire once per local calendar day. When the
 * second-day session is detected (the day after first visit),
 * emits `day2_return`. Subsequent days continue to log
 * `session_started` so the analytics dashboard can derive the
 * rolling retention curve.
 */
export function markSessionStart() {
  const today = _todayISO();
  const lastDay = _safeRead(LAST_SESSION_DAY);
  if (lastDay === today) return; // already counted today
  _safeWrite(LAST_SESSION_DAY, today);

  try {
    trackEvent('session_started', _withContext({ day: today }));
  } catch { /* swallow */ }

  // Growth Analytics §2 — retention day-N detection. We fire each
  // marker exactly once per device on the first session that
  // crosses its threshold (1 / 2 / 7 calendar days since the
  // first-visit stamp). Each marker has its own DAY*_SEEN_KEY so
  // they're independent — a user who opens on day 7 without
  // appearing on day 1 still gets `day7_return` correctly.
  const visitISO = _safeRead(FIRST_VISIT_KEY);
  if (visitISO) {
    const visitDay = String(visitISO).slice(0, 10);
    const visitMs  = Date.parse(visitISO || '');
    const dayDelta = (() => {
      if (!Number.isFinite(visitMs)) return 0;
      const a = Date.parse(`${visitDay}T00:00:00Z`);
      const b = Date.parse(`${today}T00:00:00Z`);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
      return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
    })();
    const elapsedMs = Number.isFinite(visitMs)
      ? Math.max(0, Date.now() - visitMs)
      : null;

    // d1 — fires on session ≥ 1 day after first visit.
    if (dayDelta >= 1 && _safeRead(DAY1_SEEN_KEY) !== 'true') {
      _safeWrite(DAY1_SEEN_KEY, 'true');
      try {
        trackEvent('day1_return', _withContext({
          firstVisit: visitISO,
          elapsedMs,
          dayDelta,
        }));
      } catch { /* swallow */ }
    }

    // d2 — preserved exact behaviour (separate stamp + same
    // payload shape as before so existing dashboards keep working).
    if (dayDelta >= 1 && _safeRead(DAY2_SEEN_KEY) !== 'true') {
      // d2 historically fired on first session whose visitDay
      // < today. Keep that behaviour but only when the cohort
      // is genuinely past day 1 (dayDelta >= 1 guards both).
      _safeWrite(DAY2_SEEN_KEY, 'true');
      try {
        trackEvent('day2_return', _withContext({
          firstVisit: visitISO,
          elapsedMs,
        }));
      } catch { /* swallow */ }
    }

    // d7 — fires on session ≥ 7 days after first visit.
    if (dayDelta >= 7 && _safeRead(DAY7_SEEN_KEY) !== 'true') {
      _safeWrite(DAY7_SEEN_KEY, 'true');
      try {
        trackEvent('day7_return', _withContext({
          firstVisit: visitISO,
          elapsedMs,
          dayDelta,
        }));
      } catch { /* swallow */ }
    }
  }
}

/** Read-only snapshot for surfaces that want to nudge contextually. */
export function getFunnelState() {
  return {
    firstVisit:     _safeRead(FIRST_VISIT_KEY),
    firstAction:    _safeRead(FIRST_ACTION_KEY),
    lastSessionDay: _safeRead(LAST_SESSION_DAY),
    day1Seen:       _safeRead(DAY1_SEEN_KEY) === 'true',
    day2Seen:       _safeRead(DAY2_SEEN_KEY) === 'true',
    day7Seen:       _safeRead(DAY7_SEEN_KEY) === 'true',
  };
}

export default {
  stampFirstVisit,
  trackFirstAction,
  markSessionStart,
  getFunnelState,
};
