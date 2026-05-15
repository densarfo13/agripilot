/**
 * getIntelligenceSnapshot.js — THE canonical intelligence entry point.
 *
 *   import {
 *     getIntelligenceSnapshot, getLocalizedCropName,
 *     getLocalizedTaskText, getWeatherGuidance, getScanGuidance,
 *     getTodayRecommendation, getRiskSummary,
 *   } from 'src/core/intelligence/getIntelligenceSnapshot.js';
 *
 * Why this file exists
 * ────────────────────
 *   The intelligence layer is already built and tested — but it is
 *   reached through several modules:
 *
 *     • unifiedIntelligence.js  → getUnifiedIntelligence()  (the
 *         normalized snapshot: geo, farm, weather, intelligence,
 *         context, agriculture, connectivity)
 *     • agricultureRegistry.js  → getCropLabel / getTaskLabel /
 *         getWeatherMessage / getScanExplanation  (localized labels)
 *
 *   A screen had to know which module owns which getter. This file
 *   is the ONE canonical import surface every screen, the voice
 *   assistant, and the Copilot Beta use. It does NOT add a new
 *   engine or a competing FarmContext — it re-exports and lightly
 *   composes the engines that already ship. Same-input-same-output,
 *   read-only, never throws.
 *
 * The ONE snapshot rule
 *   getIntelligenceSnapshot() === getUnifiedIntelligence(). There is
 *   exactly one snapshot implementation; this is its canonical name.
 *   No component should build farm/language/weather/crop truth on
 *   its own — it reads this.
 *
 * Strict-rule audit
 *   • No duplicate state, no new provider. Pure re-export + thin
 *     derivations over the existing engines.
 *   • SSR-safe, never throws.
 */

import { getUnifiedIntelligence } from './unifiedIntelligence.js';
import {
  getCropLabel,
  getTaskLabel,
  getWeatherMessage,
  getScanExplanation,
  getAgricultureVocabulary,
} from './agricultureRegistry.js';

/**
 * THE canonical, read-only intelligence snapshot. Identical to
 * getUnifiedIntelligence — this is simply its canonical name.
 *
 * @param {object} [options]  forwarded (nowMs / weatherOverride / farmerName)
 * @returns {object} the unified snapshot
 *   { geo, farm, weather, intelligence, context, agriculture,
 *     connectivity, readAt, errors }
 */
export function getIntelligenceSnapshot(options) {
  return getUnifiedIntelligence(options);
}

// ─── Localized label facade (spec §2) ──────────────────────────
// Thin spec-named aliases over the agriculture registry so callers
// have one vocabulary surface. No component should look up a crop
// or task string itself.

/** Localized crop name. */
export function getLocalizedCropName(cropId, language) {
  return getCropLabel(cropId, language);
}

/** Localized task wording. */
export function getLocalizedTaskText(taskId, language) {
  return getTaskLabel(taskId, language);
}

/** Calm, localized weather guidance message. */
export function getWeatherGuidance(type, language) {
  return getWeatherMessage(type, language);
}

/** Localized scan explanation. */
export function getScanGuidance(scanType, language) {
  return getScanExplanation(scanType, language);
}

// ─── Derived views (spec §2) ───────────────────────────────────

/**
 * Today's recommendation — the calm task / recommendation / alert
 * trio the Home surface shows. Derived from the snapshot's context
 * block (computeContextIntelligence output), never recomputed.
 *
 * @param {object} [options]
 * @returns {{ task: ?object, recommendation: ?object, alert: ?object } | null}
 */
export function getTodayRecommendation(options) {
  try {
    const snap = getUnifiedIntelligence(options);
    const ctx = snap && snap.context;
    if (!ctx) return null;
    return {
      task:           ctx.todayTask || null,
      recommendation: ctx.recommendation || null,
      alert:          ctx.alert || null,
    };
  } catch {
    return null;
  }
}

/**
 * Risk summary — the predictive risks + health score, normalized
 * for any surface that shows a risk banner.
 *
 * @param {object} [options]
 * @returns {{ count:number, risks:Array, healthScore:?object, topRisk:?object }}
 */
export function getRiskSummary(options) {
  try {
    const snap = getUnifiedIntelligence(options);
    const ie = (snap && snap.intelligence) || {};
    const risks = Array.isArray(ie.risks) ? ie.risks : [];
    return {
      count:       risks.length,
      risks,
      healthScore: ie.healthScore || null,
      topRisk:     risks.length > 0 ? risks[0] : null,
    };
  } catch {
    return { count: 0, risks: [], healthScore: null, topRisk: null };
  }
}

/** The language-bound agricultural vocabulary for the active (or a
 *  given) language — re-exported so callers need only this module. */
export { getAgricultureVocabulary };

const _module = {
  getIntelligenceSnapshot,
  getLocalizedCropName,
  getLocalizedTaskText,
  getWeatherGuidance,
  getScanGuidance,
  getTodayRecommendation,
  getRiskSummary,
  getAgricultureVocabulary,
};
export default _module;
