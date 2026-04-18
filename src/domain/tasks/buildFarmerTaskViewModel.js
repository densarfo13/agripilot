/**
 * Farmer Task View Model Builder — the SINGLE source of truth for task rendering.
 *
 * Pipeline order:
 *   1. Weather override (already applied by decision engine before we get here)
 *   2. Severity derivation
 *   3. Text resolution (localized)
 *   4. Style resolution
 *   5. View model assembly
 *
 * ALL farmer-facing UI renders from the returned view model.
 * No component should access raw task fields or compute severity/style independently.
 */
import { getTaskSeverity } from './getTaskSeverity.js';
import { getTaskStateStyle } from './taskStateStyles.js';
import { resolveFarmerText } from './farmerTextResolver.js';
import { getTaskIcon, getTaskIconBg, getTaskVoiceKey } from '../../lib/taskPresentation.js';
import { assertViewModel, assertAllTextLocalized, assertNoWeatherConflict, assertUrgencyConsistency } from './devAssertions.js';
import { getAutopilotEnrichment } from '../../engine/autopilot/index.js';
import { getNextTextKey, getSuccessTextKey } from '../../engine/autopilot/textKeys.js';
import { resolveUrgency, getUrgencyStyle } from '../../engine/urgencyResolver.js';
import { getTaskEconomicTip } from '../../engine/economicsSignal.js';
import { getTaskTimingContext } from '../../engine/taskTimingEngine.js';

/**
 * Schema version — bump to invalidate cached view models.
 * Any stored/cached task render data with a lower version should be discarded.
 */
export const TASK_VIEWMODEL_SCHEMA_VERSION = 4;

/**
 * Build a normalized, render-ready view model for a farmer task.
 *
 * @param {Object} params
 * @param {Object|null} params.task - Raw server task object (or null for non-task actions)
 * @param {Object|null} params.action - Decision engine action (primaryAction from resolveDecision)
 * @param {Object|null} params.weatherGuidance - From getWeatherGuidance()
 * @param {string} params.language - Current language code (en, fr, sw, ha, tw)
 * @param {Function} params.t - i18n translation function
 * @param {'simple'|'standard'} params.mode - Rendering mode
 * @param {Object|null} params.autopilotEnrichment - Pre-computed enrichment (optional, auto-computed if absent)
 * @param {string} params.cropStage - Current crop stage (for autopilot)
 * @param {Object|null} params.weather - Raw weather data (for autopilot)
 * @returns {Object} TaskViewModel
 */
