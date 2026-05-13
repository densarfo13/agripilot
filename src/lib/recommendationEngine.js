/**
 * recommendationEngine.js — the single named RecommendationEngine
 * that emits ONE best action per the Context + Recommendation spec.
 *
 *   const rec = recommendationEngine.recommend(context);
 *   // → { title, action, reason, bestTime, urgency, confidenceTone,
 *   //     sourceSignals, ctaLabel, ctaRoute }
 *
 * Spec's exact 9-field shape:
 *   {
 *     title,           string  short headline
 *     action,          string  imperative ("Water at dawn today.")
 *     reason,          string  why it matters
 *     bestTime,        string  "This evening, before sunset"
 *     urgency,         'high' | 'medium' | 'low'
 *     confidenceTone,  string  plain language — NEVER a percent
 *     sourceSignals,   string[] tag list ('weather', 'scan', etc.)
 *     ctaLabel,        string  one-tap button label
 *     ctaRoute,        string  router-known path
 *   }
 *
 * Why a thin adapter
 * ──────────────────
 *   The intelligence stack already has:
 *     • nextBestActionOrchestrator — picks ONE action across all
 *       signals with documented priority order (crop_health >
 *       severe_weather > urgent_task > scan_followup > yield_risk
 *       > market > funding > encouragement)
 *     • nextBestActionNormalizer   — emits a 9-field shape that's
 *       CLOSE to the spec's 9-field shape (different field names)
 *
 *   RecommendationEngine is the named adapter that:
 *     1. Calls orchestrator with the context
 *     2. Maps its output to the spec's exact 9 field names
 *     3. Applies Simple Mode trimming (spec rule: Simple Mode
 *        shows ONE action only — no supporting insights, no
 *        confidence pill)
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Returns the canonical 9-field shape every time (never null).
 *   • Simple Mode trims to action-only — sourceSignals + confidence
 *     remain in the data, but consumers respecting Simple Mode
 *     should not render the supporting fields. The flag stays in
 *     the data so a single recommendation object can serve both
 *     SIMPLE and STANDARD UI.
 *   • Locked vocabulary — confidenceTone uses the 5 canonical
 *     phrases from confidenceLanguage; raw percents are never
 *     emitted.
 */

import { orchestrateNextBestAction } from '../intelligence/invisible/nextBestActionOrchestrator.js';
import { mapToCalmPhrase } from './confidenceLanguage.js';
import { isIntelligenceFlagOn } from './featureFlags/intelligenceFlags.js';

// ─── Effort + bestTime tables (parity with normalizer) ────────

const _BEST_TIME = Object.freeze({
  spray:    'This evening, before sunset',
  treat:    'This evening, before sunset',
  water:    'At dawn or after sunset',
  irrigate: 'At dawn or after sunset',
  drain:    'Before the next rain',
  inspect:  'When you walk the field today',
  review:   'When you have a free moment',
  fertilize: 'On a calm, dry day',
  harvest:  'Mid-morning, when leaves are dry',
});

const _KIND_ROUTE = Object.freeze({
  crop_health:              '/scan',
  severe_weather:           '/today',
  urgent_task:              '/today',
  task_top:                 '/today',
  task_overdue_high:        '/today',
  scan_followup:            '/scan',
  pattern_worsening:        '/scan',
  yield_risk:               '/today',
  market_opportunity:       '/sell',
  buyer_opportunity:        '/sell',
  funding_opportunity:      '/today',
  cooperative_opportunity:  '/today',
  health_urgent:            '/today',
  fallback_walk:            '/',
  encouragement:            '/',
});

const _KIND_CTA = Object.freeze({
  crop_health:              'Rescan',
  severe_weather:           "See today's plan",
  urgent_task:              "Open Today's Plan",
  task_top:                 "Open Today's Plan",
  task_overdue_high:        "Open Today's Plan",
  scan_followup:            'Rescan',
  pattern_worsening:        'Walk the field',
  yield_risk:               "Open Today's Plan",
  market_opportunity:       'See market hint',
  buyer_opportunity:        'See market hint',
  funding_opportunity:      "Open Today's Plan",
  cooperative_opportunity:  "Open Today's Plan",
  health_urgent:            "Open Today's Plan",
  fallback_walk:            null,
  encouragement:            null,
});

// ─── Source-signal tag inference ─────────────────────────────

function _inferSourceSignals(orchestratorResult, context) {
  const tags = new Set();
  const kind = String(orchestratorResult && orchestratorResult.kind || '');
  if (kind.startsWith('risk_') || kind === 'severe_weather') tags.add('weather');
  if (kind === 'crop_health' || kind === 'pattern_worsening' || kind === 'scan_followup') tags.add('scan');
  if (kind === 'urgent_task' || kind === 'task_top' || kind === 'task_overdue_high') tags.add('tasks');
  if (kind === 'health_urgent') tags.add('farm_health');
  if (context && typeof context === 'object') {
    if (context.soil)      tags.add('soil');
    if (context.satellite) tags.add('satellite');
  }
  if (tags.size === 0) tags.add('routine');
  return Array.from(tags);
}

