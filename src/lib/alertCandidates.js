/**
 * alertCandidates.js — derive proactive alert objects from the
 * existing intelligence signals.
 *
 *   const alerts = buildAlertCandidates({
 *     risks,                     // computePredictiveRisks output
 *     scanTasks,                 // scanToTask output
 *     pattern,                   // scanPatternDetection output
 *     healthScore,               // farmHealthScore output
 *   });
 *   // → [{ kind, level, title, body, dedupeKey, ts }, ...]
 *
 * Why this exists (spec §7)
 * ─────────────────────────
 *   The Smart Alert Engine spec wants "storm incoming, disease
 *   risk rising, irrigation warning, harvest timing, fertilizer
 *   timing" delivered as MINIMAL, HIGH-VALUE, NON-SPAMMY alerts.
 *
 *   The calm-notification rails already exist (LOW / NORMAL /
 *   IMPORTANT priority tiers + quiet hours) — what was missing
 *   was the *thing that knows what to push*. This module is that
 *   thing.
 *
 *   We DELIBERATELY don't wire into push notifications here.
 *   That's a separate spec round (and a real risk surface — a
 *   bad ranker can train users to ignore the calm-notif system,
 *   which is the worst possible outcome). For now we expose the
 *   ranked candidates as data; the notification layer can ingest
 *   them whenever it's ready.
 *
 * Alert level mapping
 * ───────────────────
 *   IMPORTANT — predictive risk level=high; overdue high-urgency
 *               task; health band='urgent'.
 *   NORMAL    — predictive risk level=medium; pattern recurrence
 *               ≥ 3; ≥3 pending tasks total.
 *   LOW       — improving recovery trend (positive reinforcement
 *               — never spammed).
 *
 * De-duplication
 * ──────────────
 *   Each alert carries a `dedupeKey` so the calm-notif layer can
 *   suppress same-key alerts within its own window. Keys are
 *   stable per signal (e.g. "fungal_risk" not "fungal_risk_2026
 *   -05-12") so a multi-day high-humidity stretch only pushes
 *   once until the notif layer's rate-limit clears.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Returns [] when there's nothing alert-worthy — no fake
 *     "all clear" notifications.
 *   • Hard cap: at most 5 alerts so a bad day doesn't carpet-bomb
 *     the user.
 */

export const ALERT_LEVELS = Object.freeze({
  LOW:        'low',
  NORMAL:     'normal',
  IMPORTANT:  'important',
});

const _MAX_ALERTS = 5;

function _isoNow() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function _safeStr(v) {
  const s = String(v == null ? '' : v).trim();
  return s || null;
}

/**
 * @param {object} input
 * @param {Array}  [input.risks]
 * @param {Array}  [input.scanTasks]
 * @param {object} [input.pattern]
 * @param {object} [input.healthScore]
 * @param {number} [input.nowMs]
 * @returns {Array<{ kind, level, title, body, dedupeKey, ts }>}
 */
export function buildAlertCandidates(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const nowMs = (typeof safe.nowMs === 'number') ? safe.nowMs : Date.now();
  const ts = (() => {
    try { return new Date(nowMs).toISOString(); } catch { return _isoNow(); }
  })();

  const alerts = [];

  // ── Risks → alerts ─────────────────────────────────────────
  const risks = Array.isArray(safe.risks) ? safe.risks : [];
  for (const r of risks) {
    if (!r || !r.kind || !r.headline) continue;
    let level = null;
    if (r.level === 'high')   level = ALERT_LEVELS.IMPORTANT;
    if (r.level === 'medium') level = ALERT_LEVELS.NORMAL;
    if (!level) continue;
    alerts.push({
      kind:       'risk:' + String(r.kind),
      level,
      title:      String(r.headline),
      body:       _safeStr(r.action) || 'See the daily briefing for details.',
      dedupeKey:  'risk_' + String(r.kind),
      ts,
    });
  }

  // ── Overdue high-urgency task → IMPORTANT ─────────────────
  const tasks = Array.isArray(safe.scanTasks) ? safe.scanTasks : [];
  const overdueHigh = tasks.find((t) => {
    if (!t || t.completed) return false;
    if (String(t.urgency || '').toLowerCase() !== 'high') return false;
    if (!t.dueAt) return false;
    const dueT = Date.parse(String(t.dueAt));
    if (Number.isNaN(dueT)) return false;
    return dueT <= nowMs;
  });
  if (overdueHigh) {
    alerts.push({
      kind:       'task:overdue_high',
      level:      ALERT_LEVELS.IMPORTANT,
      title:      'High-priority task is overdue',
      body:       _safeStr(overdueHigh.title) || 'A high-priority farm task needs attention.',
      dedupeKey:  'task_overdue_' + String(overdueHigh.id || 'unknown'),
      ts,
    });
  }

  // ── ≥3 pending tasks → NORMAL ─────────────────────────────
  const pendingCount = tasks.filter((t) => t && !t.completed).length;
  if (pendingCount >= 3) {
    alerts.push({
      kind:       'task:queue_growing',
      level:      ALERT_LEVELS.NORMAL,
      title:      `${pendingCount} farm tasks waiting`,
      body:       "Open Today's Plan to clear the highest-priority ones first.",
      dedupeKey:  'task_queue_3plus',
      ts,
    });
  }

  // ── Pattern recurrence → NORMAL ───────────────────────────
  const pattern = safe.pattern && typeof safe.pattern === 'object' ? safe.pattern : null;
  if (pattern && pattern.recurrence && pattern.recurrence.count >= 3) {
    alerts.push({
      kind:       'pattern:recurrence',
      level:      ALERT_LEVELS.NORMAL,
      title:      `Same issue seen ${pattern.recurrence.count} times`,
      body:       'Worth treating as a pattern, not a one-off.',
      dedupeKey:  'pattern_recurrence_' + String(pattern.recurrence.issue || 'unknown'),
      ts,
    });
  }

  // ── Improving trend → LOW (positive reinforcement) ────────
  if (pattern && pattern.trend === 'improving') {
    alerts.push({
      kind:       'pattern:improving',
      level:      ALERT_LEVELS.LOW,
      title:      'Recovery on track',
      body:       'Your most recent rescan looks better than the last one.',
      dedupeKey:  'pattern_improving',
      ts,
    });
  }

  // ── Health score urgent → IMPORTANT ───────────────────────
  const hs = safe.healthScore && typeof safe.healthScore === 'object' ? safe.healthScore : null;
  if (hs && hs.band === 'urgent' && typeof hs.score === 'number') {
    alerts.push({
      kind:       'health:urgent',
      level:      ALERT_LEVELS.IMPORTANT,
      title:      `Farm health score ${hs.score}/100`,
      body:       'Several signs need immediate care.',
      dedupeKey:  'health_urgent',
      ts,
    });
  }

  // ── Rank by level + cap ───────────────────────────────────
  const order = { important: 0, normal: 1, low: 2 };
  alerts.sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9));
  return alerts.slice(0, _MAX_ALERTS);
}

export default { buildAlertCandidates, ALERT_LEVELS };
