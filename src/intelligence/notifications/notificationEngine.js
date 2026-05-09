/**
 * notificationEngine — orchestrator for the calm-intelligence
 * notification system.
 *
 *   import { buildNotification, queueNotifications, getQueuedNotifications }
 *     from 'src/intelligence/notifications/notificationEngine.js';
 *
 *   const list = queueNotifications(intelligenceContext);
 *   list.forEach((n) => renderInAppFeedRow(n));
 *
 * RESPONSIBILITIES
 *   1. Run a small rule set against the supplied IntelligenceContext
 *      to identify candidate notifications.
 *   2. For each candidate:
 *        a. Resolve a template (calm copy + priority + route).
 *        b. Run the dedup cooldown — drop if too recent.
 *        c. Ask the scheduler whether NOW is the right time.
 *        d. Render title + body + action via the safety filter.
 *        e. Mark delivered (when `commit: true`).
 *   3. Return ONLY the messages safe to render right now. Deferred
 *      messages return their `scheduledAt` so the in-app feed can
 *      hold them.
 *
 * STRICT-RULE AUDIT
 *   • Pure with respect to commits — `commit: false` (default in
 *     tests) does NOT touch the dedup store.
 *   • Never throws. Returns [] on bad input.
 *   • The forbidden-wording filter from the intelligence adapter
 *     runs as a final safety net on every visible string.
 */

import { resolveTemplate, renderTemplate } from './notificationTemplates.js';
import { evaluateSchedule } from './notificationScheduler.js';
import { shouldDeliver, markDelivered } from './notificationDeduplication.js';
import { normalizePriority } from './notificationPriority.js';
import { forbiddenWordingFilter } from '../core/farmerInsightAdapter.js';

// ─── Candidate identification ────────────────────────────────────

/**
 * From a normalized IntelligenceContext, produce the list of
 * notification candidates. Each candidate is an opaque
 * `{ id, kind, key, vars, priority? }` envelope; the engine
 * rendres it later via the template library.
 *
 * Spec §3 examples:
 *   weather:rain | weather:heat | weather:wind | weather:cold
 *   task:morning | task:complete | task:missed | task:stage_progress
 *   scan_followup:default | scan:improvement | scan:retake
 *   buyer:interest_nearby | buyer:demand_up
 *   funding:opportunity_nearby
 *   progress:evening_summary
 *
 * @param {import('../core/intelligenceTypes.js').IntelligenceContext} context
 * @returns {Array<object>}
 */
export function identifyCandidates(context) {
  if (!context || typeof context !== 'object') return [];
  const out = [];

  // Weather — rain dominates; heat second; wind/cold third.
  const w = context.weather || {};
  const rainProb = Number(w.rainProbability ?? w.precipitationProbability ?? w.rainProb);
  const tempC    = Number(w.tempC ?? w.temperature ?? w.temp);
  const windKph  = Number(w.windKph ?? w.windSpeedKph ?? w.wind);
  const region   = String(context.region || '');
  if (Number.isFinite(rainProb) && rainProb >= 0.6) {
    out.push({
      id:   'weather:rain',
      kind: 'weather',
      key:  'rain',
      vars: { regionSuffix: region ? ' in ' + region : '' },
    });
  } else if (Number.isFinite(tempC) && tempC >= 32) {
    out.push({
      id:   'weather:heat',
      kind: 'weather',
      key:  'heat',
      vars: { regionSuffix: region ? ' in ' + region : '' },
    });
  } else if (Number.isFinite(windKph) && windKph >= 35) {
    out.push({ id: 'weather:wind', kind: 'weather', key: 'wind', vars: {} });
  } else if (Number.isFinite(tempC) && tempC <= 5) {
    out.push({ id: 'weather:cold', kind: 'weather', key: 'cold', vars: {} });
  }

  // Tasks — morning summary OR completion celebration.
  const tasks = Array.isArray(context.tasks) ? context.tasks : [];
  const open  = tasks.filter((t) => t && !t.completed);
  const done  = tasks.filter((t) => t && t.completed);
  if (open.length > 0) {
    out.push({
      id:   'task:morning',
      kind: 'task',
      key:  'morning',
      vars: { count: open.length },
    });
  } else if (done.length > 0) {
    out.push({
      id:   'task:complete',
      kind: 'task',
      key:  'complete',
      vars: {},
    });
  }

  // Scan follow-up — first scan in history flagged.
  const recentScan = (context.scanHistory || [])[0];
  if (recentScan && typeof recentScan === 'object'
      && recentScan.category && recentScan.category !== 'healthy'
      && recentScan.category !== 'no_issue_detected') {
    out.push({
      id:   'scan_followup:default',
      kind: 'scan_followup',
      key:  String(recentScan.scanId || recentScan.id || ''),
      vars: {},
    });
  }

  // Buyer interest — at least one buyer interest entry attached
  // to a listing.
  const bi = Array.isArray(context.buyerInterest) ? context.buyerInterest : [];
  if (bi.length > 0) {
    out.push({
      id:   'buyer:interest_nearby',
      kind: 'buyer',
      key:  String((bi[0] && bi[0].id) || 'first'),
      vars: { region: region || 'your area' },
    });
  }

  // Funding — at least one match.
  const fm = Array.isArray(context.fundingMatches) ? context.fundingMatches : [];
  if (fm.length > 0) {
    out.push({
      id:   'funding:opportunity_nearby',
      kind: 'funding',
      key:  String((fm[0] && fm[0].id) || 'first'),
      vars: {},
    });
  }

  return out;
}

