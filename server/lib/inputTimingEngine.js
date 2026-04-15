/**
 * Input & Fertilizer Timing Engine — generates recommendations per farm.
 *
 * Uses:
 *   - crop type
 *   - crop stage
 *   - seasonal timing context
 *   - weather context (rain, humidity, dry spell)
 *   - farmer type (new vs experienced wording)
 *
 * Returns an array of FarmInputRecommendation objects sorted by priority.
 * When weather triggers a delay condition, the recommendation switches
 * to delay title/action instead of the standard apply recommendation.
 *
 * Falls back gracefully when context is missing — shows base recommendations
 * with a confidence note explaining that weather data improves timing.
 *
 * No ML — pure rules-based. Extend by adding rules to inputTimingRules.js.
 */

import { INPUT_TIMING_RULES, adjustPriority, PRIORITY_ORDER } from './inputTimingRules.js';

// ─── Types (JSDoc) ────────────────────────────────────────

/**
 * @typedef {Object} InputTimingContext
 * @property {string} farmId
 * @property {string} crop
 * @property {string} stage
 * @property {string} [farmerType]
 * @property {object} [seasonal]
 * @property {object} [weather]
 *
 * @typedef {Object} FarmInputRecommendation
 * @property {string} id
 * @property {string} farmId
 * @property {string} category
 * @property {'low'|'medium'|'high'} priority
 * @property {string} title
 * @property {string} reason
 * @property {string} action
 * @property {string} dueLabel
 * @property {string} crop
 * @property {string} stage
 * @property {boolean} isDelayed          - true if weather triggered delay
 * @property {boolean} weatherAdjusted    - true if weather shifted priority
 * @property {string|null} confidenceNote
 */

/**
 * Generate input/fertilizer recommendations for a farm.
 *
 * @param {InputTimingContext} context
 * @returns {FarmInputRecommendation[]}
 */
export function generateInputRecommendations(context) {
  const { farmId, crop, stage, weather } = context;
  const normalizedCrop = (crop || '').toLowerCase().trim();
  const normalizedStage = (stage || '').toLowerCase().trim();

  // Filter rules matching crop + stage
  const matching = INPUT_TIMING_RULES.filter((rule) => {
    const cropMatch = rule.crops.includes('*') || rule.crops.includes(normalizedCrop);
    if (!cropMatch) return false;
    return rule.stages.includes(normalizedStage);
  });

  const hasWeather = weather && weather.hasWeatherData;

  const recommendations = matching.map((rule) => {
    let priority = rule.basePriority;
    let weatherAdjusted = false;
    let isDelayed = false;

    // Check if weather says to delay
    if (hasWeather && rule.shouldDelay && rule.shouldDelay(weather)) {
      isDelayed = true;
      weatherAdjusted = true;
      // Delayed recommendations drop priority by 1 level
      priority = adjustPriority(priority, -1);
    }

    // Check if weather says to boost urgency
    if (hasWeather && !isDelayed && rule.shouldBoost && rule.shouldBoost(weather)) {
      priority = adjustPriority(priority, +1);
      weatherAdjusted = true;
    }

    // Pick title/action based on delay state
    const title = isDelayed ? rule.delayTitle : rule.title;
    const action = isDelayed ? rule.delayAction : rule.action;

    // Confidence note when context is limited
    let confidenceNote = null;
    if (!hasWeather) {
      confidenceNote = 'Weather data unavailable — timing may be less precise. Add farm location for weather-adjusted recommendations.';
    }

    return {
      id: `${rule.id}-${farmId}`,
      farmId,
      category: rule.category,
      priority,
      title,
      reason: rule.reason,
      action,
      dueLabel: rule.dueLabel,
      crop: normalizedCrop,
      stage: normalizedStage,
      isDelayed,
      weatherAdjusted,
      confidenceNote,
    };
  });

  // Sort by priority: high → medium → low
  recommendations.sort((a, b) => {
    return PRIORITY_ORDER.indexOf(b.priority) - PRIORITY_ORDER.indexOf(a.priority);
  });

  return recommendations;
}

/**
 * Get all input timing rules (for testing/admin).
 * @returns {import('./inputTimingRules.js').InputTimingRule[]}
 */
export function getAllInputRules() {
  return INPUT_TIMING_RULES;
}

export default { generateInputRecommendations, getAllInputRules };
