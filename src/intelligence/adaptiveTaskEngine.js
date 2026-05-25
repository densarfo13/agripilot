/**
 * adaptiveTaskEngine.js — Phase 2 architecture interface.
 *
 * STATUS: STUB. Thin façade on top of the existing
 * src/lib/tasks/taskEngine.js. Returns the same task shape but
 * extends the input contract to include the additional adaptation
 * signals the product spec calls for (last completed task,
 * farm/garden mode, region, regional season). NOT IMPORTED yet —
 * existing call sites continue to use the existing taskEngine
 * directly. Wire site-by-site when a consumer needs the extended
 * signals.
 *
 * Why a stub rather than refactoring the existing engine:
 *   The existing src/lib/tasks/taskEngine.js is used by many
 *   surfaces with stable expectations. Adding new behaviour to it
 *   would risk regressions in unrelated consumers. The stub
 *   pattern lets new product surfaces opt in to the extended
 *   contract while the legacy entrypoint stays untouched.
 *
 * Adaptation signals (used in addition to crop+stage+weather that
 * the legacy engine already considers):
 *   • lastCompletedTaskAt   — avoid re-suggesting a just-done task
 *   • mode: 'farm' | 'garden' — different defaults
 *   • region                 — for region-specific task templates
 *   • regionalSeason         — wet/dry/harmattan/monsoon overlays
 *
 * Output shape — identical to the legacy engine's output so the
 * wiring PR can do a one-line swap at call sites:
 *
 *   {
 *     primaryTask:    { id, key, titleKey, whyKey, priority, stage, reasons },
 *     secondaryTasks: Task[],
 *     why:            { key, severity } | null,
 *   }
 */

/**
 * @typedef {object} AdaptiveTaskArgs
 * @property {object} [farm]
 * @property {string} [crop]
 * @property {string} [stage]
 * @property {object} [weather]
 * @property {object} [location]
 * @property {object[]} [completions]
 * @property {number} [lastCompletedTaskAt]
 * @property {'farm'|'garden'} [mode]
 * @property {string} [region]
 * @property {string} [regionalSeason]
 */

/**
 * @param {AdaptiveTaskArgs} input
 */
export async function buildAdaptiveTaskPlan(input = {}) {
  // Delegate to the existing engine when wired. Lazy import so this
  // stub costs nothing in the bundle today.
  // Replace this branch with:
  //
  //   const { default: generateTasks } = await import('../lib/tasks/taskEngine.js');
  //   const base = generateTasks({ farm, crop, stage, weather, location, completions });
  //   return _applyAdaptationLayer(base, {
  //     lastCompletedTaskAt, mode, region, regionalSeason,
  //   });
  //
  // Until then we return a deterministic empty plan so callers can
  // start coding against the shape.
  return Object.freeze({
    primaryTask: null,
    secondaryTasks: [],
    why: null,
    adaptedFrom: 'stub',
    _input: input,
  });
}

export const ADAPTIVE_TASK_ENGINE_VERSION = '0.1.0-stub';
