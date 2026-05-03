/**
 * paywall.js — client-side paywall state + trigger logic for
 * the Pro tier upsell.
 *
 *   import {
 *     shouldShowPaywall, markPaywallShown,
 *     isPro, markUpgraded, dismissPaywall,
 *     PAYWALL_TRIGGERS,
 *   } from '../core/paywall.js';
 *
 *   if (shouldShowPaywall('days_milestone', getEngagement())) {
 *     setPaywallOpen(true);
 *     markPaywallShown('days_milestone');
 *   }
 *
 * Scope (strict UI-only)
 * ──────────────────────
 *   • This is a CLIENT-SIDE GATE. There is no billing integration
 *     in this module — `isPro()` reads a localStorage flag that
 *     the team will later sync with a server-side subscription
 *     check. The seam is one read in `isPro()`; swapping to a
 *     server fetch is a 5-line change.
 *   • Triggers don't auto-fire. Caller decides WHEN to call
 *     `shouldShowPaywall(trigger, engagement)` — typical points:
 *       • on Home mount once per session    (days_milestone)
 *       • on "Why?" tap on the gate          (why_tap)
 *       • on Scan CTA tap                    (scan_tap)
 *       • on Advanced-insight tile tap       (advanced_insight)
 *
 * Triggers + per-trigger dedup
 * ────────────────────────────
 * Each trigger has its own dedup window:
 *   • days_milestone — once per 14 days
 *   • why_tap        — once per session
 *   • scan_tap       — once per 7 days
 *   • advanced_insight — once per 7 days
 *
 * Pro users always get `false` from `shouldShowPaywall`. Same for
 * users who explicitly dismissed within a recent window (24h).
 *
 * Privacy + safety
 *   • Never throws.
 *   • All keys namespaced under `farroway_pro_*`.
 *   • Existing `clearFarrowayActivityData()` does NOT touch
 *     auth/billing-shaped keys; this module's keys are deliberately
 *     activity-shaped (`farroway_pro_seen_*`) so the privacy
 *     reset path can also wipe them via a follow-up patch.
 */

export const PAYWALL_TRIGGERS = Object.freeze({
  DAYS_MILESTONE:   'days_milestone',
  WHY_TAP:          'why_tap',
  SCAN_TAP:         'scan_tap',
  ADVANCED_INSIGHT: 'advanced_insight',
  // Freemium spec §3 — fire after a 3-day streak, distinct from
  // the existing days_milestone (which is days-active, not
  // consecutive). Caller passes engagement.streakDays so the
  // gate fires after the user's 3rd consecutive Done tap.
  STREAK_3_DAY:     'streak_3_day',
});

const KEYS = Object.freeze({
  IS_PRO:        'farroway_pro_status',          // 'true' | (absent)
  DISMISSED_AT:  'farroway_pro_dismissed_at',    // ms-epoch
  SEEN_PREFIX:   'farroway_pro_seen_',           // + trigger
});

const DEDUP_MS = Object.freeze({
  days_milestone:   14 * 24 * 60 * 60 * 1000,
  why_tap:          0,                          // session-scoped (in-memory)
  scan_tap:         7  * 24 * 60 * 60 * 1000,
  advanced_insight: 7  * 24 * 60 * 60 * 1000,
  // Freemium §3 — once per 14 days. Long enough that a user who
  // dismissed and went back to using the free tier doesn't get
  // re-prompted on every streak rollover.
  streak_3_day:     14 * 24 * 60 * 60 * 1000,
});

const RECENT_DISMISS_WINDOW_MS = 24 * 60 * 60 * 1000;

const _sessionShownTriggers = new Set();

function _readNum(key) {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

function _writeNum(key, n) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(n));
  } catch { /* ignore */ }
}

function _readStr(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _writeStr(key, v) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(v));
  } catch { /* ignore */ }
}

function _remove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

// ─── Pro status (read-only client signal) ─────────────────────

/**
 * Is the user currently Pro? Reads the local flag — when the
 * team wires server-side billing, swap this body to fetch from
 * /api/billing/me and cache the result. Every consumer of this
 * function will pick up the change automatically.
 *
 * Defaults to false; intentionally optimistic in the wrong
 * direction (better to gate a Pro feature than to let a non-Pro
 * user through it).
 */
export function isPro() {
  return _readStr(KEYS.IS_PRO) === 'true';
}

/**
 * Freemium spec §2 — `isProUser` is the canonical name the spec
 * asks call sites to use as a feature flag (e.g.
 * `if (!isProUser()) showPaywall(...)`). Aliased to `isPro()` so
 * existing call sites keep working unchanged.
 */
