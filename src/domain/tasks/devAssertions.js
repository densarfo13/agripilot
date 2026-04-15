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
