/**
 * recommendationEngine.js — action suggestions from a risk report.
 *
 *   getRecommendations({ risk, farm, now }) → [
 *     {
 *       id,               // stable key for correlation
 *       action,           // 'send_sms' | 'assign_officer' | 'request_scan' |
 *                         // 'schedule_visit' | 'reassure' | 'self_inspect'
 *       audience,         // 'farmer' | 'admin' | 'officer'
 *       priority,         // 'low' | 'medium' | 'high' | 'critical'
 *       rationale,        // short human-readable reason
 *       rationaleKey,     // stable i18n key
 *       safe,             // true when the action never requires a
 *                         // human judgment call (observation,
 *                         // reminder, etc.). false when admin must
 *                         // confirm before execution.
 *       ruleTag,          // which risk factor rule surfaced this
 *     }
 *   ]
 *
 * Rules — deliberately simple + explainable:
 *   • critical risk  → schedule_visit (admin) + request_scan (farmer)
 *   • disease_*      → self_inspect (farmer) + assign_officer (admin)
 *   • weather_*      → send_sms reminder (farmer, safe)
 *   • issue_* 7d+    → assign_officer (admin) if unassigned
 *   • activity_*     → send_sms nudge (farmer, safe)
 *   • low risk       → reassure (farmer, safe)
 *
 * Pure. No storage. Caller (actionEngine or admin UI) decides what
 * to do with the list.
 */

function severityForRiskLevel(level) {
  return level === 'critical' ? 'critical'
       : level === 'high'     ? 'high'
       : level === 'medium'   ? 'medium'
       :                        'low';
}

function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const x of list) {
    if (!x || !x.id) continue;
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

/**
 * getRecommendations — takes the output of `computeFarmRisk` plus the
 * farm context and emits a frozen, de-duplicated list of actions.
 *
 * Empty input → empty list. Low-risk inputs still emit a "reassure"
 * farmer line so the UI isn't blank.
 */
export function getRecommendations({ risk, farm = null, now = Date.now() } = {}) {
  if (!risk || typeof risk !== 'object') return [];
  const priority = severityForRiskLevel(risk.level);
  const factors  = Array.isArray(risk.factors) ? risk.factors : [];
  const recs = [];

  // ─── Critical-risk bundle ────────────────────────────────────
  if (risk.level === 'critical') {
    recs.push({
      id:       'schedule_visit_critical',
      action:   'schedule_visit',
      audience: 'admin',
      priority,
      rationale:    'Risk is critical — field visit recommended.',
      rationaleKey: 'reco.admin.schedule_visit_critical',
      safe:     false,
      ruleTag:  'risk_level_critical',
    });
    recs.push({
      id:       'request_scan_critical',
      action:   'request_scan',
      audience: 'farmer',
      priority,
      rationale:    'Take a photo of the affected area so an officer can review.',
      rationaleKey: 'reco.farmer.request_scan_critical',
      safe:     true,
      ruleTag:  'risk_level_critical',
    });
  }

  // ─── Source-driven rules ─────────────────────────────────────
  const hasDisease  = factors.some((f) => f.source === 'disease');
  const hasWeather  = factors.some((f) => f.source === 'weather');
  const hasActivity = factors.some((f) => f.source === 'activity');
  const hasStaleIssue = factors.some((f) =>
    f.source === 'issues' && (f.rule === 'issue_7d_plus' || f.rule === 'issue_14d_plus'));
  const hasOpenIssue  = factors.some((f) => f.source === 'issues');

  if (hasDisease) {
    recs.push({
      id:       'self_inspect_disease',
      action:   'self_inspect',
      audience: 'farmer',
      priority,
      rationale:    'Check the affected plants and isolate damaged leaves.',
      rationaleKey: 'reco.farmer.self_inspect_disease',
      safe:     true,
      ruleTag:  'disease',
    });
    recs.push({
      id:       'assign_officer_disease',
      action:   'assign_officer',
      audience: 'admin',
      priority:  priority === 'low' ? 'medium' : priority,
      rationale:    'Possible disease detected — route to a field officer.',
      rationaleKey: 'reco.admin.assign_officer_disease',
      safe:     false,
      ruleTag:  'disease',
    });
  }

  if (hasWeather) {
    const weatherRule = (factors.find((f) => f.source === 'weather') || {}).rule || 'weather';
    const isDry  = weatherRule === 'weather_low_rain' || weatherRule === 'weather_dry_ahead';
    const isHot  = weatherRule === 'weather_excessive_heat';
    const msg    = isDry
      ? 'Dry conditions — check soil moisture and water if you can.'
      : isHot
        ? 'Extreme heat expected — shade seedlings and avoid midday irrigation.'
        : 'Weather change ahead — check today\u2019s task list.';
    recs.push({
      id:       `send_sms_${weatherRule}`,
      action:   'send_sms',
      audience: 'farmer',
      priority,
      rationale:    msg,
      rationaleKey: `reco.farmer.${weatherRule}`,
      safe:     true,
      ruleTag:  weatherRule,
    });
  }

  if (hasStaleIssue) {
    recs.push({
      id:       'assign_officer_stale_issue',
      action:   'assign_officer',
      audience: 'admin',
      priority:  priority === 'low' ? 'medium' : priority,
      rationale:    'Open issue is 7+ days old — route or escalate.',
      rationaleKey: 'reco.admin.stale_issue',
      safe:     false,
      ruleTag:  'issue_stale',
    });
  }

  if (hasActivity) {
    recs.push({
      id:       'send_sms_inactive',
      action:   'send_sms',
      audience: 'farmer',
      priority,
      rationale:    'Check in with today\u2019s task to stay on track.',
      rationaleKey: 'reco.farmer.inactive_nudge',
      safe:     true,
      ruleTag:  'inactivity',
    });
  }

  // ─── Safe defaults ───────────────────────────────────────────
  // Low-risk and fully-clear farms still get a short reassurance so
  // the farmer UI never renders empty.
  if (risk.level === 'low' && !hasOpenIssue && !hasDisease && !hasWeather && !hasActivity) {
    recs.push({
      id:       'reassure_stable',
      action:   'reassure',
      audience: 'farmer',
      priority: 'low',
      rationale:    'Your farm looks stable. Keep up the daily tasks.',
      rationaleKey: 'reco.farmer.reassure_stable',
      safe:     true,
      ruleTag:  'low_risk',
    });
  }

  // Staple crop without targeted risk → keep it simple, one nudge.
  if (recs.length === 0 && farm && farm.crop) {
    recs.push({
      id:       'self_inspect_default',
      action:   'self_inspect',
      audience: 'farmer',
      priority: 'low',
      rationale:    'Walk the field and note anything new.',
      rationaleKey: 'reco.farmer.self_inspect_default',
      safe:     true,
      ruleTag:  'default',
    });
  }

  return Object.freeze(
    uniq(recs).map((r) => Object.freeze({ ...r, generatedAt: now })),
  );
}

export const _internal = Object.freeze({
  severityForRiskLevel, uniq,
});
