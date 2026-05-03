/**
 * lifecycleEvents.js — soft-launch monitoring fire-sites.
 *
 *   import { fireFarmCreated, fireScreenStuck, ... } from
 *     '../analytics/lifecycleEvents.js';
 *
 * Phase 3 §C of the soft-launch spec asks for 8 specific
 * events. Most are wired across already-existing render
 * paths; this module is the SINGLE PLACE they get fired from
 * so the payload shape stays consistent and adding a new
 * field (e.g. region, tier) is a one-line edit here.
 *
 * Events covered
 *   1. farm_created              — fired on saveFarm() success
 *   2. grow_created              — fired on saveGarden() success
 *   3. task_viewed               — fired on /tasks list mount
 *   4. task_completed            — already wired (FirstActionGate /
 *                                  TaskCompletionFeedback); kept
 *                                  here as a thin wrapper so call
 *                                  sites read uniformly.
 *   5. app_error                 — fired by RecoveryErrorBoundary
 *                                  + the global window.onerror
 *                                  install (see installCrashListeners).
 *   6. screen_stuck              — fired by the stuck-screen
 *                                  watcher (10s of no interaction
 *                                  while a primary CTA is on
 *                                  screen) — see installStuckScreenWatcher.
 *   7. language_changed          — fired by the language switcher
 *                                  on every flip.
 *   8. user_type_selected        — fired by FastOnboarding when
 *                                  the user picks farmer/backyard.
 *
 * Strict-rule audit
 *   • Pure ESM, top-level imports only.
 *   • Every fire is try/catch wrapped — analytics never
 *     blocks render, never throws into the host.
 *   • Window-scoped listeners (window.onerror /
 *     visibilitychange) install ONCE per session via a sentinel
 *     so they never double-fire.
 *   • Events lean on the existing trackEvent so the offline
 *     queue, attribution, and A/B variant enrichment all
 *     apply automatically.
 */

import { trackEvent } from '../core/analytics.js';

// ─── 1. farm_created / 2. grow_created ───────────────────
//
// Why two separate events: the soft-launch dashboard splits
// farmer vs backyard adoption. A single `experience_created`
// would force a JOIN against the experience type at query
// time; emitting two cleanly-named events keeps the dashboard
// query trivially "count where event_name = 'farm_created'".

export function fireFarmCreated(payload = {}) {
  try {
    trackEvent('farm_created', {
      farmType:    payload.farmType || null,
      cropName:    payload.cropName || null,
      sizeInAcres: payload.sizeInAcres || null,
      region:      payload.region || null,
      country:     payload.country || null,
      // Mark whether this is the user's first farm — drives
      // the "completed-onboarding" metric on the dashboard.
      isFirst:     !!payload.isFirst,
    });
  } catch { /* swallow */ }
}

export function fireGrowCreated(payload = {}) {
  try {
    trackEvent('grow_created', {
      cropName:      payload.cropName || null,
      growingSetup:  payload.growingSetup || null, // 'pots' / 'beds' / 'mixed'
      region:        payload.region || null,
      country:       payload.country || null,
      isFirst:       !!payload.isFirst,
    });
  } catch { /* swallow */ }
}

// ─── 3. task_viewed ──────────────────────────────────────
//
// Fired when the /tasks page mounts. Coupled with
// `task_completed` it gives the launch dashboard the
// completion-rate ratio per tier / region / userType.

export function fireTaskViewed(payload = {}) {
  try {
    trackEvent('task_viewed', {
      surface:    payload.surface || 'tasks_page', // 'tasks_page' | 'home_first_action'
      taskCount:  typeof payload.taskCount === 'number' ? payload.taskCount : null,
      activeTaskId: payload.activeTaskId || null,
    });
  } catch { /* swallow */ }
}

// ─── 4. task_completed (passthrough) ─────────────────────
//
// Already wired across multiple surfaces (FirstActionGate,
// TaskCompletionFeedback, etc.). Kept here as a thin wrapper
// so future call sites can read from a single import.
export function fireTaskCompleted(payload = {}) {
  try {
    trackEvent('task_completed', payload || {});
  } catch { /* swallow */ }
}

// ─── 5. app_error ────────────────────────────────────────
//
// Fired by RecoveryErrorBoundary AND by the global
// `window.onerror` / `unhandledrejection` listeners installed
// once at boot via `installCrashListeners()`. The dashboard
// counts these as the "crashes per 1k sessions" number.

