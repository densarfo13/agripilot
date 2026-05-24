/**
 * programAnalyticsEngine.js — program-level rollups for the
 * NGO admin surface.
 *
 *   import { computeProgramAnalytics }
 *     from 'src/core/ngo/programAnalyticsEngine.js';
 *
 *   const p = computeProgramAnalytics({
 *     programId: 'p1',
 *     farmers: [...],            // cohort
 *     events:  [...],            // analytics events
 *     nowMs:   Date.now(),
 *   });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Aggregates the structured events we already capture
 *   (scan_succeeded / scan_failed / task_completed /
 *   notification_opened / harvest_logged) into program-level
 *   counters. Returns 30-day rolling windows.
 *
 *   It is NOT a real-time feed (the surface should re-fetch on
 *   open or on operator action). It does NOT include PII —
 *   counters only, never user-level rows.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

const _DAY = 86400000;

function _windowEvents(events, nowMs, days) {
  if (!Array.isArray(events)) return [];
  const cutoff = (Number.isFinite(nowMs) ? nowMs : Date.now()) - days * _DAY;
  return events.filter((e) => e && Number.isFinite(Number(e.at)) && Number(e.at) >= cutoff);
}

function _countBy(events, type) {
  return events.filter((e) => e && e.type === type).length;
}

/**
 * @param {object} ctx
 * @returns {object}
 */
export function computeProgramAnalytics(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();
    const farmers = Array.isArray(c.farmers) ? c.farmers : [];
    const events30 = _windowEvents(c.events, nowMs, 30);
    const events7  = _windowEvents(c.events, nowMs, 7);

    const scanSucceeded30  = _countBy(events30, 'scan_succeeded');
    const scanFailed30     = _countBy(events30, 'scan_failed');
    const tasksCompleted30 = _countBy(events30, 'task_completed');
    const notifsOpened30   = _countBy(events30, 'notification_opened');
    const harvestsLogged30 = _countBy(events30, 'harvest_logged');

    const scansTotal30 = scanSucceeded30 + scanFailed30;
    const scanSuccessPct = scansTotal30 > 0
      ? Math.round((scanSucceeded30 / scansTotal30) * 1000) / 10
      : null;

    return {
      ok:                true,
      programId:         c.programId || null,
      cohortSize:        farmers.length,
      window:            { days30: events30.length, days7: events7.length },
      scans:             { succeeded30: scanSucceeded30, failed30: scanFailed30, successPct: scanSuccessPct },
      tasks:             { completed30: tasksCompleted30 },
      notifications:     { opened30: notifsOpened30 },
      harvests:          { logged30: harvestsLogged30 },
      generatedAt:       nowMs,
      isEstimate:        true,
      disclaimer:        { key: 'ngo.programAnalytics.disclaimer',
                           fallback: 'Program metrics aggregate the last 30 days. PII is never included.' },
    };
  } catch {
    return {
      ok: false, programId: null, cohortSize: 0,
      window: { days30: 0, days7: 0 },
      scans: { succeeded30: 0, failed30: 0, successPct: null },
      tasks: { completed30: 0 },
      notifications: { opened30: 0 },
      harvests: { logged30: 0 },
      generatedAt: Date.now(), isEstimate: true,
      disclaimer: { key: 'ngo.programAnalytics.disclaimer',
                    fallback: 'Program metrics unavailable.' },
    };
  }
}

const _module = { computeProgramAnalytics };
export default _module;
