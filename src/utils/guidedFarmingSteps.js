/**
 * Guided Farming Steps — simple step-based workflow for new farmers.
 *
 * Provides a linear 5-step journey that maps to real farm updates:
 *   Step 1: Prepare your land
 *   Step 2: Plant your crop
 *   Step 3: Water regularly
 *   Step 4: Maintain your farm
 *   Step 5: Harvest
 *
 * Each step has:
 *   - key         — i18n translation key prefix
 *   - icon        — emoji (low-literacy)
 *   - updateType  — maps to QuickUpdateFlow activity value
 *   - seasonStage — which season stage this step aligns with
 *
 * Step completion is stored in localStorage (offline-safe, lightweight).
 * No backend persistence needed — steps reset per season.
 */

// ── Step definitions ───────────────────────────────────────

const GUIDED_STEPS = [
  {
    id: 'prepare',
    icon: '🪓',
    updateType: 'progress',
    seasonStage: 'planting',
  },
  {
    id: 'plant',
    icon: '🌱',
    updateType: 'progress',
    seasonStage: 'planting',
  },
  {
    id: 'water',
    icon: '💧',
    updateType: 'progress',
    seasonStage: 'growing',
  },
  {
    id: 'maintain',
    icon: '🛡️',
    updateType: 'spray',
    seasonStage: 'growing',
  },
  {
    id: 'harvest',
    icon: '🌾',
    updateType: 'harvest',
    seasonStage: 'harvest',
  },
];

const STORAGE_KEY = 'farroway:guided_steps';

// ── Step state management (localStorage) ───────────────────

/**
 * Get completed step IDs for a given season.
 * @param {string|null} seasonId
 * @returns {string[]} Array of completed step IDs
 */
export function getCompletedSteps(seasonId) {
  if (!seasonId) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return data[seasonId] || [];
  } catch {
    return [];
  }
}

/**
 * Mark a step as complete for a season.
 * @param {string} seasonId
 * @param {string} stepId
 */
export function markStepComplete(seasonId, stepId) {
  if (!seasonId || !stepId) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const steps = data[seasonId] || [];
    if (!steps.includes(stepId)) {
      steps.push(stepId);
    }
    data[seasonId] = steps;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* localStorage full — ignore */ }
}

/**
 * Reset all guided steps for a season.
 * @param {string} seasonId
 */
export function resetSteps(seasonId) {
  if (!seasonId) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    delete data[seasonId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

// ── Step derivation ────────────────────────────────────────

/**
 * Get all guided steps with their completion status.
 * @param {string|null} seasonId
 * @returns {Array<{ id, icon, updateType, seasonStage, completed, stepNumber }>}
 */
export function getGuidedSteps(seasonId) {
  const completed = getCompletedSteps(seasonId);
  return GUIDED_STEPS.map((step, i) => ({
    ...step,
    stepNumber: i + 1,
    completed: completed.includes(step.id),
  }));
}

/**
 * Get the current (first incomplete) step.
 * @param {string|null} seasonId
 * @returns {Object|null} Step object or null if all complete
 */
export function getCurrentStep(seasonId) {
  const steps = getGuidedSteps(seasonId);
  return steps.find(s => !s.completed) || null;
}

/**
 * Get progress as a fraction: { done, total, percent }.
 * @param {string|null} seasonId
 * @returns {{ done: number, total: number, percent: number }}
 */
export function getGuidedProgress(seasonId) {
  const steps = getGuidedSteps(seasonId);
  const done = steps.filter(s => s.completed).length;
  const total = steps.length;
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

/**
 * Whether guided mode is active for this profile.
 * @param {Object|null} profile
 * @returns {boolean}
 */
export function isGuidedMode(profile) {
  return profile?.experienceLevel === 'new';
}

// ── Exports ────────────────────────────────────────────────

export { GUIDED_STEPS };
