/**
 * Dev Assertions — catch regressions in development mode only.
 *
 * These fire console.warn/error for:
 *   - Missing translation keys
 *   - Raw English text leaking into non-English rendering
 *   - Severity/style mismatches
 *   - View model schema violations
 *
 * Production builds should tree-shake these via NODE_ENV checks.
 */

const IS_DEV = typeof process !== 'undefined'
  ? process.env.NODE_ENV !== 'production'
  : (typeof import.meta !== 'undefined' && import.meta.env?.DEV);

// Known English-only patterns that indicate raw server text leaked through
const ENGLISH_PATTERNS = [
  /^[A-Z][a-z]+ (your|the|and|for|to|on|in|with|from|at) /,
  /spread .* on clean/i,
  /prepare .* for (storage|planting|harvest)/i,
];

/**
 * Assert that a view model is well-formed and localized.
 * Only runs in development mode.
 *
 * @param {Object} vm - TaskViewModel
 * @param {string} lang - Current language code
 */
export function assertViewModel(vm, lang) {
  if (!IS_DEV) return;

  // Title must exist
  if (!vm.title) {
    console.warn(`[TaskVM] Missing title for task "${vm.id}" (${vm.type})`);
  }

  // Severity must be valid
  if (!['normal', 'caution', 'urgent'].includes(vm.severity)) {
    console.error(`[TaskVM] Invalid severity "${vm.severity}" for task "${vm.id}"`);
  }

  // stateStyle must exist and match severity
  if (!vm.stateStyle) {
    console.error(`[TaskVM] Missing stateStyle for task "${vm.id}"`);
  }

  // Non-English: check for English text leakage
  if (lang && lang !== 'en' && vm.title) {
    for (const pattern of ENGLISH_PATTERNS) {
      if (pattern.test(vm.title)) {
        console.warn(
          `[TaskVM] Possible English leakage in "${lang}" for task "${vm.id}": "${vm.title}"`
        );
        break;
      }
    }
  }

  // Severity vs style consistency
  if (vm.severity === 'normal' && vm.stateStyle?.accentColor === '#EF4444') {
    console.error(`[TaskVM] Severity "normal" cannot use red accent. Task: "${vm.id}"`);
  }
  if (vm.severity === 'caution' && vm.stateStyle?.accentColor === '#EF4444') {
    console.error(`[TaskVM] Severity "caution" should use amber, not red. Task: "${vm.id}"`);
  }
}

/**
 * Assert that a component received a view model, not a raw task.
 * Call at the top of TaskCard render.
 *
 * @param {Object} props - Component props
 * @param {string} componentName - For diagnostic messages
 */
export function assertIsViewModel(props, componentName) {
  if (!IS_DEV) return;

  if (!props) return;

  // View models have _schemaVersion; raw tasks don't
  if (props.viewModel && !props.viewModel._schemaVersion) {
    console.error(
      `[${componentName}] Received raw task object instead of TaskViewModel. ` +
      `Missing _schemaVersion. Task: "${props.viewModel?.id || 'unknown'}"`
    );
  }
}

/**
 * Assert that a translation key resolved to actual text (not key echo-back).
 *
 * @param {string} key - The translation key
 * @param {string} resolved - The resolved text
 * @param {string} lang - Current language code
 */
export function assertTranslation(key, resolved, lang) {
  if (!IS_DEV) return;

  if (resolved === key) {
    console.warn(`[i18n] Missing translation key: "${key}" for lang "${lang}"`);
  }
}

/**
 * Assert that a weather override actually changed the task.
 *
 * @param {Object} beforeAction - Action before weather override
 * @param {Object} afterAction - Action after weather override
 * @param {Object|null} weatherGuidance
 */
export function assertWeatherOverrideConsistency(beforeAction, afterAction, weatherGuidance) {
  if (!IS_DEV) return;
  if (!weatherGuidance || weatherGuidance.status === 'safe') return;

  // If weather says override should happen but task didn't change
  if (afterAction?.weatherOverride && afterAction.key === beforeAction?.key) {
    console.warn(
      `[WeatherOverride] Task marked as overridden but key unchanged: "${afterAction.key}". ` +
      `Weather: ${weatherGuidance.status}/${weatherGuidance.riskLevel}`
    );
  }
}

