/**
 * Autopilot Decision Engine — picks ONE main task and enriches it.
 *
 * Pure function. No React. No side effects.
 *
 * Input:  farm context (crop, stage, weather, tasks, activity)
 * Output: enriched decision with why/risk/next for the primary task
 *
 * Works alongside the existing decision engine:
 *   - Decision engine picks the task via priority cascade
 *   - Autopilot enriches that task with why/risk/next intelligence
 */
import { AUTOPILOT_RULES, buildRuleContext } from './rules.js';

/**
 * Default enrichment when no rule matches.
 * Provides safe fallback — farmer still sees the task, just without why/risk.
 */
const DEFAULT_ENRICHMENT = {
  ruleId: null,
  whyKey: null,
  riskKey: null,
  timingKey: null,
  nextTaskType: null,
  severity: 'normal',
  confidence: 'medium',
  weatherReason: null,
  urgency: null,
};

/**
 * Get autopilot enrichment for a primary task.
 *
 * @param {Object} params
 * @param {Object|null} params.task - The primary task (from decision engine or loop)
 * @param {string} params.cropStage - Current crop stage
 * @param {Object|null} params.weather - Raw weather data
 * @param {string} params.priority - Task priority
 * @returns {Object} AutopilotEnrichment
 */
export function getAutopilotEnrichment({ task, cropStage, weather, priority }) {
  if (!task) return DEFAULT_ENRICHMENT;

  const ctx = buildRuleContext({ task, cropStage, weather, priority });

  // First matching rule wins
  for (const rule of AUTOPILOT_RULES) {
    if (rule.match(ctx)) {
      return {
        ruleId: rule.id,
        whyKey: rule.result.whyKey,
        riskKey: rule.result.riskKey,
        timingKey: rule.result.timingKey || null,
        nextTaskType: rule.result.nextTaskType,
        severity: rule.result.severity || 'normal',
        confidence: rule.result.confidence || 'medium',
        weatherReason: rule.result.weatherReason || null,
        urgency: rule.result.urgency || null,
      };
    }
  }

  return DEFAULT_ENRICHMENT;
}

/**
 * Full autopilot decision — the primary entry point.
 *
 * Takes farm context and returns a complete autopilot output model
 * that the Home screen and Tasks screen consume.
 *
 * @param {Object} params
 * @param {Object|null} params.farm - Farm profile
 * @param {string} params.crop - Crop type
 * @param {string} params.cropStage - Current crop stage
 * @param {Object|null} params.weather - Raw weather data
 * @param {Object|null} params.primaryTask - The current task (already picked by decision engine)
 * @param {Array} params.pendingTasks - All pending tasks
 * @param {number} params.completedCount - Completed tasks today
 * @returns {Object} AutopilotDecision
 */
export function getAutopilotDecision({
  farm,
  crop,
  cropStage,
  weather,
  primaryTask,
  pendingTasks = [],
  completedCount = 0,
}) {
  // Enrich primary task
  const enrichment = getAutopilotEnrichment({
    task: primaryTask,
    cropStage,
    weather,
    priority: primaryTask?.priority,
  });

  // Resolve next task from pending list based on enrichment hint
  const nextTask = resolveNextTask(enrichment.nextTaskType, pendingTasks, primaryTask);

  // Enrich next task too (for chaining display)
  const nextEnrichment = nextTask
    ? getAutopilotEnrichment({ task: nextTask, cropStage, weather, priority: nextTask.priority })
    : null;

  return {
    // Primary task enrichment
    ...enrichment,

    // The primary task itself (passthrough)
    primaryTask,

    // Next task after completion
    nextTask,
    nextEnrichment,

    // Context
    crop: crop || '',
    cropStage: cropStage || '',
    totalPending: pendingTasks.length,
    completedCount,
  };
}

/**
 * Resolve the next task from pending tasks.
 *
 * Strategy:
 *   1. If enrichment suggests a nextTaskType, find a matching task
 *   2. Otherwise, pick the next highest-priority task
 */
function resolveNextTask(nextTaskType, pendingTasks, currentTask) {
  if (!pendingTasks || pendingTasks.length === 0) return null;

  const others = pendingTasks.filter((t) => t.id !== currentTask?.id);
  if (others.length === 0) return null;

  // Try to match the suggested next type
  if (nextTaskType) {
    const keywords = nextTaskType.replace(/_/g, ' ').split(' ');
    const match = others.find((t) => {
      const haystack = `${t.id || ''} ${t.title || ''} ${t.actionType || ''}`.toLowerCase();
      return keywords.some((kw) => haystack.includes(kw));
    });
    if (match) return match;
  }

  // Fallback: next by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...others].sort(
    (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  );

  return sorted[0] || null;
}
