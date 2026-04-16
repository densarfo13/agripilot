/**
 * Momentum Calculator — farmer confidence and progress signals.
 *
 * Produces simple, encouraging signals (spec §7):
 *   - tasksDoneToday
 *   - tasksRemainingToday
 *   - streakDays
 *   - weeklyMomentumState
 *   - momentumTextKey (localized)
 *
 * No gamification. No childish rewards. Just trust and routine.
 */

const STREAK_KEY = 'farroway:activity_streak';

/**
 * Momentum state values — drive the headline on Progress tab.
 */
export const MOMENTUM_STATE = {
  STRONG: 'strong',       // 3+ tasks done today or 3+ day streak
  ON_TRACK: 'on_track',   // 1-2 tasks done today
  GETTING_STARTED: 'getting_started', // 0 tasks done, has pending
  IDLE: 'idle',           // No tasks, no recent activity
};

/**
 * Load streak data from localStorage.
 */
function loadStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? JSON.parse(raw) : { days: 0, lastActiveDate: null };
  } catch {
    return { days: 0, lastActiveDate: null };
  }
}

/**
 * Save streak data to localStorage.
 */
function saveStreak(data) {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

/**
 * Record activity for today (call after task completion).
 * Updates the streak counter.
 */
export function recordActivity() {
  const today = new Date().toISOString().split('T')[0];
  const streak = loadStreak();

  if (streak.lastActiveDate === today) {
    // Already recorded today
    return streak;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (streak.lastActiveDate === yesterday) {
    // Consecutive day — extend streak
    streak.days += 1;
  } else if (streak.lastActiveDate !== today) {
    // Gap — reset streak to 1
    streak.days = 1;
  }

  streak.lastActiveDate = today;
  saveStreak(streak);
  return streak;
}

/**
 * Get current streak (read-only, no side effects).
 * @returns {{ days: number, lastActiveDate: string|null }}
 */
export function getStreak() {
  const streak = loadStreak();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // If last active wasn't today or yesterday, streak is broken
  if (streak.lastActiveDate !== today && streak.lastActiveDate !== yesterday) {
    return { days: 0, lastActiveDate: streak.lastActiveDate };
  }
  return streak;
}

/**
 * Calculate full momentum state.
 *
 * @param {Object} params
 * @param {number} params.completedToday - Tasks completed today
 * @param {number} params.remainingToday - Tasks remaining today
 * @param {number} params.totalTasks - Total task count
 * @param {string|null} params.cropStage - Current crop stage
 * @param {number} params.completionPercent - 0-100 overall completion
 * @returns {Object} Momentum result
 */
export function calculateMomentum({
  completedToday = 0,
  remainingToday = 0,
  totalTasks = 0,
  cropStage = null,
  completionPercent = 0,
}) {
  const streak = getStreak();

  // Determine momentum state
  let state = MOMENTUM_STATE.IDLE;
  let textKey = 'momentum.idle';

  if (completedToday >= 3 || streak.days >= 3) {
    state = MOMENTUM_STATE.STRONG;
    if (streak.days >= 3) {
      textKey = 'momentum.streak';
    } else {
      textKey = 'momentum.strongToday';
    }
  } else if (completedToday >= 1) {
    state = MOMENTUM_STATE.ON_TRACK;
    if (remainingToday === 0) {
      textKey = 'momentum.allDone';
    } else {
      textKey = 'momentum.onTrack';
    }
  } else if (remainingToday > 0 || totalTasks > 0) {
    state = MOMENTUM_STATE.GETTING_STARTED;
    textKey = 'momentum.getStarted';
  } else {
    state = MOMENTUM_STATE.IDLE;
    textKey = 'momentum.idle';
  }

  // Stage-specific encouragement
  let stageEncouragementKey = null;
  if (completionPercent >= 60 && cropStage) {
    stageEncouragementKey = 'momentum.goodProgressForStage';
  }

  return {
    tasksDoneToday: completedToday,
    tasksRemainingToday: remainingToday,
    streakDays: streak.days,
    weeklyMomentumState: state,
    momentumTextKey: textKey,
    stageEncouragementKey,
    completionPercent,
  };
}