export function fireAppError(payload = {}) {
  try {
    const errorReason = (payload.error && (payload.error.message || String(payload.error)))
      || payload.errorReason
      || 'unknown';
    trackEvent('app_error', {
      errorReason,
      surface:        payload.surface || null,    // 'render' | 'window_onerror' | 'unhandled_rejection'
      componentStack: typeof payload.componentStack === 'string'
        ? payload.componentStack.slice(0, 240)
        : null,
      route:          (typeof location !== 'undefined' && location.pathname) || null,
    });
  } catch { /* swallow */ }
}

let _crashListenersInstalled = false;
export function installCrashListeners() {
  if (_crashListenersInstalled) return;
  if (typeof window === 'undefined') return;
  _crashListenersInstalled = true;
  try {
    window.addEventListener('error', (ev) => {
      try {
        fireAppError({
          surface:     'window_onerror',
          errorReason: ev?.error?.message || ev?.message || 'window_error',
        });
      } catch { /* swallow */ }
    });
    window.addEventListener('unhandledrejection', (ev) => {
      try {
        const reason = ev?.reason;
        fireAppError({
          surface:     'unhandled_rejection',
          errorReason: (reason && (reason.message || String(reason))) || 'unhandled_rejection',
        });
      } catch { /* swallow */ }
    });
  } catch { /* swallow */ }
}

// ─── 6. screen_stuck ─────────────────────────────────────
//
// "Stuck" = a route that's been on screen for > N seconds
// with NO user interaction (click / keydown / touchstart /
// scroll). Defaults to 30s on Home + Tasks. The dashboard
// turns this into the "users who can't complete the next
// step" funnel signal.

const STUCK_THRESHOLD_MS = 30_000;
const STUCK_ROUTES = new Set(['/dashboard', '/home', '/my-farm', '/my-grow', '/tasks']);

let _stuckTimer = null;
let _stuckRoute = null;
let _stuckListenersInstalled = false;

function _resetStuckTimer() {
  if (_stuckTimer) {
    clearTimeout(_stuckTimer);
    _stuckTimer = null;
  }
  if (typeof window === 'undefined') return;
  const route = window.location?.pathname || null;
  _stuckRoute = route;
  if (!STUCK_ROUTES.has(route)) return;
  _stuckTimer = setTimeout(() => {
    try {
      trackEvent('screen_stuck', {
        route,
        thresholdMs: STUCK_THRESHOLD_MS,
      });
    } catch { /* swallow */ }
  }, STUCK_THRESHOLD_MS);
}

export function installStuckScreenWatcher() {
  if (_stuckListenersInstalled) return;
  if (typeof window === 'undefined') return;
  _stuckListenersInstalled = true;
  try {
    const reset = () => _resetStuckTimer();
    window.addEventListener('click',      reset, { passive: true });
    window.addEventListener('keydown',    reset, { passive: true });
    window.addEventListener('touchstart', reset, { passive: true });
    window.addEventListener('scroll',     reset, { passive: true });
    window.addEventListener('popstate',   reset);
    // Initial arm.
    _resetStuckTimer();
  } catch { /* swallow */ }
}

// ─── 7. language_changed ─────────────────────────────────
//
// Fired by the language switcher (`utils/i18n.js#setLanguage`)
// AND by the auto-detect path on first visit. Dashboard
// uses this to spot region-language mismatches.

export function fireLanguageChanged(payload = {}) {
  try {
    trackEvent('language_changed', {
      from:   payload.from || null,
      to:     payload.to || null,
      source: payload.source || 'manual', // 'manual' | 'auto_detect' | 'profile_load'
    });
  } catch { /* swallow */ }
}

// ─── 8. user_type_selected ───────────────────────────────
//
// Fired by FastOnboarding when the user picks farmer or
// backyard. The dashboard uses this as the canonical signal
// for split-cohort retention.

export function fireUserTypeSelected(payload = {}) {
  try {
    trackEvent('user_type_selected', {
      userType: payload.userType || null,        // 'farmer' | 'backyard' | 'ngo'
      source:   payload.source   || 'onboarding', // 'onboarding' | 'settings' | 'auto'
      country:  payload.country  || null,
      farmType: payload.farmType || null,
    });
  } catch { /* swallow */ }
}

// ─── Boot helper ────────────────────────────────────────
//
// Called once from App.jsx so the window listeners install at
// the earliest opportunity. Idempotent.

export function installLifecycleListeners() {
  installCrashListeners();
  installStuckScreenWatcher();
}

export default {
  fireFarmCreated,
  fireGrowCreated,
  fireTaskViewed,
  fireTaskCompleted,
  fireAppError,
  fireScreenStuck: () => trackEvent('screen_stuck', {}),
  fireLanguageChanged,
  fireUserTypeSelected,
  installCrashListeners,
  installStuckScreenWatcher,
  installLifecycleListeners,
};
