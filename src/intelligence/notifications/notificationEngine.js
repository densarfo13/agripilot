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
import {
  shouldDeliver,
  markDelivered,
  countDeliveredSince,
} from './notificationDeduplication.js';
import { normalizePriority, priorityContract, PRIORITY } from './notificationPriority.js';
import { isSuppressed } from './notificationState.js';
import { forbiddenWordingFilter } from '../core/farmerInsightAdapter.js';

// ─── Frequency limits (spec §3) ──────────────────────────────────
//   • max 2 notifications/day per user (across all kinds)
//   • max 1 weather alert/day total (any variant) unless severe
//     (severe = IMPORTANT priority, e.g. weather:rain — those are
//     allowed to ride above the per-kind cap because the calm copy
//     is still calm; the user's hands need to know).
//   • The per-kind cooldown lives in notificationDeduplication.
export const MAX_DAILY_TOTAL   = 2;
export const MAX_DAILY_WEATHER = 1;

// ─── Garden-forbidden kinds (spec §7) ────────────────────────────
//   Garden users must NEVER receive funding, buyer, or sell candidates.
//   These categories carry commercial wording (acreage, contract,
//   demand-up) that doesn't translate to backyard / pot growing.
//   Enforced inside identifyCandidates so the candidates never leave
//   the engine when mode === 'garden'.
const GARDEN_FORBIDDEN_KINDS = Object.freeze(new Set(['buyer', 'funding', 'sell']));

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

  // Farm vs Garden gate — Garden users get the plant-care core
  // (weather, scan, task, progress) but never commercial categories.
  // We read `context.mode` once and check inside each category below;
  // the GARDEN_FORBIDDEN_KINDS set is the single source of truth.
  const mode = String(context.mode || 'farm').toLowerCase();
  const isGarden = mode === 'garden';

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

  // Buyer interest — Farm-only. Garden users never see commercial
  // buyer copy. (spec §7)
  const bi = Array.isArray(context.buyerInterest) ? context.buyerInterest : [];
  if (bi.length > 0 && !isGarden) {
    out.push({
      id:   'buyer:interest_nearby',
      kind: 'buyer',
      key:  String((bi[0] && bi[0].id) || 'first'),
      vars: { region: region || 'your area' },
    });
  }

  // Funding — Farm-only. Garden users never see funding copy.
  // (spec §7)
  const fm = Array.isArray(context.fundingMatches) ? context.fundingMatches : [];
  if (fm.length > 0 && !isGarden) {
    out.push({
      id:   'funding:opportunity_nearby',
      kind: 'funding',
      key:  String((fm[0] && fm[0].id) || 'first'),
      vars: {},
    });
  }

  // Final defense — if a future contributor adds a forbidden-kind
  // candidate above without checking isGarden, strip it here.
  // Mode gate is BOTH per-branch and post-collection so the rule
  // is unbreakable.
  if (isGarden) {
    return out.filter((c) => !GARDEN_FORBIDDEN_KINDS.has(String(c.kind || '')));
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

  // Action / dismissal memory gate — if the user already engaged
  // with (or dismissed) this exact dedupeKey, suppress the
  // candidate until the per-state window elapses. Read more in
  // notificationState.js.
  if (isSuppressed(`${kind}:${key}`, now)) return null;

  // Cooldown gate — never re-deliver inside the dedup window.
  if (!shouldDeliver(kind, key, now)) return null;

  // Scheduler — quiet hours / preferred window.
  const sched = evaluateSchedule({ kind, priority: tpl.priority }, now);
  const priority = normalizePriority(tpl.priority);
  const dedupeKey = `${kind}:${key}`;
  // expiresAt — derived from the priority contract (LOW=3d, NORMAL=2d,
  // IMPORTANT=1d). This is what the in-app feed reads to age rows out.
  const expiresAt = (() => {
    try {
      const days = priorityContract(priority).timeoutDays || 2;
      const ms   = days * 24 * 60 * 60 * 1000;
      return new Date(now.getTime() + ms).toISOString();
    } catch { return null; }
  })();

  if (!sched.canDeliverNow) {
    // Defer: return a candidate envelope the in-app queue can hold,
    // without committing to dedup yet (it'll commit when delivered).
    return Object.freeze({
      id,
      kind,
      key,
      priority,
      title:       '',
      body:        '',
      actionLabel: '',
      actionRoute: tpl.actionRoute || '',
      scheduledAt: sched.scheduledAt.toISOString(),
      deferredReason: sched.reason,
      reason:       sched.reason,
      dedupeKey,
      expiresAt,
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
    priority,
    title,
    body,
    actionLabel,
    actionRoute: tpl.actionRoute || '',
    scheduledAt: now.toISOString(),
    deliveredAt: opts.commit ? now.toISOString() : null,
    deferredReason: null,
    reason:       sched.reason,
    dedupeKey,
    expiresAt,
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
  const now = (opts.now instanceof Date) ? opts.now : new Date();

  // Daily ceiling — total + per-category (weather). We count what's
  // already been DELIVERED today (committed to the dedup store) so
  // the cap survives across calls in a single day, not just within
  // this batch.
  // dayStart = 00:00 local of `now`.
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  let totalSentToday = 0;
  let weatherSentToday = 0;
  try {
    totalSentToday   = countDeliveredSince(dayStart);
    weatherSentToday = countDeliveredSince(dayStart, 'weather');
  } catch { /* on storage error, treat as 0 */ }

  // Sort candidates by priority so IMPORTANT ones take the limited
  // daily slots before LOW ones (e.g. progress encouragement).
  const ranked = candidates.slice().sort((a, b) => _priorityRank(b) - _priorityRank(a));

  const out = [];
  for (const c of ranked) {
    // Daily total cap — across all kinds. IMPORTANT items still
    // count (spec calls them "max 2 notifications/day per user").
    const willDeliverNow = _willDeliverNow(c, now);
    if (willDeliverNow && totalSentToday >= MAX_DAILY_TOTAL) continue;

    // Cross-kind weather cap — only 1 weather:* delivered per day
    // unless the candidate is IMPORTANT (severe). The per-variant
    // cooldown still applies via shouldDeliver.
    if (willDeliverNow && String(c.kind) === 'weather') {
      const tpl = resolveTemplate(c.id);
      const sev = tpl ? normalizePriority(tpl.priority) : PRIORITY.NORMAL;
      if (weatherSentToday >= MAX_DAILY_WEATHER && sev !== PRIORITY.IMPORTANT) continue;
    }

    const n = buildNotification(c, opts);
    if (!n) continue;
    out.push(n);

    // Only count items that actually deliver right now toward the
    // daily ceiling. Deferred items belong to a future day-bucket;
    // counting them here would double-count when the day rolls.
    if (n.deliveredAt) {
      totalSentToday += 1;
      if (n.kind === 'weather') weatherSentToday += 1;
    }
  }
  return out;
}

// Priority numeric rank for sorting. IMPORTANT first.
function _priorityRank(c) {
  const tpl = resolveTemplate(String(c && c.id || ''));
  if (!tpl) return 0;
  const p = normalizePriority(tpl.priority);
  if (p === PRIORITY.IMPORTANT) return 2;
  if (p === PRIORITY.NORMAL)    return 1;
  return 0;
}

// Cheap pre-check — does the scheduler say "deliver now"? We use
// this in queueNotifications to decide whether to count the
// candidate against the daily cap (deferred ones don't count).
function _willDeliverNow(c, now) {
  const tpl = resolveTemplate(String(c && c.id || ''));
  if (!tpl) return false;
  try {
    const sched = evaluateSchedule({ kind: c.kind, priority: tpl.priority }, now);
    return !!(sched && sched.canDeliverNow);
  } catch { return false; }
}

const _module = {
  identifyCandidates,
  buildNotification,
  queueNotifications,
};
export default _module;
