/**
 * nextBestAction.js — central decision engine for "What should I
 * do next?"
 *
 *   const action = computeNextBestAction({
 *     risks, scanTasks, pattern, healthScore, latestScan,
 *     topPrioritizedAction,    // taskPrioritization.topAction()
 *   });
 *   // → { kind, title, reason, urgency, confidence, impact,
 *   //     dedupeKey, actionType, hint }  |  null
 *
 * What it is
 * ───────────
 *   This is the SYNTHESIS layer — it takes every signal the
 *   intelligence stack already computes (predictive risks,
 *   prioritized tasks, pattern detection, farm health,
 *   most-recent scan) and picks ONE item the farmer should do
 *   next. Returns null when there is genuinely nothing to do —
 *   we never invent an action.
 *
 *   Reads the same inputs as the daily briefing but answers a
 *   different question: the briefing says "here's the situation,"
 *   this engine says "here's the one thing to do."
 *
 * Decision order (highest priority first)
 * ───────────────────────────────────────
 *   1. Health band 'urgent'       → "Multiple signs need care now"
 *   2. Overdue high-urgency task  → that task
 *   3. Top high-level risk        → that risk's action
 *   4. Top prioritized task       → from taskPrioritization
 *   5. Top medium-level risk      → that risk's action
 *   6. Pattern worsening          → "Take a closer look today"
 *   7. Recent scan follow-up      → existing follow-up task
 *   8. Fallback                   → "Walk the field and notice anything new"
 *
 *   Each path returns a *single* action with stable shape so the
 *   UI never has to feature-detect the source.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Confidence is calibrated honestly: 'high' for direct
 *     overdue-task / health-urgent signals; 'medium' for risk-
 *     driven; 'low' for the fallback. We do NOT show a fake
 *     percent — confidence is qualitative because the
 *     underlying signals are.
 *   • The `dedupeKey` is stable per signal so any caller (e.g.
 *     a push-notification layer) can suppress repeats.
 */

const _MS_PER_DAY = 24 * 60 * 60 * 1000;

function _safeStr(v) {
  const s = String(v == null ? '' : v).trim();
  return s || null;
}

function _isOverdue(dueAt, nowMs) {
  if (!dueAt) return false;
  const t = Date.parse(String(dueAt));
  if (Number.isNaN(t)) return false;
  return t <= nowMs;
}

/**
 * @param {object} input
 * @param {Array}  [input.risks]
 * @param {Array}  [input.scanTasks]
 * @param {object} [input.pattern]
 * @param {object} [input.healthScore]
 * @param {object} [input.latestScan]
 * @param {object} [input.topPrioritizedAction] — taskPrioritization.topAction return
 * @param {number} [input.nowMs]
 * @returns {{
 *   kind:       string,
 *   title:      string,
 *   reason:     string,
 *   urgency:    'high'|'medium'|'low',
 *   confidence: 'high'|'medium'|'low',
 *   impact:     string,
 *   actionType: string,
 *   dedupeKey:  string,
 *   hint:       string,    // optional one-tap call-to-action label
 *   sourceRef:  object|null,
 * } | null}
 */
