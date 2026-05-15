/**
 * getPredictiveBriefing.js — the consolidated predictive briefing.
 *
 *   import {
 *     getPredictiveBriefing, getPredictedRisks, getTopRisk,
 *   } from 'src/core/prediction/getPredictiveBriefing.js';
 *
 *   const b = getPredictiveBriefing();
 *   //  → { generatedAt, geo, weather, cropStatus, risks, topRisk,
 *   //      priorityTask, nextBestAction, alert, briefing,
 *   //      connectivity }
 *
 * What this is
 * ────────────
 *   The predictive layer is already built and tested — it just
 *   wasn't surfaced as ONE briefing:
 *
 *     • lib/predictiveRisk.js  computePredictiveRisks() → the
 *         risk forecast ({ kind, level, headline, action, factors }
 *         — fungal / drought / heat / flood / recent_issue)
 *     • lib/dailyBriefing.js   composeDailyBriefing() → the
 *         narrative briefing
 *     • lib/intelligence/contextEngine.js → today's task / alert
 *
 *   All three already flow into getIntelligenceSnapshot() (risks,
 *   briefing, context). This module is the single read surface the
 *   spec's §7 "Daily Farm Briefing" describes — it consumes
 *   getIntelligenceSnapshot() (spec §1) and assembles the briefing
 *   that Home (§8), Tasks (§9) and the Copilot (§16) read. It does
 *   NOT re-implement any risk math — building diseaseRiskEngine /
 *   weatherStressEngine / pestPressureEngine as new files would
 *   duplicate computePredictiveRisks + the context engine, which
 *   the spec's own Do-Not list forbids.
 *
 * Strict-rule audit
 *   • Pure (modulo the snapshot's cache reads). Never throws.
 *   • SSR-safe. No new state, no competing engine.
 *   • No hardcoded recommendations — every line is read from the
 *     existing engines via the snapshot.
 */

import { getIntelligenceSnapshot } from '../intelligence/getIntelligenceSnapshot.js';

// Risk levels, most severe first — used to pick the top risk.
const _LEVEL_RANK = { high: 3, medium: 2, low: 1 };

function _rankOf(risk) {
  try {
    return _LEVEL_RANK[String(risk && risk.level || '').toLowerCase()] || 0;
  } catch {
    return 0;
  }
}

/**
 * The predicted-risk list for the active farm, ordered most-severe
 * first. Each risk: { kind, level, headline, action, factors }.
 *
 * @param {object} [options]  forwarded to getIntelligenceSnapshot
 * @returns {Array<object>}
 */
export function getPredictedRisks(options) {
  try {
    const snap = getIntelligenceSnapshot(options);
    const risks = (snap && snap.intelligence && Array.isArray(snap.intelligence.risks))
      ? snap.intelligence.risks.slice()
      : [];
    return risks.sort((a, b) => _rankOf(b) - _rankOf(a));
  } catch {
    return [];
  }
}

/**
 * The single highest-priority predicted risk, or null when the
 * forecast is clear.
 *
 * @param {object} [options]
 * @returns {?object}
 */
export function getTopRisk(options) {
  const risks = getPredictedRisks(options);
  return risks.length > 0 ? risks[0] : null;
}

/**
 * The consolidated predictive briefing — the spec §7 surface.
 * Assembled entirely from getIntelligenceSnapshot(); never recomputes
 * a risk. Never throws — a failure yields a calm empty briefing.
 *
 * @param {object} [options]  forwarded to getIntelligenceSnapshot
 * @returns {{
 *   generatedAt: number,
 *   geo: object,
 *   weather: ?object,
 *   cropStatus: { crop: ?string, cropStage: ?string, mode: string, healthScore: ?object },
 *   risks: Array<object>,
 *   topRisk: ?object,
 *   priorityTask: ?object,
 *   nextBestAction: ?object,
 *   alert: ?object,
 *   briefing: ?object,
 *   connectivity: 'online'|'offline'
 * }}
 */
export function getPredictiveBriefing(options) {
  const generatedAt = Date.now();
  let snap;
  try {
    snap = getIntelligenceSnapshot(options);
  } catch {
    snap = null;
  }

  const geo  = (snap && snap.geo)  || { country: null, region: null, language: 'en' };
  const farm = (snap && snap.farm) || {};
  const ie   = (snap && snap.intelligence) || {};
  const ctx  = (snap && snap.context) || null;

  const risks = Array.isArray(ie.risks) ? ie.risks.slice().sort((a, b) => _rankOf(b) - _rankOf(a)) : [];

  return {
    generatedAt,
    geo: {
      country:  geo.country || null,
      region:   geo.region || null,
      language: geo.language || 'en',
    },
    weather: (snap && snap.weather) || null,
    cropStatus: {
      crop:        farm.crop || null,
      cropStage:   farm.cropStage || null,
      mode:        farm.mode || 'farm',
      healthScore: ie.healthScore || null,
    },
    risks,
    topRisk:        risks.length > 0 ? risks[0] : null,
    priorityTask:   ctx ? (ctx.todayTask || null) : null,
    nextBestAction: ie.nextBestAction || null,
    alert:          ctx ? (ctx.alert || null) : null,
    briefing:       ie.briefing || null,
    connectivity:   (snap && snap.connectivity) || 'online',
  };
}

const _module = {
  getPredictiveBriefing,
  getPredictedRisks,
  getTopRisk,
};
export default _module;
