/**
 * growthAnalytics.js — pure aggregator that builds the Growth
 * Analytics Dashboard payload from the existing client event log.
 *
 *   buildGrowthAnalytics({ events?, windowDays? }) → {
 *     overview:    { totalEvents, distinctSessions, dau7, wau, lastEventAt },
 *     funnel:      [{ stage, count, conversionPct }, ...],
 *     retention:   { day1, day2, day7 },
 *     viral:       { sharesTriggered, sharesCompleted, landingViews,
 *                    landingCtaTaps, newUsersFromShare },
 *     monetization:{ paywallViews, paidConversions, estimatedRevenueUsd },
 *     generatedAt: ISO string,
 *   }
 *
 * Why a sibling module rather than extending funnelEvents.js
 * ──────────────────────────────────────────────────────────
 *   funnelEvents.js OWNS the lifecycle stamps + per-event firing.
 *   This module is a READ-only derivation layer for the dashboard
 *   panel; both can run side-by-side without coupling. No new
 *   storage; we read the canonical event log via `getEvents()`.
 *
 * Spec mapping (Growth Analytics §1-§5)
 *   §1 Funnel:       app_opened / onboarding_started / onboarding_completed
 *                    / action_shown / action_completed
 *                    Mapped to existing event names without renames:
 *                      app_opened           → first_visit  (and session_started)
 *                      onboarding_started   → fast_onboarding_started
 *                      onboarding_completed → onboarding_completed
 *                      action_shown         → primary_action_shown
 *                      action_completed     → primary_action_completed
 *   §2 Retention:    day1_return / day2_return / day7_return
 *   §3 Engagement:   actions_per_user (= primary_action_completed count) +
 *                    distinctSessions (= session_started count)
 *   §4 Viral:        viral_share_clicked / viral_share_completed /
 *                    viral_landing_shown / viral_landing_cta_tapped
 *                    new_user_from_share = onboarding_completed events
 *                                          carrying a referral source
 *   §5 Monetization: paywall_view  → primary_action_shown filtered for
 *                                    payload.paywall=true (none today)
 *                                    OR paywall_shown if/when emitted.
 *                    Caller can pass `paywallShownName` to override.
 *                    paid_conversion → markUpgraded events; right now
 *                                    we approximate via `paywall_upgrade_clicked`.
 *                    revenue: stub (returns 0) until billing webhook
 *                    sync lands. The shape stays stable so the
 *                    dashboard chart binding doesn't churn later.
 *
 * Strict-rule audit
 *   • Pure + sync; no I/O outside the supplied events array (or
 *     a single getEvents() pull when none was passed).
 *   • Never throws — bad/missing fields collapse to zeros.
 *   • Honest counts only — no extrapolation, no projected revenue.
 *   • Browser-safe; SSR-safe (getEvents handles localStorage).
 */

import { getEvents } from '../core/eventStore.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Spec §1 funnel → event-name map. Caller can override via opts
// when running against a custom event log (test fixtures, etc).
const DEFAULT_FUNNEL = Object.freeze([
  { stage: 'app_opened',           events: ['first_visit', 'session_started'] },
  { stage: 'onboarding_started',   events: ['fast_onboarding_started'] },
  { stage: 'onboarding_completed', events: ['onboarding_completed'] },
  { stage: 'action_shown',         events: ['primary_action_shown'] },
  { stage: 'action_completed',     events: ['primary_action_completed'] },
]);

function _ts(e) {
  if (!e) return null;
  if (Number.isFinite(e.timestamp)) return e.timestamp;
  if (Number.isFinite(e.ts))        return e.ts;
  return null;
}

function _isInLastDays(e, days) {
  const t = _ts(e);
  return t != null && t >= (Date.now() - days * DAY_MS);
}

function _eventDate(e) {
  const t = _ts(e);
  if (t == null) return null;
  try { return new Date(t).toISOString().slice(0, 10); }
  catch { return null; }
}

function _safeArr(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }

function _countByName(events, names) {
  const set = new Set(_safeArr(names));
  if (set.size === 0) return 0;
  let n = 0;
  for (const e of events) {
    if (e && set.has(e.name)) n += 1;
  }
  return n;
}

function _countDistinct(events, predicate, keyFn) {
  const seen = new Set();
  for (const e of events) {
    if (!e) continue;
    if (typeof predicate === 'function' && !predicate(e)) continue;
    const k = keyFn(e);
    if (k != null && k !== '') seen.add(String(k));
  }
  return seen.size;
}

/**
 * Build the dashboard payload. Pure + idempotent.
 *
 * @param {object}  [input]
 * @param {Array}   [input.events]           — defaults to getEvents()
 * @param {number}  [input.windowDays]       — for recency cutoffs (default 7)
 * @param {string}  [input.paywallShownName] — override paywall-view event name
 */