/**
 * Assert that a weather conflict is resolved before render.
 * Rain + drying, wind + spraying, etc. should never coexist on screen.
 *
 * @param {Object} vm - TaskViewModel
 * @param {Object|null} weather - Current weather
 */
export function assertNoWeatherConflict(vm, weather) {
  if (!IS_DEV || !vm || !weather) return;

  const titleLower = (vm.title || '').toLowerCase();
  const taskType = (vm.type || '').toLowerCase();

  // Rain + drying conflict
  if ((weather.rainingNow || weather.rainTodayLikely) &&
      (titleLower.includes('dry') || taskType.includes('dry'))) {
    console.error(
      `[WeatherConflict] Rain active but task is drying: "${vm.title}" (${vm.id}). ` +
      `Weather override should have replaced this task.`
    );
  }

  // Wind + spraying conflict
  if (weather.isWindy &&
      (titleLower.includes('spray') || taskType.includes('spray'))) {
    console.error(
      `[WeatherConflict] High wind but task is spraying: "${vm.title}" (${vm.id}). ` +
      `Weather override should have delayed this task.`
    );
  }
}

/**
 * Assert that a cached view model has a valid schema version.
 *
 * @param {Object} cached - Cached view model
 * @param {number} currentVersion - Current schema version
 */
export function assertCachedSchema(cached, currentVersion) {
  if (!IS_DEV || !cached) return;

  if (cached._schemaVersion && cached._schemaVersion < currentVersion) {
    console.warn(
      `[TaskVM] Stale cached view model detected (v${cached._schemaVersion} < v${currentVersion}). ` +
      `Task "${cached.id}" should be rebuilt.`
    );
  }
}

/**
 * Assert that all text fields in a view model are properly localized (not raw English in non-English mode).
 *
 * @param {Object} vm - TaskViewModel
 * @param {string} lang - Current language
 */
export function assertAllTextLocalized(vm, lang) {
  if (!IS_DEV || !vm || lang === 'en') return;

  const fields = ['title', 'whyText', 'riskText', 'nextText', 'successText', 'ctaLabel', 'timingText', 'economicTip'];
  for (const field of fields) {
    const val = vm[field];
    if (!val) continue;
    for (const pattern of ENGLISH_PATTERNS) {
      if (pattern.test(val)) {
        console.warn(
          `[TaskVM] English leakage in "${lang}" field "${field}": "${val}" (task "${vm.id}")`
        );
        break;
      }
    }
  }
}

/**
 * Assert urgency/style consistency (spec §3).
 * Urgency level must have a matching style, and critical tasks must have urgency set.
 *
 * @param {Object} vm - TaskViewModel
 */
export function assertUrgencyConsistency(vm) {
  if (!IS_DEV || !vm) return;

  const validUrgencies = ['critical', 'today', 'this_week', 'optional'];
  if (vm.urgency && !validUrgencies.includes(vm.urgency)) {
    console.error(
      `[TaskVM] Invalid urgency "${vm.urgency}" for task "${vm.id}". ` +
      `Expected one of: ${validUrgencies.join(', ')}`
    );
  }

  if (vm.urgency && !vm.urgencyStyle) {
    console.error(
      `[TaskVM] Urgency "${vm.urgency}" set but urgencyStyle is missing for task "${vm.id}"`
    );
  }

  if (vm.severity === 'urgent' && (!vm.urgency || vm.urgency === 'optional')) {
    console.warn(
      `[TaskVM] Severity "urgent" but urgency is "${vm.urgency || 'null'}" for task "${vm.id}". ` +
      `Expected "critical" or "today".`
    );
  }
}

/**
 * Assert completion state is well-formed (spec §5).
 *
 * @param {Object} cs - CompletionState from buildCompletionState
 */
export function assertCompletionState(cs) {
  if (!IS_DEV || !cs) return;

  if (!cs.successTitleKey) {
    console.error('[CompletionState] Missing successTitleKey');
  }
  if (!cs.successOutcomeKey) {
    console.error('[CompletionState] Missing successOutcomeKey');
  }
  if (cs.hasNext && !cs.nextTask) {
    console.warn('[CompletionState] hasNext=true but nextTask is null');
  }
  if (cs.followUp && (!cs.followUp.questionKey || !cs.followUp.options?.length)) {
    console.error('[CompletionState] followUp present but malformed (missing questionKey or options)');
  }
}
