/**
 * invisibleIntelligenceEngine.js — single facade that composes
 * the operational engines into one structured snapshot Home /
 * MyFarm consumes.
 *
 *   import { computeInvisibleIntelligence }
 *     from 'src/core/intelligence/invisibleIntelligenceEngine.js';
 *
 *   const view = computeInvisibleIntelligence({
 *     crop, plantingDate, weather, scanHistory, mode, country,
 *   });
 *
 *   view → {
 *     lifecycle, weatherInsight, watering, risks[],
 *     harvestReadiness, dailyDecision, top3, yieldEstimate,
 *   }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure composition layer over the engines we already ship.
 *   It does NOT make any prediction itself, does NOT call any
 *   model, and does NOT add new state. It calls each engine
 *   ONCE per snapshot and hands every output back as a single
 *   typed object — so surfaces can render any subset without
 *   re-orchestrating each engine.
 *
 *   "Invisible" because the caller doesn't have to know each
 *   engine's signature — it just gets a calm structured view.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { computeLifecycleSnapshot } from '../lifecycle/cropLifecycleEngine.js';
import { interpretWeather } from '../weather/weatherOperationalInterpreter.js';
import { computeWateringRecommendation } from '../watering/wateringEngine.js';
import { detectFarmRisks } from './riskEngine.js';
import { computeHarvestReadiness } from './harvestReadinessEngine.js';
import { estimateYield } from './yieldForecastEngine.js';
import { computeDailyDecisionForCurrentUser } from '../lifecycle/dailyDecisionAssistant.js';
import { computeTodayTop3 } from '../decision/top3PrioritiesComposer.js';

function _safe(fn, fallback) {
  try { return fn(); }
  catch { return fallback; }
}

/**
 * Compute the full invisible-intelligence snapshot.
 *
 * @param {object} args
 * @param {string} [args.crop]
 * @param {string|number|Date} [args.plantingDate]
 * @param {string} [args.mode]
 * @param {object} [args.weather]
 * @param {Array}  [args.scanHistory]
 * @param {string} [args.country]
 * @param {string} [args.climate]
 * @param {string} [args.setting]
 * @param {number} [args.plantCount]
 * @param {number} [args.taskCompletionRate]
 * @param {number} [args.nowMs]
 * @returns {object}
 */
export function computeInvisibleIntelligence(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const crop = a.crop || null;
    const mode = a.mode || null;
    const weather = a.weather || {};
    const scanHistory = a.scanHistory || [];
    const nowMs = Number.isFinite(a.nowMs) ? a.nowMs : Date.now();

    const lifecycle = _safe(() => computeLifecycleSnapshot({
      crop, mode, plantingDate: a.plantingDate, weather,
      scanHistory, climate: a.climate, setting: a.setting, nowMs,
    }), null);

    const weatherInsight = _safe(() => interpretWeather({
      weather, mode, crop,
      cropStage: lifecycle && lifecycle.currentStage,
    }), null);

    const watering = _safe(() => computeWateringRecommendation({
      crop, mode, weather,
      taskHistory: { lastWateredAt: a.lastWateredAt },
      stress: a.scanStress,
      nowMs,
    }), null);

    const risks = _safe(() => detectFarmRisks({
      crop, weather, scanHistory, lifecycle,
    }), []);

    const harvestReadiness = (crop && a.plantingDate)
      ? _safe(() => computeHarvestReadiness({
          crop, plantingDate: a.plantingDate, weather,
          opts: { climate: a.climate, setting: a.setting },
          nowMs,
        }), null)
      : null;

    const yieldEstimate = (crop && Number.isFinite(a.plantCount) && a.plantCount > 0)
      ? _safe(() => estimateYield({
          crop, plantCount: a.plantCount,
          scanHistory, taskCompletionRate: a.taskCompletionRate,
        }), null)
      : null;

    const dailyDecision = _safe(() => computeDailyDecisionForCurrentUser({
      crop, mode, weather, scanHistory,
      lifecycle, watering, weatherInsight,
      nowMs,
    }), null);

    const top3 = _safe(() => computeTodayTop3({
      crop, mode, weather, scanHistory,
      lifecycle, watering, weatherInsight,
      nowMs,
    }), null);

    return Object.freeze({
      ok:               true,
      crop:             crop || null,
      mode:             (lifecycle && lifecycle.mode) || mode || 'gardener',
      lifecycle,
      weatherInsight,
      watering,
      risks:            Array.isArray(risks) ? risks : [],
      harvestReadiness,
      yieldEstimate,
      dailyDecision,
      top3,
      generatedAt:      new Date(nowMs).toISOString(),
      disclaimer:       'All values are estimates — local conditions and your variety may shift them.',
    });
  } catch {
    return Object.freeze({
      ok:          false,
      reason:      'exception',
      risks:       [],
      generatedAt: new Date().toISOString(),
      disclaimer:  'We could not build a guidance snapshot right now.',
    });
  }
}

const _module = { computeInvisibleIntelligence };
export default _module;