export function computeNextBestAction(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const nowMs = (typeof safe.nowMs === 'number') ? safe.nowMs : Date.now();

  const risks    = Array.isArray(safe.risks) ? safe.risks : [];
  const tasks    = Array.isArray(safe.scanTasks) ? safe.scanTasks : [];
  const pattern  = (safe.pattern && typeof safe.pattern === 'object') ? safe.pattern : null;
  const health   = (safe.healthScore && typeof safe.healthScore === 'object') ? safe.healthScore : null;
  const latest   = (safe.latestScan && typeof safe.latestScan === 'object') ? safe.latestScan : null;
  const topPri   = (safe.topPrioritizedAction && typeof safe.topPrioritizedAction === 'object')
    ? safe.topPrioritizedAction
    : null;

  // ── 1. Urgent health band ────────────────────────────────────
  if (health && health.band === 'urgent' && typeof health.score === 'number') {
    return {
      kind:       'health_urgent',
      title:      'Multiple signs need care today',
      reason:     `Farm health score is ${health.score}/100 — open Today's Plan and clear the highest-priority tasks first.`,
      urgency:    'high',
      confidence: 'high',
      impact:     'Reducing today\'s open issues prevents them from compounding into bigger problems.',
      actionType: 'review',
      dedupeKey:  'nba_health_urgent',
      hint:       "Open Today's Plan",
      sourceRef:  health,
    };
  }

  // ── 2. Overdue high-urgency task ─────────────────────────────
  const overdue = tasks.find((t) => t && !t.completed
                                   && String(t.urgency || '').toLowerCase() === 'high'
                                   && _isOverdue(t.dueAt, nowMs));
  if (overdue) {
    return {
      kind:       'task_overdue_high',
      title:      _safeStr(overdue.title) || 'Overdue farm task needs attention',
      reason:     _safeStr(overdue.reason) || 'This task is past its due time and was marked high-urgency.',
      urgency:    'high',
      confidence: 'high',
      impact:     _safeStr(overdue.estimatedImpact) || 'High — overdue treatments lose effectiveness fast.',
      actionType: _safeStr(overdue.actionType) || 'inspect',
      dedupeKey:  'nba_task_' + String(overdue.id || 'unknown'),
      hint:       'Mark as done when finished',
      sourceRef:  overdue,
    };
  }

  // ── 3. Top high-level risk ───────────────────────────────────
  const highRisk = risks.find((r) => r && r.level === 'high' && r.headline);
  if (highRisk) {
    return {
      kind:       'risk_high:' + String(highRisk.kind || 'generic'),
      title:      String(highRisk.headline),
      reason:     `Weather + crop signals point to elevated ${String(highRisk.kind || '')} risk.`.replace(/\s+/g, ' ').trim(),
      urgency:    'high',
      confidence: 'medium',
      impact:     'Acting in the next 24 hours preserves the most yield.',
      actionType: _riskKindToActionType(highRisk.kind),
      dedupeKey:  'nba_risk_' + String(highRisk.kind || 'generic'),
      hint:       _safeStr(highRisk.action) || 'Open the briefing for details',
      sourceRef:  highRisk,
    };
  }

  // ── 4. Top prioritized task ──────────────────────────────────
  if (topPri && topPri.task && topPri.task.title) {
    const t = topPri.task;
    return {
      kind:       'task_top',
      title:      String(t.title),
      reason:     _safeStr(t.reason) || 'Highest-priority item across urgency, due date, weather match, and impact.',
      urgency:    String(t.urgency || 'medium').toLowerCase(),
      confidence: 'medium',
      impact:     _safeStr(t.estimatedImpact) || 'Steady improvement when done consistently.',
      actionType: _safeStr(t.actionType) || 'inspect',
      dedupeKey:  'nba_task_' + String(t.id || 'top'),
      hint:       "Open Today's Plan",
      sourceRef:  t,
    };
  }

  // ── 5. Top medium-level risk ─────────────────────────────────
  const medRisk = risks.find((r) => r && r.level === 'medium' && r.headline);
  if (medRisk) {
    return {
      kind:       'risk_medium:' + String(medRisk.kind || 'generic'),
      title:      String(medRisk.headline),
      reason:     `A medium-level ${String(medRisk.kind || '')} signal fired today.`.replace(/\s+/g, ' ').trim(),
      urgency:    'medium',
      confidence: 'medium',
      impact:     'Modest — addressing early is cheaper than waiting.',
      actionType: _riskKindToActionType(medRisk.kind),
      dedupeKey:  'nba_risk_' + String(medRisk.kind || 'generic'),
      hint:       _safeStr(medRisk.action) || 'Check the briefing',
      sourceRef:  medRisk,
    };
  }

  // ── 6. Worsening recovery trend ─────────────────────────────
  if (pattern && pattern.trend === 'worsening' && pattern.previous) {
    return {
      kind:       'pattern_worsening',
      title:      'Take a closer look at your most recent scan crop',
      reason:     `Your latest rescan looks worse than the one ${pattern.previous.daysAgo ?? 'a few'} days ago.`,
      urgency:    'medium',
      confidence: 'medium',
      impact:     'Catching a worsening trend early often turns it around.',
      actionType: 'inspect',
      dedupeKey:  'nba_pattern_worsening',
      hint:       'Walk the field',
      sourceRef:  pattern,
    };
  }

  // ── 7. Recent scan follow-up ─────────────────────────────────
  if (latest && latest.id) {
    const noticed = _safeStr(latest.noticed);
    if (noticed) {
      return {
        kind:       'scan_followup',
        title:      `Re-check the ${_safeStr(latest.crop) || 'crop'} from your last scan`,
        reason:     `Your last scan flagged ${noticed}. A short re-check confirms whether it's spreading.`,
        urgency:    'low',
        confidence: 'medium',
        impact:     'Catching spread early is the single highest-leverage action you can take.',
        actionType: 'inspect',
        dedupeKey:  'nba_scan_followup_' + String(latest.id),
        hint:       'Rescan when you walk past',
        sourceRef:  latest,
      };
    }
  }

  // ── 8. Calm fallback ─────────────────────────────────────────
  return {
    kind:       'fallback_walk',
    title:      'Walk the field and notice anything new',
    reason:     "No urgent signal in your data today — a calm field walk is the best use of time.",
    urgency:    'low',
    confidence: 'low',
    impact:     'Catching changes early is most of the work.',
    actionType: 'inspect',
    dedupeKey:  'nba_fallback_walk',
    hint:       null,
    sourceRef:  null,
  };
}

// Map risk kinds → conventional task actionTypes so the surface
// can render the right glyph + suppress mismatched tasks.
function _riskKindToActionType(kind) {
  switch (String(kind || '').toLowerCase()) {
    case 'fungal':       return 'spray';
    case 'drought':      return 'water';
    case 'heat':         return 'water';
    case 'flood':        return 'drain';
    case 'recent_issue': return 'inspect';
    default:              return 'inspect';
  }
}

export default { computeNextBestAction };
