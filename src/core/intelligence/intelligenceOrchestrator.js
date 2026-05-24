/**
 * intelligenceOrchestrator.js — single entry the surface uses
 * to ask "what is the ONE best action right now?" with all the
 * suppression / timing / scan-trust gating baked in.
 *
 *   import { orchestrateIntelligence }
 *     from 'src/core/intelligence/intelligenceOrchestrator.js';
 *
 *   const view = orchestrateIntelligence({
 *     snapshot, scanHistory, ignoreLog, experienceLevel,
 *   });
 *
 *   view → {
 *     primaryAction, supportingInsight, suppressedRecommendations,
 *     urgency, confidence, reason, bestTime, nextStep,
 *   }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A composition layer over already-shipped engines. It does NOT
 *   add intelligence; it picks ONE primary action from the
 *   existing candidate sources, runs suppression, gates scan-
 *   dependent items on actual image trust, and resolves timing
 *   via the timing engine.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Every visible string is { key, fallback, params } via the
 *     upstream engines.
 */

import { computeInvisibleIntelligence } from './invisibleIntelligenceEngine.js';
import { suppressRecommendations } from './recommendationSuppression.js';
import { optimalTimingFor } from './timingEngine.js';
import { WATERING_ACTION } from '../watering/wateringEngine.js';

const _str = (v) => String(v == null ? '' : v).toLowerCase();

/**
 * Whether a scan-dependent recommendation should be downgraded
 * because the most recent scan is untrustworthy (image invalid,
 * preview failed, etc.). Surfaces should prefer the manual
 * fallback path when this fires.
 */
function _isScanTrustLimited(snapshot, scanHistory) {
  try {
    const list = Array.isArray(scanHistory) ? scanHistory : [];
    if (list.length === 0) return true;
    const recent = list[list.length - 1] || {};
    // Explicit invalid flag.
    if (recent.imageInvalid === true) return true;
    // Confidence label is needs_review → not enough trust to
    // surface as a high-confidence primary action.
    const conf = _str(recent.confidenceLabel || recent.confidence);
    if (conf === 'needs_review' || conf === 'needs review') return true;
    return false;
  } catch { return true; }
}

function _actionFromTop3(top3) {
  if (!top3 || !Array.isArray(top3.priorities) || top3.priorities.length === 0) return null;
  return top3.priorities[0];
}

/**
 * One-call orchestration.
 *
 * @param {object} args
 * @param {object} [args.snapshot]         from getIntelligenceSnapshot
 * @param {string} [args.crop]
 * @param {string} [args.mode]
 * @param {object} [args.weather]
 * @param {Array}  [args.scanHistory]
 * @param {Array}  [args.taskHistory]
 * @param {object} [args.ignoreLog]        `{ type::id: ignoreCount }`
 * @param {object} [args.quietHours]
 * @param {string} [args.experienceLevel]
 * @param {number} [args.nowMs]
 * @returns {object}
 */
export function orchestrateIntelligence(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const snap = (a.snapshot && typeof a.snapshot === 'object') ? a.snapshot : {};
    const crop = a.crop || snap.crop || null;
    const mode = a.mode || snap.mode || null;
    const nowMs = Number.isFinite(a.nowMs) ? a.nowMs : Date.now();

    const intelligence = computeInvisibleIntelligence({
      ...snap, ...a,
      crop, mode,
      weather: a.weather || snap.weather,
      scanHistory: a.scanHistory || snap.scanHistory,
      nowMs,
    });

    const top3 = intelligence.top3;
    const candidates = (top3 && Array.isArray(top3.priorities)) ? top3.priorities.slice() : [];

    // Suppress conflicts / duplicates / ignored.
    const rainSkip = !!(intelligence.watering
      && intelligence.watering.recommendation === WATERING_ACTION.SKIP);
    const { kept, suppressed } = suppressRecommendations(candidates, {
      signals: {
        rainSkip,
        lastWateredAt: snap.lastWateredAt || a.lastWateredAt,
      },
      ignoreLog: a.ignoreLog,
      nowMs,
    });

    let primary = kept[0] || null;
    const scanTrustLimited = _isScanTrustLimited(snap, a.scanHistory);

    // Scan-trust downgrade — if the primary action is a scan-
    // dependent follow-up but the most recent scan failed image
    // trust, downgrade to the next-best non-scan candidate.
    if (primary && primary.type === 'urgent_scan_followup' && scanTrustLimited) {
      const downgraded = kept.find((c) => c.type !== 'urgent_scan_followup');
      if (downgraded) primary = downgraded;
    }

    // Resolve a per-action timing — overrides bestTime when the
    // weather suggests a different slot than the engine's default.
    let bestTime = primary ? (primary.bestTime || 'today') : 'today';
    if (primary) {
      const actionType = (primary.type === 'watering' || primary.type === 'watering_skip') ? 'water'
        : primary.type === 'harvest_readiness' ? 'harvest'
          : primary.type === 'urgent_scan_followup' ? 'inspect'
            : null;
      if (actionType) {
        const t = optimalTimingFor({
          action: actionType,
          urgency: primary.urgency,
          weather: a.weather || snap.weather,
          quietHours: a.quietHours,
          nowMs,
        });
        if (t && t.slot) bestTime = t.slot;
      }
    }

    // Supporting insight — the most prominent non-primary signal.
    let supportingInsight = null;
    if (intelligence.weatherInsight && intelligence.weatherInsight.primary
        && intelligence.weatherInsight.primary.type !== 'current') {
      supportingInsight = intelligence.weatherInsight.primary.localizedMessage || null;
    } else if (Array.isArray(intelligence.risks) && intelligence.risks.length > 0) {
      supportingInsight = intelligence.risks[0].message || null;
    }

    const confidence = scanTrustLimited && primary && primary.type !== 'urgent_scan_followup'
      ? 'limited_scan_trust'
      : (primary && primary.urgency === 'high' ? 'firm' : 'gentle');

    return Object.freeze({
      ok:                          true,
      primaryAction:               primary,
      supportingInsight,
      suppressedRecommendations:   suppressed,
      urgency:                     primary ? primary.urgency : 'low',
      confidence,
      reason:                      primary ? primary.why : null,
      bestTime,
      nextStep:                    primary && primary.explanation
        ? { key: 'orchestrator.next_step', fallback: primary.explanation, params: {} }
        : null,
      scanTrustLimited,
      generatedAt:                 new Date(nowMs).toISOString(),
      disclaimer:                  'One best action — based on recent signals; local conditions may shift it.',
    });
  } catch {
    return Object.freeze({
      ok:                        false,
      primaryAction:             null,
      supportingInsight:         null,
      suppressedRecommendations: [],
      urgency:                   'low',
      confidence:                'gentle',
      reason:                    null,
      bestTime:                  'today',
      nextStep:                  null,
      scanTrustLimited:          false,
      generatedAt:               new Date().toISOString(),
      disclaimer:                'Guidance is not available right now — try again soon.',
    });
  }
}

const _module = { orchestrateIntelligence };
export default _module;