export const isProUser = isPro;

/**
 * Optimistic local mark — caller flips this once the team's
 * billing flow returns success. Intentionally NOT bound to a
 * server check here so the UI can reflect the state immediately.
 */
export function markUpgraded() {
  _writeStr(KEYS.IS_PRO, 'true');
  // Clear any per-trigger seen markers so a future downgrade +
  // re-upgrade flow isn't blocked by stale dedup.
  for (const t of Object.values(PAYWALL_TRIGGERS)) {
    _remove(KEYS.SEEN_PREFIX + t);
  }
  _remove(KEYS.DISMISSED_AT);
}

/**
 * Reset the Pro flag — exposed so a future "downgrade" / sign-out
 * path can call it. Tests use it too.
 */
export function clearProStatus() {
  _remove(KEYS.IS_PRO);
}

// ─── Trigger logic ────────────────────────────────────────────

/**
 * Should the paywall fire for `trigger` given `engagement`?
 *
 * @param {string} trigger    one of PAYWALL_TRIGGERS values
 * @param {{ engagementLevel?: string, daysActive?: number, actionsCompleted?: number }} [engagement]
 * @returns {boolean}
 */
export function shouldShowPaywall(trigger, engagement = {}) {
  if (!trigger) return false;
  if (isPro()) return false;
  if (_recentlyDismissed()) return false;

  // Engagement gate (Monetisation §2: "Trigger when user
  // completes 3–5 days"). The 'engaged' tier in
  // userEngagement.js maps to that band; accept also 'power'.
  const level  = String((engagement && engagement.engagementLevel) || '').toLowerCase();
  const days   = Number((engagement && engagement.daysActive) || 0);
  const acts   = Number((engagement && engagement.actionsCompleted) || 0);
  const streak = Number((engagement && engagement.streakDays) || 0);
  const isEngaged = (level === 'engaged' || level === 'power')
                  || days >= 3
                  || acts >= 5;

  // Freemium spec §3 — STREAK_3_DAY is gated by `streakDays >= 3`
  // (consecutive completed days), independent of the broader
  // engagement signal. The user has earned a Pro look only after
  // they've felt the value 3 days in a row.
  if (trigger === PAYWALL_TRIGGERS.STREAK_3_DAY) {
    if (!Number.isFinite(streak) || streak < 3) return false;
    return !_alreadyShown(trigger);
  }

  // Freemium spec §3 + §6 — SCAN_TAP fires WITHOUT an engagement
  // gate. Spec lists Scan as a Pro feature and "tap Scan" as a
  // direct trigger; the user has explicitly asked for the gated
  // feature, so the modal is helpful, not aggressive. The 7-day
  // dedup window keeps it from re-firing on repeated taps.
  // Most other triggers want an "engaged" user. The "why_tap" /
  // "advanced_insight" triggers are content-driven — the user
  // explicitly asked for the gated feature, so we show the
  // paywall regardless of engagement.
  const requiresEngagement = trigger === PAYWALL_TRIGGERS.DAYS_MILESTONE;
  if (requiresEngagement && !isEngaged) return false;

  return !_alreadyShown(trigger);
}

function _recentlyDismissed() {
  const at = _readNum(KEYS.DISMISSED_AT);
  if (!at) return false;
  return (Date.now() - at) < RECENT_DISMISS_WINDOW_MS;
}

function _alreadyShown(trigger) {
  if (trigger === PAYWALL_TRIGGERS.WHY_TAP) {
    return _sessionShownTriggers.has(trigger);
  }
  const last = _readNum(KEYS.SEEN_PREFIX + trigger);
  if (!last) return false;
  const window = DEDUP_MS[trigger] || 0;
  return (Date.now() - last) < window;
}

/**
 * Stamp "this trigger fired" so the dedup window applies. Call
 * AFTER you've decided to actually render the paywall.
 */
export function markPaywallShown(trigger) {
  if (!trigger) return;
  if (trigger === PAYWALL_TRIGGERS.WHY_TAP) {
    _sessionShownTriggers.add(trigger);
    return;
  }
  _writeNum(KEYS.SEEN_PREFIX + trigger, Date.now());
}

/**
 * User dismissed the paywall (close button / Maybe-later link).
 * Records the dismiss time so we don't re-show within the
 * 24h cooldown window.
 */
export function dismissPaywall() {
  _writeNum(KEYS.DISMISSED_AT, Date.now());
}

export const _internal = Object.freeze({
  KEYS, DEDUP_MS, RECENT_DISMISS_WINDOW_MS,
  _readNum, _writeNum, _readStr, _writeStr, _remove,
});
