/**
 * Pest & Disease Risk Engine — generates risks per farm.
 *
 * Uses:
 *   - crop type
 *   - crop stage
 *   - seasonal timing context
 *   - weather context (humidity, rain, dry spell, temperature)
 *
 * Returns an array of FarmRisk objects sorted by severity (high first).
 * Falls back gracefully when context is missing — shows lower-confidence
 * generic watch items with an explanation that more context improves accuracy.
 *
 * No ML — pure rules-based. Easy to extend by adding rules to pestRiskRules.js.
 */

import { RISK_RULES, adjustSeverity, SEVERITY_ORDER } from './pestRiskRules.js';

// ─── Types (JSDoc) ────────────────────────────────────────

/**
 * @typedef {Object} RiskContext
 * @property {string} farmId
 * @property {string} crop
 * @property {string} stage
 * @property {string} [farmerType]
 * @property {import('./seasonalTiming.js').SeasonalContext} [seasonal]
 * @property {import('./weatherProvider.js').WeatherContext} [weather]
 *
 * @typedef {Object} FarmRisk
 * @property {string} id
 * @property {string} farmId
 * @property {'pest'|'disease'} type
 * @property {'low'|'medium'|'high'} severity
 * @property {string} title
 * @property {string} reason
 * @property {string} action
 * @property {string} crop
 * @property {string} stage
 * @property {boolean} weatherAdjusted   - true if weather shifted severity
 * @property {string|null} confidenceNote - shown when context is incomplete
 */

/**
 * Generate pest/disease risks for a farm based on rules + context.
 *
 * @param {RiskContext} context
 * @returns {FarmRisk[]}
 */
export function generateRisksForFarm(context) {
  const { farmId, crop, stage, weather } = context;
  const normalizedCrop = (crop || '').toLowerCase().trim();
  const normalizedStage = (stage || '').toLowerCase().trim();

  // Filter rules matching crop + stage
  const matching = RISK_RULES.filter((rule) => {
    const cropMatch = rule.crops.includes('*') || rule.crops.includes(normalizedCrop);
    if (!cropMatch) return false;
    const stageMatch = rule.stages.includes(normalizedStage);
    return stageMatch;
  });

  const hasWeather = weather && weather.hasWeatherData;

  const risks = matching.map((rule) => {
    let severity = rule.baseSeverity;
    let weatherAdjusted = false;

    // Apply weather-based severity adjustments
    if (hasWeather) {
      if (rule.weatherBoost && rule.weatherBoost(weather)) {
        severity = adjustSeverity(severity, +1);
        weatherAdjusted = true;
      } else if (rule.weatherReduce && rule.weatherReduce(weather)) {
        severity = adjustSeverity(severity, -1);
        weatherAdjusted = true;
      }
    }

    // Confidence note when context is limited
    let confidenceNote = null;
    if (!hasWeather) {
      confidenceNote = 'Weather data unavailable — risk estimate may be less accurate. Add farm location for better results.';
    }

    return {
      id: `${rule.id}-${farmId}`,
      farmId,
      type: rule.type,
      severity,
      title: rule.title,
      reason: rule.reason,
      action: rule.action,
      crop: normalizedCrop,
      stage: normalizedStage,
      weatherAdjusted,
      confidenceNote,
    };
  });

  // Sort by severity: high → medium → low
  risks.sort((a, b) => {
    return SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity);
  });

  return risks;
}

/**
 * Generate tasks from high/medium pest risks.
 * Returns task-shaped objects that can be appended to the farm task list.
 *
 * @param {FarmRisk[]} risks
 * @param {string} farmId
 * @returns {Array} Task-like objects
 */
export function generateTasksFromRisks(risks, farmId) {
  const now = new Date().toISOString();

  return risks
    .filter((r) => r.severity === 'high' || r.severity === 'medium')
    .map((risk) => ({
      id: `risk-task-${risk.id}`,
      farmId,
      title: riskToTaskTitle(risk),
      description: risk.action,
      priority: risk.severity === 'high' ? 'high' : 'medium',
      reason: risk.reason,
      dueLabel: risk.severity === 'high' ? 'Today' : 'This week',
      crop: risk.crop,
      stage: risk.stage,
      status: 'pending',
      createdAt: now,
      riskNote: `${risk.type === 'pest' ? 'Pest' : 'Disease'} risk: ${risk.title}`,
    }));
}

/**
 * Convert a risk into a concise task title.
 * @param {FarmRisk} risk
 * @returns {string}
 */
function riskToTaskTitle(risk) {
  const cropLabel = risk.crop.charAt(0).toUpperCase() + risk.crop.slice(1);

  if (risk.type === 'pest') {
    return `Inspect ${cropLabel} for ${risk.title.replace(' risk', '').replace(' watch', '')}`;
  }
  return `Check ${cropLabel} for ${risk.title.replace(' risk', '').replace(' watch', '')} signs`;
}

/**
 * Get all risk rules (for testing/admin).
 * @returns {import('./pestRiskRules.js').RiskRule[]}
 */
export function getAllRiskRules() {
  return RISK_RULES;
}

export default { generateRisksForFarm, generateTasksFromRisks, getAllRiskRules };
