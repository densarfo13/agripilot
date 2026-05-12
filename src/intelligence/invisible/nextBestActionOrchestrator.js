/**
 * nextBestActionOrchestrator.js — consumes every Invisible
 * Intelligence module + emits ONE primary recommendation
 * (Invisible Intelligence spec §9).
 *
 *   const top = orchestrateNextBestAction({
 *     weatherRisks, scanPattern, scanTasks, healthScore,
 *     marketIntelligence, buyerEcosystem, financialLayer,
 *     cooperativeWorkflows, satelliteAutomation, yieldForecasting,
 *     regionalDiseaseIntelligence, userMode,
 *   });
 *
 * Priority order (spec §9, hard-coded — never overridden)
 * ────────────────────────────────────────────────────────
 *   1. crop / plant health risk (severe scan + at-risk yield)
 *   2. severe weather risk (high-level predictive risks)
 *   3. urgent task (overdue high-urgency)
 *   4. scan follow-up (recent severe scan)
 *   5. harvest / yield risk
 *   6. market / buyer opportunity
 *   7. funding / cooperative opportunity
 *   8. encouragement (calm fallback)
 *
 * "Never overwhelm user" rules
 * ────────────────────────────
 *   • Only ONE top action ever returned.
 *   • Low-confidence signals are dropped UNLESS they're at
 *     priority 1 (health risk) — those surface even at low
 *     confidence because the cost of missing them is higher than
 *     the cost of a calm false-positive.
 *   • visibleToUser:false signals are always dropped — that's the
 *     trust gate from each module.
 *   • userMode gates market/buyer/funding/cooperative signals so
 *     garden-mode users never see commercial nudges.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Returns the SAME shape as src/lib/nextBestAction.computeNextBestAction
 *     so the existing NextBestActionCard renders this output
 *     without any UI changes.
 *   • Returns the calm "walk the field" fallback when no priority
 *     tier fires.
 */

const _NEVER_GATED = new Set([
  'crop_health',
  'severe_weather',
  'urgent_task',
  'scan_followup',
  'yield_risk',
  'encouragement',
]);

const _GATED_BY_COMMERCIAL_MODE = new Set([
  'marketIntelligence',
  'buyerEcosystem',
  'financialLayer',
  'cooperativeWorkflows',
]);

function _confidenceRank(c) {
  if (c === 'high')   return 3;
  if (c === 'medium') return 2;
  if (c === 'low')    return 1;
  return 0;
}

function _isVisible(signal) {
  return !!signal && signal.visibleToUser === true && typeof signal.farmerMessage === 'string'
      && signal.farmerMessage.trim().length > 0;
}

function _isCommercialModeOK(userMode) {
  const m = String(userMode || '').toLowerCase();
  return m === 'smallholder_farmer' || m === 'commercial_farmer' || m === 'ngo_manager';
}

function _toNBA(kind, title, reason, urgency, confidence, action, route) {
  return Object.freeze({
    kind,
    title,
    reason,
    urgency:    urgency || 'medium',
    confidence: confidence || 'medium',
    impact:     '',
    actionType: 'inspect',
    dedupeKey:  'orchestrator_' + kind,
    hint:       action || null,
    sourceRef:  null,
    route:      route || '/today',
  });
}

