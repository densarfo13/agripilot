/**
 * Dashboard mode helper — determines which dashboard layout to show
 * based on the farmer's experience level.
 *
 * - "new" farmers → beginner-first layout (guided steps, setup prompts, simple actions)
 * - "experienced" farmers → operations-first layout (analytics, tasks, weather, season data)
 * - null/unknown → defaults to beginner (safe fallback for incomplete profiles)
 */

/**
 * @param {object|null} profile — FarmProfile from ProfileContext
 * @returns {'beginner' | 'operations'}
 */
export function getDashboardMode(profile) {
  if (!profile) return 'beginner';
  if (profile.experienceLevel === 'experienced') return 'operations';
  return 'beginner';
}

/**
 * @param {object|null} profile
 * @returns {boolean}
 */
export function isBeginnerMode(profile) {
  return getDashboardMode(profile) === 'beginner';
}

/**
 * @param {object|null} profile
 * @returns {boolean}
 */
export function isOperationsMode(profile) {
  return getDashboardMode(profile) === 'operations';
}