// ─── Build (no commit) ───────────────────────────────────────────

/**
 * Build a SINGLE notification from a candidate envelope. Returns
 * null when the template is unknown OR the dedup cooldown is
 * active OR the scheduler defers it. Caller can pass
 * `{ commit: true }` to mark the dedup store on success.
 *
 * @param {object} candidate
 * @param {object} [opts]
 * @param {Date}   [opts.now]
 * @param {boolean} [opts.commit=false]
 * @returns {object|null}
 */
export function buildNotification(candidate, opts = {}) {
  if (!candidate || typeof candidate !== 'object') return null;
  const id   = String(candidate.id || '');
  const kind = String(candidate.kind || '');
  const key  = String(candidate.key || '');
  const tpl  = resolveTemplate(id);
  if (!tpl) return null;

  const now = (opts.now instanceof Date) ? opts.now : new Date();

  // Cooldown gate — never re-deliver inside the dedup window.
  if (!shouldDeliver(kind, key, now)) return null;

  // Scheduler — quiet hours / preferred window.
  const sched = evaluateSchedule({ kind, priority: tpl.priority }, now);
  if (!sched.canDeliverNow) {
    // Defer: return a candidate envelope the in-app queue can hold,
    // without committing to dedup yet (it'll commit when delivered).
    return Object.freeze({
      id,
      kind,
      key,
      priority:    normalizePriority(tpl.priority),
      title:       '',
      body:        '',
      actionLabel: '',
      actionRoute: tpl.actionRoute || '',
      scheduledAt: sched.scheduledAt.toISOString(),
      deferredReason: sched.reason,
      deliveredAt: null,
      // Pre-rendered fallbacks so the queue can show a preview
      // without re-rendering when its window opens.
      _fallback: Object.freeze({
        title: forbiddenWordingFilter(renderTemplate(tpl.titleFb || '', candidate.vars || {})),
        body:  forbiddenWordingFilter(renderTemplate(tpl.bodyFb  || '', candidate.vars || {})),
      }),
    });
  }

  // Render + safety-filter every visible string.
  const title = forbiddenWordingFilter(renderTemplate(tpl.titleFb || '', candidate.vars || {}));
  const body  = forbiddenWordingFilter(renderTemplate(tpl.bodyFb  || '', candidate.vars || {}));
  const actionLabel = forbiddenWordingFilter(renderTemplate(tpl.actionLabelFb || '', candidate.vars || {}));

  if (opts.commit) {
    try { markDelivered(kind, key, now); } catch { /* swallow */ }
  }

  return Object.freeze({
    id,
    kind,
    key,
    priority:    normalizePriority(tpl.priority),
    title,
    body,
    actionLabel,
    actionRoute: tpl.actionRoute || '',
    scheduledAt: now.toISOString(),
    deliveredAt: opts.commit ? now.toISOString() : null,
    deferredReason: null,
  });
}

/**
 * High-level entry — runs identifyCandidates → buildNotification
 * for each, returns the array of deliverable + deferred messages.
 *
 * The caller passes `{ commit: true }` only when the messages are
 * actually being delivered (the in-app feed renderer commits per
 * row as the user sees it).
 *
 * @param {import('../core/intelligenceTypes.js').IntelligenceContext} context
 * @param {object} [opts]
 * @returns {Array<object>}
 */
export function queueNotifications(context, opts = {}) {
  const candidates = identifyCandidates(context);
  const out = [];
  for (const c of candidates) {
    const n = buildNotification(c, opts);
    if (n) out.push(n);
  }
  return out;
}

const _module = {
  identifyCandidates,
  buildNotification,
  queueNotifications,
};
export default _module;