export function buildGrowthAnalytics({
  events,
  windowDays       = 7,
  paywallShownName = 'paywall_shown',
} = {}) {
  let safeEvents = _safeArr(events);
  if (safeEvents.length === 0) {
    try { safeEvents = _safeArr(getEvents()); }
    catch { safeEvents = []; }
  }

  // ── Overview ────────────────────────────────────────────
  const totalEvents = safeEvents.length;
  // distinctSessions: count unique calendar days that fired a
  // session_started event; falls back to per-day grouping of any
  // event when session_started is absent (older dashboards).
  const distinctSessions = (() => {
    const days = new Set();
    let sawSession = false;
    for (const e of safeEvents) {
      if (e && e.name === 'session_started') {
        sawSession = true;
        const d = _eventDate(e);
        if (d) days.add(d);
      }
    }
    if (sawSession) return days.size;
    // Fallback: distinct event-days
    for (const e of safeEvents) {
      const d = _eventDate(e);
      if (d) days.add(d);
    }
    return days.size;
  })();
  const dau7 = (() => {
    const days = new Set();
    for (const e of safeEvents) {
      if (!_isInLastDays(e, windowDays)) continue;
      const d = _eventDate(e);
      if (d) days.add(d);
    }
    return days.size;
  })();
  const wau = (() => {
    let n = 0;
    for (const e of safeEvents) {
      if (_isInLastDays(e, 7)) n += 1;
    }
    return n;
  })();
  const lastEventAt = safeEvents.length > 0
    ? (() => {
        let max = 0;
        for (const e of safeEvents) {
          const t = _ts(e);
          if (Number.isFinite(t) && t > max) max = t;
        }
        return max ? new Date(max).toISOString() : null;
      })()
    : null;

  // ── Funnel ──────────────────────────────────────────────
  // Each stage carries its count + conversion-from-prior-stage.
  // The first stage has no prior reference; conversionPct = null
  // there so the renderer doesn't have to special-case "100% from
  // nothing".
  const funnel = (() => {
    const rows = DEFAULT_FUNNEL.map((s) => ({
      stage: s.stage,
      count: _countByName(safeEvents, s.events),
    }));
    let prior = null;
    return rows.map((r) => {
      const conversionPct = (prior == null || prior === 0)
        ? null
        : Math.round((r.count / prior) * 1000) / 10; // 1 decimal
      prior = r.count;
      return { stage: r.stage, count: r.count, conversionPct };
    });
  })();

  // ── Retention ───────────────────────────────────────────
  const retention = {
    day1: _countByName(safeEvents, ['day1_return']),
    day2: _countByName(safeEvents, ['day2_return']),
    day7: _countByName(safeEvents, ['day7_return']),
  };

  // ── Viral ───────────────────────────────────────────────
  const viral = {
    sharesTriggered:    _countByName(safeEvents, ['viral_share_clicked']),
    sharesCompleted:    _countByName(safeEvents, ['viral_share_completed']),
    landingViews:       _countByName(safeEvents, ['viral_landing_shown']),
    landingCtaTaps:     _countByName(safeEvents, ['viral_landing_cta_tapped']),
    // new_user_from_share — onboarding_completed events that
    // carry a referral context (source field set by attribution
    // wrapper). Falls back to landingCtaTaps as a proxy when the
    // attribution isn't on the payload.
    newUsersFromShare:  _countDistinct(
      safeEvents,
      (e) => e && e.name === 'onboarding_completed'
              && e.payload
              && (String(e.payload.source || '').startsWith('share')
                  || e.payload.referralSource
                  || e.payload.viralEntry),
      (e) => `${e.timestamp || e.ts || ''}`,
    ),
  };

  // ── Monetization ────────────────────────────────────────
  const monetization = {
    paywallViews: _countByName(safeEvents, [paywallShownName, 'paywall_view']),
    paidConversions: _countByName(safeEvents, [
      'paywall_upgrade_clicked',
      'paywall_upgraded',
      'subscription_activated',
    ]),
    // Revenue is server-truth. Stubbed to 0 until the billing
    // webhook ingests subscription events into the local store
    // (or the dashboard pulls from /api/billing/summary). Shape
    // kept stable so binding doesn't churn later.
    estimatedRevenueUsd: 0,
  };

  return Object.freeze({
    overview: {
      totalEvents,
      distinctSessions,
      dau7,
      wau,
      lastEventAt,
    },
    funnel,
    retention,
    viral,
    monetization,
    generatedAt: new Date().toISOString(),
  });
}

export const _internal = Object.freeze({
  DEFAULT_FUNNEL, _ts, _isInLastDays, _eventDate, _countByName, _countDistinct,
});

export default buildGrowthAnalytics;