export function buildFarmerTaskViewModel({ task, action, weatherGuidance, language, t, mode, autopilotEnrichment, cropStage, weather, rainfall }) {
  // ─── 1. Determine effective priority and override status ───
  const priority = action?.priority || task?.priority || 'medium';
  const isWeatherOverride = !!(action?.weatherOverride);
  const actionKey = action?.key || 'daily_task';

  // ─── 2. Severity (from priority + weather) ────────────────
  const severity = getTaskSeverity({
    priority,
    weatherGuidance,
    isWeatherOverride,
  });

  // ─── 3. State style (from severity only) ──────────────────
  const stateStyle = getTaskStateStyle(severity);

  // ─── 4. Text resolution (localized, centralized) ──────────
  const text = resolveFarmerText({
    task: action?.task || task,
    action,
    lang: language,
    t,
  });

  // ─── 5. Icon / visual ─────────────────────────────────────
  const effectiveTask = action?.task || task;
  const icon = action?.icon || getTaskIcon(effectiveTask);
  const iconBg = action?.iconBg || getTaskIconBg(effectiveTask);
  const voiceKey = effectiveTask ? getTaskVoiceKey(effectiveTask) : null;

  // ─── 5b. Autopilot enrichment (why / risk / next) ────────
  const enrichment = autopilotEnrichment || (effectiveTask
    ? getAutopilotEnrichment({ task: effectiveTask, cropStage, weather, priority })
    : null);

  const whyText = enrichment?.whyKey ? t(enrichment.whyKey) : null;
  const riskText = enrichment?.riskKey ? t(enrichment.riskKey) : null;

  // Smart timing — weather-aware, falls back to rule's static timingKey
  const timingContext = enrichment
    ? getTaskTimingContext({ enrichment, rainfall, t, language })
    : { text: null, kind: 'generic', dayIndex: null };
  const timingText = timingContext.text;
  const timingKind = timingContext.kind;
  const timingDayIndex = timingContext.dayIndex;
  const nextTextKey = enrichment ? getNextTextKey(enrichment.nextTaskType) : null;
  const nextText = nextTextKey ? t(nextTextKey) : null;
  const successKey = enrichment ? getSuccessTextKey(enrichment.ruleId) : 'success.general';
  const successText = t(successKey);

  // ─── 5c. Urgency (centralized, spec §3) ──────────────────
  const urgency = resolveUrgency({
    actionKey,
    priority,
    severity,
    weatherGuidance,
    autopilotSeverity: enrichment?.severity || null,
    cropStage,
    isWeatherOverride: isWeatherOverride,
  });
  const urgencyStyle = getUrgencyStyle(urgency);

  // ─── 5d. Economics tip (only if it adds value) ────────────
  const economicTipKey = effectiveTask
    ? getTaskEconomicTip(effectiveTask.title, effectiveTask.actionType)
    : null;
  const economicTip = economicTipKey ? t(economicTipKey) : null;

  // ─── 6. Assemble view model ───────────────────────────────
  const viewModel = {
    // Identity
    id: effectiveTask?.id || actionKey,
    type: actionKey,
    taskId: effectiveTask?.id || null,

    // Display text (from centralized resolver)
    title: text.title,
    descriptionShort: text.descriptionShort,
    ctaLabel: text.ctaLabel,
    voiceText: text.voiceText,
    voiceKey,
    supportingLine: text.supportingLine,

    // Visual
    icon,
    iconBg,
    severity,
    stateStyle,

    // State
    isWeatherOverridden: isWeatherOverride,
    isAlert: !!(action?.isAlert),
    priority,
    actionKey,

    // Stage info (passthrough for stage actions)
    stageInfo: action?.stageInfo || null,

    // Autopilot intelligence
    whyText,                              // "Dry grain now to prevent mold."
    riskText,                             // "Risk: harvest may spoil if left damp."
    timingText,                           // "Before rain on Thu." (weather-aware)
    timingKind,                           // 'today' | 'this_week' | 'rain_deadline' | 'dry_window' | 'generic'
    timingDayIndex,                       // 0..6 when a specific day drives the phrase
    nextText,                             // "Next: Sort and clean your harvest."
    successText,                          // "Grain is safer now."
    nextTaskType: enrichment?.nextTaskType || null,
    autopilotRuleId: enrichment?.ruleId || null,
    autopilotConfidence: enrichment?.confidence || null,

    // Urgency (centralized, spec §3)
    urgency,                              // 'critical' | 'today' | 'this_week' | 'optional'
    urgencyStyle,                         // { bg, border, text, accent, labelKey, dot }

    // Economics (simple signal, spec §6)
    economicTip,                          // "Drying protects sale quality." or null

    // Mode hint (layout only, not data)
    mode,

    // Schema version for cache invalidation
    _schemaVersion: TASK_VIEWMODEL_SCHEMA_VERSION,
  };

  // ─── 7. Dev assertions ────────────────────────────────────
  assertViewModel(viewModel, language);
  assertAllTextLocalized(viewModel, language);
  assertNoWeatherConflict(viewModel, weather);
  assertUrgencyConsistency(viewModel);

  return viewModel;
}

/**
 * Build view models for a list of server tasks (AllTasksPage, FarmTasksCard).
 *
 * @param {Object} params
 * @param {Array} params.tasks - Array of raw server task objects
 * @param {Object|null} params.weatherGuidance
 * @param {string} params.language
 * @param {Function} params.t
 * @param {'simple'|'standard'} params.mode
 * @returns {Array<Object>} Array of TaskViewModels
 */
export function buildTaskListViewModels({ tasks, weatherGuidance, language, t, mode, cropStage, weather, rainfall }) {
  return (tasks || []).map(task => buildFarmerTaskViewModel({
    task,
    action: null,
    weatherGuidance,
    language,
    t,
    mode: mode || 'standard',
    cropStage,
    weather,
    rainfall,
  }));
}
