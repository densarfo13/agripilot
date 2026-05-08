/**
 * useFarrowayGuidance — top-level guidance hook for Home + briefing.
 *
 * Wraps the lower-level useContextIntelligence hook with the spec
 * §1 output shape:
 *
 *   {
 *     briefing,           — short top-of-Home headline
 *     topTask,            — { title, reason, urgency, cta, category }
 *     urgency,            — 'high' | 'medium' | 'low' (mirrors topTask.urgency)
 *     reason,             — same as topTask.reason (lifted for direct use)
 *     weatherInsight,     — short weather-aware line
 *     stageInsight,       — short crop-stage line (when stage known)
 *     scanInsight,        — short scan-aware line (when recent scan)
 *     recommendedAction,  — single CTA action
 *     confidence,         — 'high' | 'medium' | 'low'
 *     source,             — engine identifier (debug)
 *     explainability,     — { weights, breakdown, signals, candidates }
 *   }
 *
 * Strict-rule audit
 *   • Pure consumer of useContextIntelligence (already a hook).
 *   • All hooks unconditional — rules-of-hooks safe.
 *   • Never throws — wraps everything in try/catch with fallback.
 *   • Never blocks render — useMemo over already-cached engine output.
 *   • No new state, no useEffect, no async work.
 */

import { useMemo } from 'react';
import useContextIntelligence from './useContextIntelligence.js';
import { scoreGuidance } from '../lib/intelligence/scoringEngine.js';

// ─── Helpers ──────────────────────────────────────────────────────

function _briefingFromTask(task) {
  if (!task) return 'Check your crops today and monitor soil moisture.';
  const t = task.title || '';
  const r = task.reason || '';
  // 2-line briefing per spec: title + first sentence of reason.
  const firstSentence = r.split(/(?<=[.!?])\s+/)[0] || '';
  return firstSentence ? `${t}. ${firstSentence}` : t;
}

function _weatherInsightFor(intel) {
  if (!intel || !intel.alert) return '';
  if (intel.alert.priority === 'warning' || intel.alert.priority === 'critical') {
    return intel.alert.message || intel.alert.title || '';
  }
  if (intel.alert.priority === 'info') {
    return intel.alert.message || intel.alert.title || '';
  }
  return '';
}

function _stageInsightFor(ctx) {
  if (!ctx || !ctx.cropStage) return '';
  const stage = String(ctx.cropStage).toLowerCase();
  if (stage.includes('harvest') || stage.includes('fruit')) {
    return 'Harvest window — quality and price are best when picked at peak.';
  }
  if (stage.includes('flower')) {
    return 'Flowering — keep watering steady and watch for pests.';
  }
  if (stage.includes('vegetative') || stage.includes('growth')) {
    return 'Growing — clear weeds and check for early stress signs.';
  }
  if (stage.includes('seed') || stage.includes('germinat')) {
    return 'Seedling — gentle moisture only, never flood the soil.';
  }
  return '';
}

function _scanInsightFor(ctx) {
  if (!ctx || !ctx.recentScanCategory) return '';
  const c = String(ctx.recentScanCategory).toLowerCase();
  if (c.includes('yellow'))   return 'Recent scan: yellowing — check moisture and lower leaves.';
  if (c.includes('pest') || c.includes('hole') || c.includes('insect'))
                              return 'Recent scan: pest signs — check under leaves and stems.';
  if (c.includes('spot') || c.includes('disease') || c.includes('blight'))
                              return 'Recent scan: spot concern — monitor spread and avoid overhead watering.';
  if (c.includes('wilt'))     return 'Recent scan: wilting — check root-zone moisture today.';
  if (c.includes('nutrient') || c.includes('deficien'))
                              return 'Recent scan: nutrient signs — review feeding and soil moisture.';
  if (c === 'healthy')        return 'Recent scan: healthy — keep up the daily check-ins.';
  return '';
}

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * @param {object} [opts]
 * @param {object|null} [opts.weather]        — useLiveWeather() result
 * @param {object|null} [opts.farm]           — active farm record from localStorage
 * @param {object|null} [opts.profile]        — ProfileContext.profile
 * @param {string[]}     [opts.doneToday=[]]  — categories user already completed today
 */
export default function useFarrowayGuidance({
  weather   = null,
  farm      = null,
  profile   = null,
  doneToday = [],
} = {}) {
  // Lower-level engine — already a hook with stable memo deps.
  const intel = useContextIntelligence({ weather, farm, profile });

  // Score the engine's candidates for the spec-shape output.
  return useMemo(() => {
    try {
      // Reconstruct the ctx the scoring engine needs from the same
      // primitive signals useContextIntelligence resolved internally.
      // (No second localStorage hit — we read what we need from
      // farm/profile/weather props directly.)
      const f = (farm    && typeof farm    === 'object') ? farm    : {};
      const p = (profile && typeof profile === 'object') ? profile : {};
      const w = (weather && typeof weather === 'object') ? weather : {};
      const ctx = {
        mode:           intel.mode,
        weatherType:    typeof w.weatherType === 'string' ? w.weatherType : 'unknown',
        temp:           typeof w.temp       === 'number' ? w.temp       : null,
        rainChance:     typeof w.rainChance === 'number' ? w.rainChance : null,
        humidityPct:    typeof w.humidityPct === 'number' ? w.humidityPct : null,
        windSpeedKph:   typeof w.windSpeed  === 'number' ? w.windSpeed   : null,
        crop:           f.crop || f.cropName || p.crop || null,
        cropStage:      f.cropStage || f.stage || p.cropStage || null,
        region:         f.region || f.location || p.region || null,
        indoor:         f.indoor ?? f.isIndoor ?? p.indoor ?? null,
        containerSize:  f.containerSize || f.plotSize || p.containerSize || null,
        recentScanCategory: null, // already captured in intel; scorer doesn't need duplicate
      };

      const guided = scoreGuidance(ctx, Array.isArray(doneToday) ? doneToday : []);
      const topTask = guided.topTask || intel.todayTask;

      return Object.freeze({
        briefing:           _briefingFromTask(topTask),
        topTask,
        urgency:            topTask.urgency || 'medium',
        reason:             topTask.reason  || '',
        weatherInsight:     _weatherInsightFor(intel),
        stageInsight:       _stageInsightFor(ctx),
        scanInsight:        _scanInsightFor({ recentScanCategory: ctx.recentScanCategory ?? null }),
        recommendedAction:  topTask.cta || 'Mark as done',
        confidence:         guided.confidence,
        source:             guided.source,
        explainability:     guided.explainability,
        // Pass-through for components that still consume the lower hook.
        intel,
      });
    } catch {
      return Object.freeze({
        briefing:           'Check your crops today and monitor soil moisture.',
        topTask:            (intel && intel.todayTask) || null,
        urgency:            'medium',
        reason:             'Water only if the soil feels dry.',
        weatherInsight:     '',
        stageInsight:       '',
        scanInsight:        '',
        recommendedAction:  'Mark as done',
        confidence:         'low',
        source:             'guidance-fallback',
        explainability:     { weights: {}, breakdown: {}, signals: [], candidates: 0 },
        intel,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intel, weather, farm, profile, doneToday]);
}

export { useFarrowayGuidance };