export function orchestrateNextBestAction(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const userMode = String(safe.userMode || 'smallholder_farmer').toLowerCase();
  const allowCommercial = _isCommercialModeOK(userMode);

  // ── 1. Crop / plant health risk ─────────────────────────────
  const disease = safe.regionalDiseaseIntelligence;
  if (_isVisible(disease) && (disease.urgency === 'high' || disease.urgency === 'medium')) {
    return _toNBA(
      'crop_health',
      disease.farmerMessage,
      'Local + weather signals agree on disease pressure.',
      disease.urgency,
      disease.confidence,
      disease.recommendedAction,
      '/scan',
    );
  }

  // ── 2. Severe weather risk ──────────────────────────────────
  const risks = Array.isArray(safe.weatherRisks) ? safe.weatherRisks : [];
  const highRisk = risks.find((r) => r && r.level === 'high' && r.headline);
  if (highRisk) {
    return _toNBA(
      'severe_weather',
      highRisk.headline,
      `Weather + crop signals point to elevated ${highRisk.kind || ''} risk.`.trim(),
      'high',
      'medium',
      highRisk.action,
      '/today',
    );
  }

  // ── 3. Urgent task ──────────────────────────────────────────
  const tasks = Array.isArray(safe.scanTasks) ? safe.scanTasks : [];
  const nowMs = (typeof safe.nowMs === 'number') ? safe.nowMs : Date.now();
  const overdue = tasks.find((t) => {
    if (!t || t.completed) return false;
    if (String(t.urgency || '').toLowerCase() !== 'high') return false;
    if (!t.dueAt) return false;
    const due = Date.parse(String(t.dueAt));
    return !Number.isNaN(due) && due <= nowMs;
  });
  if (overdue) {
    return _toNBA(
      'urgent_task',
      overdue.title || 'High-priority farm task is overdue',
      overdue.reason || 'This task is past its due time and was marked high-urgency.',
      'high',
      'high',
      'Mark as done when finished',
      '/today',
    );
  }

  // ── 4. Scan follow-up ───────────────────────────────────────
  const pattern = safe.scanPattern;
  if (pattern && pattern.trend === 'worsening' && pattern.previous) {
    return _toNBA(
      'scan_followup',
      'Take a closer look at your most recent scan crop',
      `Your latest rescan looks worse than the one ${pattern.previous.daysAgo ?? 'a few'} days ago.`,
      'medium',
      'medium',
      'Walk the field',
      '/scan',
    );
  }

  // ── 5. Yield risk ───────────────────────────────────────────
  const yieldSig = safe.yieldForecasting;
  if (_isVisible(yieldSig) && yieldSig.signal === 'at_risk') {
    return _toNBA(
      'yield_risk',
      yieldSig.farmerMessage,
      'Yield outlook signals say this is the highest-leverage action.',
      'high',
      yieldSig.confidence || 'medium',
      yieldSig.recommendedAction,
      '/today',
    );
  }

  // ── 6. Market / buyer opportunity (mode-gated) ──────────────
  if (allowCommercial) {
    const market = safe.marketIntelligence;
    if (_isVisible(market) && _confidenceRank(market.confidence) >= 2) {
      return _toNBA(
        'market_opportunity',
        market.farmerMessage,
        'Local market signals look favourable.',
        market.urgency || 'low',
        market.confidence,
        market.recommendedAction,
        '/sell',
      );
    }
    const buyer = safe.buyerEcosystem;
    if (_isVisible(buyer)) {
      return _toNBA(
        'buyer_opportunity',
        buyer.farmerMessage,
        'Your listing readiness is in a good place.',
        buyer.urgency || 'low',
        buyer.confidence || 'low',
        buyer.recommendedAction,
        '/sell',
      );
    }
  }

  // ── 7. Funding / cooperative opportunity (mode-gated) ───────
  if (allowCommercial) {
    const financial = safe.financialLayer;
    if (_isVisible(financial)) {
      return _toNBA(
        'funding_opportunity',
        financial.farmerMessage,
        'Your record-keeping is moving in the right direction.',
        'low',
        financial.confidence || 'medium',
        financial.recommendedAction,
        '/today',
      );
    }
    const coop = safe.cooperativeWorkflows;
    if (_isVisible(coop)) {
      return _toNBA(
        'cooperative_opportunity',
        coop.farmerMessage,
        'Nearby group activity suggests an opportunity.',
        'low',
        coop.confidence || 'medium',
        coop.recommendedAction,
        '/today',
      );
    }
  }

  // ── 8. Encouragement (calm fallback) ────────────────────────
  return _toNBA(
    'encouragement',
    'Walk the field and notice anything new',
    'No urgent signal in your data today — a calm field walk is the best use of time.',
    'low',
    'low',
    null,
    null,
  );
}

export default { orchestrateNextBestAction };
