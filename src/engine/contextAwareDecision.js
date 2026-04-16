/**
 * Context-Aware Task Decision — spec §1.
 *
 * Wraps the existing decision engine + autopilot rules to produce
 * a context-enriched decision that explains WHY this task matters TODAY.
 *
 * This is the primary entry point for the upgraded system.
 * Returns one main task with reasoning, timing, urgency, and confidence.
 */
import { resolveDecision } from './decisionEngine.js';
import { getAutopilotEnrichment } from './autopilot/index.js';
import { resolveUrgency } from './urgencyResolver.js';
import { getTaskEconomicTip } from './economicsSignal.js';

/**
 * Get a fully context-aware task decision.
 *
 * @param {Object} params
 * @param {Object|null} params.farm - Farm profile
 * @param {string} params.crop - Crop type
 * @param {string} params.cropStage - Current crop stage
 * @param {Object|null} params.weather - Raw weather data
 * @param {Object|null} params.primaryTask - Highest-priority task
 * @param {number} params.taskCount - Pending task count
 * @param {number} params.completedCount - Completed today
 * @param {boolean} params.setupComplete - Profile setup done?
 * @param {boolean} params.isOnline - Network status
 * @param {Function} params.t - Translation function
 * @returns {Object} ContextAwareDecision
 */
export function getContextAwareTaskDecision({
  farm,
  crop,
  cropStage,
  weather,
  primaryTask,
  taskCount = 0,
  completedCount = 0,
  setupComplete = false,
  isOnline = true,
  t,
}) {
  // 1. Run the base decision engine (existing priority cascade)
  const decision = resolveDecision({
    profile: farm,
    setupComplete,
    primaryTask,
    taskCount,
    completedCount,
    weather,
    isOnline,
  }, t);

  const action = decision.primaryAction;
  const effectiveTask = action?.task || primaryTask;

  // 2. Get autopilot enrichment (why/risk/timing/next)
  const enrichment = effectiveTask
    ? getAutopilotEnrichment({
        task: effectiveTask,
        cropStage,
        weather,
        priority: action?.priority || effectiveTask?.priority,
      })
    : null;

  // 3. Resolve urgency centrally
  const urgency = resolveUrgency({
    actionKey: action?.key || 'daily_task',
    priority: action?.priority || 'medium',
    severity: enrichment?.severity || 'normal',
    weatherGuidance: decision.weatherGuidance,
    autopilotSeverity: enrichment?.severity || null,
    cropStage,
    isWeatherOverride: !!action?.weatherOverride,
  });

  // 4. Economics tip (if adds value)
  const economicTipKey = effectiveTask
    ? getTaskEconomicTip(effectiveTask.title, effectiveTask.actionType)
    : null;

  // 5. Confidence level
  const confidenceLevel = enrichment?.confidence || 'medium';

  return {
    // The primary task (one only)
    primaryTask: effectiveTask,
    primaryAction: action,

    // Context reasoning (all translation keys)
    whyTextKey: enrichment?.whyKey || null,
    riskTextKey: enrichment?.riskKey || null,
    timingTextKey: enrichment?.timingKey || null,

    // Urgency
    urgencyLevel: urgency,

    // Next step
    nextTaskType: enrichment?.nextTaskType || null,

    // Confidence
    confidenceLevel,

    // Autopilot metadata
    autopilotRuleId: enrichment?.ruleId || null,
    weatherReason: enrichment?.weatherReason || null,

    // Economics
    economicTipKey,

    // Full decision (passthrough for consumers that need it)
    decision,
  };
}