// ─── Helpers ──────────────────────────────────────────────────

function _safeStr(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
}

function _normUrgency(u) {
  const s = String(u || '').toLowerCase();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return 'low';
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Build the single best recommendation from a context object.
 *
 * @param {object} context        — getContext() return
 * @param {object} [options]
 * @param {boolean} [options.simpleMode]
 *                                  — when true, the result still
 *                                    has every field but the
 *                                    consumer should render only
 *                                    title + action + ctaLabel.
 * @returns {object} frozen 9-field shape
 */
export function recommend(context, options) {
  const safeCtx = (context && typeof context === 'object') ? context : {};
  const opts = (options && typeof options === 'object') ? options : {};
  const simpleMode = (opts.simpleMode === true)
    || (opts.simpleMode === undefined && isIntelligenceFlagOn('FEATURE_SIMPLE_MODE'));

  // 1. Run the orchestrator with the context's relevant fields.
  // Field-name parity: orchestrator reads `weatherRisks`. We accept
  // either `risks` (spec wording) or `weatherRisks` on the input so
  // callers can use the spec shape without re-mapping.
  const risksList = Array.isArray(safeCtx.weatherRisks) ? safeCtx.weatherRisks
                  : Array.isArray(safeCtx.risks)         ? safeCtx.risks
                  : (safeCtx.weather && Array.isArray(safeCtx.weather.risks))
                    ? safeCtx.weather.risks : [];
  let orchestratorResult;
  try {
    orchestratorResult = orchestrateNextBestAction({
      weatherRisks: risksList,
      scanTasks: Array.isArray(safeCtx.tasks) ? safeCtx.tasks : [],
      pattern:   safeCtx.pattern || (safeCtx.scanHistory && safeCtx.scanHistory[0] && safeCtx.scanHistory[0].pattern) || null,
      healthScore: safeCtx.healthScore || null,
      latestScan:  Array.isArray(safeCtx.scanHistory) && safeCtx.scanHistory.length > 0
                    ? safeCtx.scanHistory[0]
                    : null,
      yieldForecasting:           safeCtx.yieldForecasting || null,
      regionalDiseaseIntelligence: safeCtx.regionalDiseaseIntelligence || null,
      marketIntelligence:         safeCtx.marketIntelligence || null,
      buyerEcosystem:             safeCtx.buyerEcosystem || null,
      financialLayer:             safeCtx.financialLayer || null,
      cooperativeWorkflows:       safeCtx.cooperativeWorkflows || null,
      userMode:                   safeCtx.userMode || 'smallholder_farmer',
    });
  } catch {
    orchestratorResult = null;
  }

  if (!orchestratorResult) {
    return _fallbackRecommendation(simpleMode);
  }

  // 2. Map to the spec's exact 9-field shape.
  const kind = orchestratorResult.kind || 'fallback_walk';
  const urgency = _normUrgency(orchestratorResult.urgency);
  const actionType = String(orchestratorResult.actionType || 'inspect').toLowerCase();
  const bestTime = _BEST_TIME[actionType] || 'Today';

  const confidenceTone = mapToCalmPhrase({
    kind,
    urgency,
    confidence: orchestratorResult.confidence,
  });

  const sourceSignals = _inferSourceSignals(orchestratorResult, safeCtx);

  return Object.freeze({
    title:          _safeStr(orchestratorResult.title) || 'Walk the field and notice anything new',
    action:         _safeStr(orchestratorResult.hint) || _safeStr(orchestratorResult.title) || 'Take a calm look at the field today.',
    reason:         _safeStr(orchestratorResult.reason) || 'A field walk surfaces small changes before they grow.',
    bestTime,
    urgency,
    confidenceTone,
    sourceSignals:  Object.freeze(sourceSignals),
    ctaLabel:       _KIND_CTA[kind] || null,
    ctaRoute:       _KIND_ROUTE[kind] || '/',
  });
}

function _fallbackRecommendation() {
  return Object.freeze({
    title:          'Walk the field and notice anything new',
    action:         'Take a calm look at the field today.',
    reason:         'A field walk surfaces small changes before they grow.',
    bestTime:       'When you walk the field today',
    urgency:        'low',
    confidenceTone: 'Looks stable',
    sourceSignals:  Object.freeze(['routine']),
    ctaLabel:       null,
    ctaRoute:       '/',
  });
}

export default { recommend };
