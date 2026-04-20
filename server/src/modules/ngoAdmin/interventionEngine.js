/**
 * interventionEngine.js — pure rule set that maps a risk level
 * (+ crop + stage) onto a structured intervention payload.
 *
 * getIntervention({ risk, crop, stage }) → {
 *   level:        'safe' | 'warning' | 'critical',
 *   actionKey:    string     // translation key for the headline
 *   actionFallback: string   // English last-resort text
 *   stepKeys:     string[]   // translation keys for each step
 *   stepFallbacks:string[]   // English last-resort per step (same index)
 *   crop, stage              // passed through for observability
 * }
 *
 * Pure. Engine emits ONLY keys + fallbacks — no rendered strings
 * (per spec §6 localization). The UI localizes via
 * renderLocalizedMessage(payload, t).
 */

const LEVEL_BY_RISK = Object.freeze({
  high:     'critical',
  medium:   'warning',
  low:      'safe',
  critical: 'critical', // defensive — accept upstream "critical" too
});

const LOW_SAFE_INTERVENTION = Object.freeze({
  level: 'safe',
  actionKey:        'intervention.safe.action',
  actionFallback:   'No immediate risk',
  stepKeys:         [],
  stepFallbacks:    [],
});

const MEDIUM_WARNING_STEPS = Object.freeze([
  { key: 'intervention.warning.step.check_soil_moisture',
    en:  'Check soil moisture' },
  { key: 'intervention.warning.step.review_today_tasks',
    en:  'Review your tasks for today' },
]);

const HIGH_CRITICAL_STEPS = Object.freeze([
  { key: 'intervention.critical.step.inspect_today',
    en:  'Inspect your farm today' },
  { key: 'intervention.critical.step.check_water_pests',
    en:  'Check for water stress or pests' },
  { key: 'intervention.critical.step.follow_recommended_now',
    en:  'Follow recommended tasks immediately' },
]);

/**
 * Stage-specific guidance override. When the risk is critical
 * AND the stage is stage-sensitive (planting/flowering/harvest),
 * the first step is tailored to that stage.
 */
const CRITICAL_STAGE_FIRST_STEP = Object.freeze({
  planting:  { key: 'intervention.critical.step.stage_planting',
               en:  'Pause planting until conditions improve' },
  flowering: { key: 'intervention.critical.step.stage_flowering',
               en:  'Protect flowering — avoid any spray that could wash off' },
  harvest:   { key: 'intervention.critical.step.stage_harvest',
               en:  'Prioritize harvest protection and storage' },
});

/** getIntervention — main entry. */
function getIntervention({ risk = null, crop = null, stage = null } = {}) {
  const level = LEVEL_BY_RISK[String(risk || '').toLowerCase()] || 'safe';

  if (level === 'safe') {
    return Object.freeze({ ...LOW_SAFE_INTERVENTION, crop: crop || null, stage: stage || null });
  }

  if (level === 'warning') {
    return Object.freeze({
      level: 'warning',
      actionKey:       'intervention.warning.action',
      actionFallback:  'Monitor your farm closely',
      stepKeys:        MEDIUM_WARNING_STEPS.map((s) => s.key),
      stepFallbacks:   MEDIUM_WARNING_STEPS.map((s) => s.en),
      crop:  crop || null,
      stage: stage || null,
    });
  }

  // critical — may be stage-tailored.
  let steps = HIGH_CRITICAL_STEPS;
  const stageKey = String(stage || '').toLowerCase();
  if (CRITICAL_STAGE_FIRST_STEP[stageKey]) {
    // Replace the first step with the stage-specific one.
    steps = [CRITICAL_STAGE_FIRST_STEP[stageKey], ...HIGH_CRITICAL_STEPS.slice(1)];
  }
  return Object.freeze({
    level: 'critical',
    actionKey:      'intervention.critical.action',
    actionFallback: 'Immediate intervention required',
    stepKeys:       steps.map((s) => s.key),
    stepFallbacks:  steps.map((s) => s.en),
    crop:  crop || null,
    stage: stage || null,
  });
}

module.exports = {
  getIntervention,
  _internal: {
    LEVEL_BY_RISK,
    CRITICAL_STAGE_FIRST_STEP,
    HIGH_CRITICAL_STEPS,
    MEDIUM_WARNING_STEPS,
  },
};
