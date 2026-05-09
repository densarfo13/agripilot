/**
 * intelligenceOrchestrator — the single entry the UI calls.
 *
 *   const insight = getFarmerInsight(rawInput);
 *
 *   // For NGO/Admin surfaces that may see metadata:
 *   const full = analyseContext(rawInput);
 *
 * RESPONSIBILITIES
 *   1. Build a normalized IntelligenceContext via
 *      buildIntelligenceContext(input).
 *   2. Run prediction + risk + trust + a generic fallback.
 *   3. Pick ONE result for the farmer surface (spec §10:
 *      "one visible insight per screen").
 *   4. Hand it through the farmerInsightAdapter so the final
 *      shape is calm, action-framed, and free of scores or
 *      forbidden wording.
 *
 * NEVER THROWS.  Returns `null` from the farmer-facing helper
 * when nothing actionable applies; the calling component should
 * render its own quiet "all caught up" state in that case.
 */

import { buildIntelligenceContext } from './intelligenceContext.js';
import { predictNextBestAction }    from './prediction.js';
import { estimateCropRisk }         from './risk.js';
import { estimateTrustSignals }     from './trust.js';
import { toFarmerFriendlyInsight }  from './farmerInsightAdapter.js';

/**
 * Run every engine + adapter and return the consolidated bundle.
 * Used by NGO/Admin surfaces and by the farmer entry below.
 *
 * @param {object} input - raw input; tolerated as undefined / partial
 * @returns {{
 *   context:    import('./intelligenceTypes.js').IntelligenceContext,
 *   prediction: import('./intelligenceTypes.js').Prediction|null,
 *   risk:       import('./intelligenceTypes.js').RiskEstimate|null,
 *   trust:      import('./intelligenceTypes.js').TrustSignals,
 *   farmerInsight: import('./intelligenceTypes.js').FarmerInsight|null,
 * }}
 */
export function analyseContext(input = {}) {
  const context = buildIntelligenceContext(input);

  let prediction = null;
  try { prediction = predictNextBestAction(context); }
  catch { prediction = null; }

  let risk = null;
  try { risk = estimateCropRisk(context); }
  catch { risk = null; }

  let trust;
  try { trust = estimateTrustSignals(context); }
  catch {
    // Minimal safe shape — never crash the orchestrator.
    trust = Object.freeze({
      verificationState:           'verification_in_progress',
      internalRiskFlags:           Object.freeze([]),
      recommendedModerationAction: 'none',
    });
  }

  // Pick which engine drives the farmer insight. Spec §10 wants
  // "one visible insight per screen" — prefer the most time-
  // sensitive nudge:
  //   1. Prediction (rule-based; covers weather + scan + harvest)
  //   2. Risk estimate (calm soft risk, e.g. drainage hint)
  //   3. null — caller renders the quiet empty state
  let farmerInsight = null;
  try {
    if (prediction) {
      farmerInsight = toFarmerFriendlyInsight(prediction);
    } else if (risk) {
      farmerInsight = toFarmerFriendlyInsight(risk);
    }
  } catch { farmerInsight = null; }

  return Object.freeze({ context, prediction, risk, trust, farmerInsight });
}

/**
 * Farmer-facing entry. Returns the calm `FarmerInsight` shape or
 * `null` when nothing actionable is available (caller shows its
 * own "all caught up" surface).
 *
 * @param {object} input
 * @returns {import('./intelligenceTypes.js').FarmerInsight|null}
 */
export function getFarmerInsight(input = {}) {
  try {
    const { farmerInsight } = analyseContext(input);
    return farmerInsight;
  } catch {
    return null;
  }
}

const _module = { analyseContext, getFarmerInsight };
export default _module;
