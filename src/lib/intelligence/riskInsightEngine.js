/**
 * riskInsightEngine.js — farm-intelligence adapter over the existing
 * farmerSignalEngine. Emits a compact, UI-friendly shape:
 *
 *   getRiskInsight({ farm, tasks, issues, weather, crop, farmType }) → {
 *     level:     'low' | 'medium' | 'high',
 *     type:      'pest' | 'disease' | 'nutrient_deficiency'
 *                  | 'water_stress' | 'physical_damage'
 *                  | 'weather' | 'unknown',
 *     message:         short farmer-facing headline
 *     messageKey:      i18n key
 *     timeWindow:      'today' | 'this_week' | null
 *     why:             one-liner "why this?"
 *     whyKey:          i18n key
 *     primaryAction:   one short action
 *     primaryActionKey
 *     tone:            'info' | 'warn' | 'danger'
 *     requiresReview:  boolean
 *     confidenceLevel: 'low' | 'medium' | 'high'
 *     ruleTag:         debugging tag
 *   } | null
 *
 * null when the aggregator says level=low and there's nothing for the
 * farmer to do today — UI hides the banner in that case.
 */

import { getFarmerSignals } from '../signals/farmerSignalEngine.js';
import { formatRiskInsight } from '../farmer/insightFormatter.js';

const WHY_BY_CATEGORY = Object.freeze({
  pest:                 { fallback: 'Multiple signals suggest pest activity is building — early inspection prevents spread.',
                          key: 'farmer.insight.risk.why.pest' },
  disease:              { fallback: 'Weather + missed checks line up with disease risk; catching it early keeps it local.',
                          key: 'farmer.insight.risk.why.disease' },
  nutrient_deficiency:  { fallback: 'Growth patterns suggest the plants are short on one or more nutrients.',
                          key: 'farmer.insight.risk.why.nutrient' },
  water_stress:         { fallback: 'Soil moisture trend + weather suggest the crop is under water stress.',
                          key: 'farmer.insight.risk.why.water' },
  physical_damage:      { fallback: 'Signs of external damage are building — inspect for wind, hail, or animal impact.',
                          key: 'farmer.insight.risk.why.damage' },
  weather:              { fallback: 'Weather pattern alone is enough to stress the crop this week.',
                          key: 'farmer.insight.risk.why.weather' },
  unknown:              { fallback: 'Several partial signals are unclear — a quick field check confirms or clears it.',
                          key: 'farmer.insight.risk.why.unknown' },
});

const TIME_WINDOW_BY_LEVEL = Object.freeze({
  high:   { window: 'today',     key: 'farmer.insight.risk.window.today' },
  medium: { window: 'this_week', key: 'farmer.insight.risk.window.week'  },
  low:    { window: null,        key: null },
});

export function getRiskInsight({
  farm         = null,
  tasks        = [],
  completions  = [],
  issues       = [],
  weather      = null,
  crop         = null,
  farmType     = null,
  now          = null,
} = {}) {
  // Seed the aggregator. The engine tolerates every field being empty.
  const signals = getFarmerSignals({
    farm:       farm || { farmType },
    tasks,
    completions,
    issues,
    weather,
    now:        now || undefined,
  });

  if (!signals) return null;
  if (signals.riskLevel === 'low') return null;

  const level = signals.riskLevel;                            // medium | high
  const type  = (signals.likelyCategory || 'unknown').toLowerCase();
  const tone  = level === 'high' ? 'danger' : 'warn';

  // Use insightFormatter to get a solid action triple when the
  // category is one it knows; otherwise build a generic one.
  const formatted = formatRiskInsight({
    risk: { level, type: type === 'weather' ? 'weather' :
                        type === 'pest' ? 'pest' :
                        type === 'disease' ? 'disease' : 'weather' },
    crop,
  });

  const tw = TIME_WINDOW_BY_LEVEL[level] || TIME_WINDOW_BY_LEVEL.low;
  const why = WHY_BY_CATEGORY[type] || WHY_BY_CATEGORY.unknown;

  const primaryAction    = (formatted && formatted.actions && formatted.actions[0])
    || signals.suggestedActionFallback
    || 'Inspect the field today and record what you see.';
  const primaryActionKey = (formatted && formatted.actionKeys && formatted.actionKeys[0])
    || signals.suggestedActionKey
    || 'farmer.insight.risk.action.inspect';

  const messageKey = signals.likelyCategoryKey || 'farmer.insight.risk.message.generic';
  const message    = signals.likelyCategoryFallback
    || (formatted && formatted.condition)
    || 'Something needs a closer look this week';

  return Object.freeze({
    level,
    type,
    message,
    messageKey,
    timeWindow:      tw.window,
    timeWindowKey:   tw.key,
    primaryAction,
    primaryActionKey,
    why:             why.fallback,
    whyKey:          why.key,
    tone,
    requiresReview:  !!signals.requiresReview,
    confidenceLevel: signals.confidenceLevel || 'medium',
    ruleTag:         (formatted && formatted.ruleTag) || `risk_${type}`,
  });
}

export const _internal = Object.freeze({ WHY_BY_CATEGORY, TIME_WINDOW_BY_LEVEL });
