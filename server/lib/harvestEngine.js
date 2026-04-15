/**
 * Harvest & Post-Harvest Engine — generates recommendations per farm.
 *
 * Uses:
 *   - crop type
 *   - crop stage
 *   - seasonal timing context
 *   - weather context (rain, humidity, temperature)
 *
 * Returns an array of FarmHarvestRecommendation objects sorted by priority.
 * Weather conditions can boost urgency (e.g., rain before harvest = urgent drying prep).
 *
 * Falls back gracefully when context is missing — shows base recommendations
 * with a confidence note.
 *
 * No ML — pure rules-based. Extend by adding rules to harvestRules.js.
 */

import { HARVEST_RULES, adjustPriority, PRIORITY_ORDER } from './harvestRules.js';

// ─── Types (JSDoc) ────────────────────────────────────────

/**
 * @typedef {Object} HarvestContext
 * @property {string} farmId
 * @property {string} crop
 * @property {string} stage
 * @property {string} [farmerType]
 * @property {object} [seasonal]
 * @property {object} [weather]
 *
 * @typedef {Object} FarmHarvestRecommendation
 * @property {string} id
 * @property {string} farmId
 * @property {'harvest-readiness'|'post-harvest'} category
 * @property {'low'|'medium'|'high'} priority
 * @property {string} title
 * @property {string} reason
 * @property {string} action
 * @property {string} dueLabel
 * @property {string} crop
 * @property {string} stage
 * @property {boolean} weatherAdjusted
 * @property {string|null} confidenceNote
 */

/**
 * Generate harvest/post-harvest recommendations for a farm.
 *
 * @param {HarvestContext} context
 * @returns {FarmHarvestRecommendation[]}
 */
export function generateHarvestRecommendations(context) {
  const { farmId, crop, stage, weather } = context;
  const normalizedCrop = (crop || '').toLowerCase().trim();
  const normalizedStage = (stage || '').toLowerCase().trim();

  // Filter rules matching crop + stage
  const matching = HARVEST_RULES.filter((rule) => {
    const cropMatch = rule.crops.includes('*') || rule.crops.includes(normalizedCrop);
    if (!cropMatch) return false;
    return rule.stages.includes(normalizedStage);
  });

  const hasWeather = weather && weather.hasWeatherData;

  const recommendations = matching.map((rule) => {
    let priority = rule.basePriority;
    let weatherAdjusted = false;

    if (hasWeather) {
      if (rule.weatherBoost && rule.weatherBoost(weather)) {
        priority = adjustPriority(priority, +1);
        weatherAdjusted = true;
      } else if (rule.weatherReduce && rule.weatherReduce(weather)) {
        priority = adjustPriority(priority, -1);
        weatherAdjusted = true;
      }
    }

    let confidenceNote = null;
    if (!hasWeather) {
      confidenceNote = 'Weather data unavailable — timing estimate may be less precise. Add farm location for better results.';
    }

    return {
      id: `${rule.id}-${farmId}`,
      farmId,
      category: rule.category,
      priority,
      title: rule.title,
      reason: rule.reason,
      action: rule.action,
      dueLabel: rule.dueLabel,
      crop: normalizedCrop,
      stage: normalizedStage,
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
 * Get all harvest rules (for testing/admin).
 * @returns {import('./harvestRules.js').HarvestRule[]}
 */
export function getAllHarvestRules() {
  return HARVEST_RULES;
}

export default { generateHarvestRecommendations, getAllHarvestRules };
