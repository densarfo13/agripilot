/**
 * predictiveYieldEngine.js — Phase 2 §4.
 *
 *   import { runPredictiveYield }
 *     from 'src/core/yield/predictiveYieldEngine.js';
 *
 *   const v = runPredictiveYield({
 *     activeFarm, crop, region, lifecycleStage, size, sizeUnit,
 *     weatherHistory, taskCompletion, scanTrends,
 *     diseaseRecurrence, soilHints, wateringHistory,
 *   });
 *
 *   v = {
 *     yieldRisk:        'stable' | 'watch' | 'at_risk' | 'unknown',
 *     reason,           — { key, fallback, params }
 *     confidenceTone,   — 'high_confidence' | 'medium_confidence' | 'needs_review'
 *     nextBestAction,   — { key, fallback, params }
 *     dataGaps,         — [{ kind, key, fallback }]
 *     fallbackUsed,     — true when feature flag OFF or data insufficient
 *     engineVersion:'predictive-yield-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   Estimates yield RISK DIRECTION, never an exact number. Surfaces
 *   render the risk band + reason; never the underlying numeric
 *   estimate (those are not reliable enough yet).
 *
 *   Rules (conservative):
 *     • flag OFF OR data quality insufficient → `unknown` with
 *       a calm "still building" explanation
 *     • disease recurrence ≥ 3 in last 30 days → `at_risk`
 *     • task completion < 0.4 → `at_risk`
 *     • scan trend = worsening → `watch` (or `at_risk` if disease)
 *     • all green signals → `stable`
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Never returns exact kg numbers from this layer (a future
 *     calibrated model can extend the envelope).
 */

import { FLAG, isFeatureFlagOn } from '../deployment/deploymentGovernance.js';
import { gateEngine } from '../intelligence/dataQualityGate.js';

const ENGINE_VERSION = 'predictive-yield-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _collectDataGaps(input) {
  const out = [];
  if (!_isObj(input.weatherHistory) && !Array.isArray(input.weatherHistory)) {
    out.push(Object.freeze({
      kind: 'weather',
      key:  'predYield.gap.weather',
      fallback: 'Weather history is still building.',
    }));
  }
  if (!Array.isArray(input.scanTrends) || input.scanTrends.length === 0) {
    out.push(Object.freeze({
      kind: 'scans',
      key:  'predYield.gap.scans',
      fallback: 'A few more scans will sharpen this estimate.',
    }));
  }
  if (!Array.isArray(input.taskCompletion) || input.taskCompletion.length === 0) {
    out.push(Object.freeze({
      kind: 'tasks',
      key:  'predYield.gap.tasks',
      fallback: 'Logging completed tasks improves accuracy.',
    }));
  }
  return out;
}

function _taskCompletionRate(input) {
  const list = Array.isArray(input.taskCompletion) ? input.taskCompletion : [];
  if (list.length === 0) return null;
  const completed = list.filter((t) => t && t.completed === true).length;
  return completed / list.length;
}

function _scanTrendDirection(input) {
  const trends = Array.isArray(input.scanTrends) ? input.scanTrends : [];
  if (trends.length === 0) return null;
  // Look at the most recent trend bucket.
  const latest = trends[0];
  if (!_isObj(latest)) return null;
  return _str(latest.direction).toLowerCase() || null;
}

function _diseaseRecurrenceCount(input) {
  const list = Array.isArray(input.diseaseRecurrence) ? input.diseaseRecurrence : [];
  return list.length;
}

/**
 * Estimate yield risk. Always returns an envelope; never throws.
 */
export function runPredictiveYield(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};

    const flagOn = isFeatureFlagOn(FLAG.ENABLE_PREDICTIVE_YIELD);
    const gate   = gateEngine('predictive_yield', safe);

    const dataGaps = _collectDataGaps(safe);

    if (!flagOn || !gate.ready) {
      return Object.freeze({
        engineVersion:    ENGINE_VERSION,
        yieldRisk:        'unknown',
        reason: Object.freeze({
          key:      'predYield.reason.stillBuilding',
          fallback: 'Yield outlook is still building — log a few more days of activity.',
        }),
        confidenceTone:   'medium_confidence',
        nextBestAction: Object.freeze({
          key:      'predYield.action.keepLogging',
          fallback: 'Keep logging tasks and scans — outlook will sharpen.',
        }),
        dataGaps:         Object.freeze(dataGaps),
        fallbackUsed:     true,
        generatedAt:      Date.now(),
      });
    }

    const recurrence = _diseaseRecurrenceCount(safe);
    const completion = _taskCompletionRate(safe);
    const trend      = _scanTrendDirection(safe);

    let yieldRisk = 'stable';
    let reasonKey = 'predYield.reason.stable';
    let reasonFallback = 'No worrying signals — your routine is working.';
    if (recurrence >= 3) {
      yieldRisk = 'at_risk';
      reasonKey = 'predYield.reason.recurringDisease';
      reasonFallback = 'This issue has appeared repeatedly — it may affect harvest quality.';
    } else if (completion != null && completion < 0.4) {
      yieldRisk = 'at_risk';
      reasonKey = 'predYield.reason.lowCompletion';
      reasonFallback = 'A number of tasks have been missed recently — yield may dip.';
    } else if (trend === 'worsening') {
      yieldRisk = recurrence >= 1 ? 'at_risk' : 'watch';
      reasonKey = 'predYield.reason.worseningTrend';
      reasonFallback = 'Recent scans suggest things may be heading the wrong way.';
    } else if (recurrence >= 1) {
      yieldRisk = 'watch';
      reasonKey = 'predYield.reason.singleRecurrence';
      reasonFallback = 'This issue has appeared before — worth a closer look.';
    }

    const confidenceTone = (yieldRisk === 'stable') ? 'medium_confidence'
                         : (recurrence >= 2 || completion != null && completion < 0.3) ? 'high_confidence'
                         : 'medium_confidence';

    const nextBestAction = (yieldRisk === 'at_risk')
      ? Object.freeze({
          key:      'predYield.action.act',
          fallback: 'Address the recurring issue this week to protect harvest.',
        })
      : (yieldRisk === 'watch')
        ? Object.freeze({
            key:      'predYield.action.monitor',
            fallback: 'Keep a closer eye on the field for the next few days.',
          })
        : Object.freeze({
            key:      'predYield.action.keepRoutine',
            fallback: 'Stay close to your routine — outlook is steady.',
          });

    return Object.freeze({
      engineVersion:    ENGINE_VERSION,
      yieldRisk,
      reason: Object.freeze({
        key: reasonKey, fallback: reasonFallback,
      }),
      confidenceTone,
      nextBestAction,
      dataGaps:         Object.freeze(dataGaps),
      fallbackUsed:     false,
      generatedAt:      Date.now(),
    });
  }, Object.freeze({
    engineVersion:    ENGINE_VERSION,
    yieldRisk:        'unknown',
    reason: Object.freeze({
      key:      'predYield.reason.stillBuilding',
      fallback: 'Yield outlook is still building — log a few more days of activity.',
    }),
    confidenceTone:   'medium_confidence',
    nextBestAction: Object.freeze({
      key:      'predYield.action.keepLogging',
      fallback: 'Keep logging tasks and scans — outlook will sharpen.',
    }),
    dataGaps:         Object.freeze([]),
    fallbackUsed:     true,
    generatedAt:      Date.now(),
  }));
}

export const _internal = Object.freeze({
  _collectDataGaps, _taskCompletionRate, _scanTrendDirection,
  _diseaseRecurrenceCount, ENGINE_VERSION,
});

const _module = { runPredictiveYield, _internal };
export default _module;
