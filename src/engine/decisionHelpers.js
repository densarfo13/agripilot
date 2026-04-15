/**
 * Decision Helpers — pure functions for evaluating farm conditions.
 *
 * Each helper answers ONE question about the farm's state.
 * No side effects, no API calls, no React — just data in, boolean/number out.
 */
import { resolveStage, CROP_STAGES } from '../utils/cropStages.js';

/** Days since a date, or null if date is falsy/invalid */
export function daysSince(dateStr) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86400000);
}

/** Is the farm profile considered complete? (score-based) */
export function isProfileComplete(profile) {
  if (!profile) return false;
  let score = 0;
  if (profile.farmerName) score += 15;
  if (profile.farmName) score += 10;
  if (profile.country) score += 15;
  if (profile.location) score += 15;
  if (profile.size && profile.size > 0) score += 15;
  if (profile.cropType) score += 15;
  if (profile.gpsLat != null) score += 7.5;
  if (profile.gpsLng != null) score += 7.5;
  return Math.round(score) >= 75;
}

/** Get the resolved crop stage (handles legacy values) */
export function getStage(profile) {
  if (!profile) return 'planning';
  return resolveStage(profile.cropStage || profile.stage);
}

/** Has the farmer ever explicitly set a crop stage? */
export function isStageSet(profile) {
  return getStage(profile) !== 'planning';
}

/** Is the crop stage outdated (not updated in N days)? */
export function isStageOutdated(profile, thresholdDays = 14) {
  const date = profile?.plantedAt || profile?.updatedAt;
  const days = daysSince(date);
  return days !== null && days > thresholdDays;
}

/** Days since stage was last updated */
export function stageDaysAgo(profile) {
  return daysSince(profile?.plantedAt || profile?.updatedAt);
}

/** Is this task pest-related? (keyword match on title) */
export function isPestTask(task) {
  if (!task?.title) return false;
  const t = task.title.toLowerCase();
  return t.includes('pest') || t.includes('disease') || t.includes('insect')
    || t.includes('bug') || t.includes('blight') || t.includes('worm')
    || t.includes('fungus') || t.includes('rot');
}

/** Is this task a high-priority alert? */
export function isAlertTask(task) {
  return task?.priority === 'high';
}

/** Is farm activity stale? (no profile update in N days) */
export function isFarmStale(profile, thresholdDays = 30) {
  const days = daysSince(profile?.updatedAt);
  return days !== null && days > thresholdDays;
}

/** Does the farm need a check-in? (7-30 day gap — softer than stale) */
export function needsCheckIn(profile) {
  const days = daysSince(profile?.updatedAt);
  return days !== null && days >= 7 && days <= 30;
}

/** Days since last farm update */
export function daysSinceUpdate(profile) {
  return daysSince(profile?.updatedAt);
}

/** Get the stage index in lifecycle order (0-8) */
export function stageIndex(profile) {
  const stage = getStage(profile);
  const idx = CROP_STAGES.indexOf(stage);
  return idx >= 0 ? idx : 0;
}

/** Calculate overall progress as percentage (0-100) */
export function farmProgress(profile, taskCount, completedCount) {
  if (!profile) return 0;

  let score = 0;
  const total = 5; // 5 dimensions

  // 1. Profile completeness
  if (isProfileComplete(profile)) score += 1;

  // 2. Stage set
  if (isStageSet(profile)) score += 1;

  // 3. Stage freshness (only counts if stage is set)
  if (isStageSet(profile) && !isStageOutdated(profile)) score += 1;

  // 4. Task completion rate
  const totalTasks = (taskCount || 0) + (completedCount || 0);
  if (totalTasks > 0 && completedCount / totalTasks >= 0.5) score += 1;
  else if (totalTasks === 0) score += 0.5; // no tasks = neutral

  // 5. Farm activity freshness
  if (!isFarmStale(profile)) score += 1;

  return Math.round((score / total) * 100);
}
