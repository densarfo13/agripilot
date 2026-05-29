/**
 * achievementEngine.js — Phase 11 achievement calculator (pure).
 *
 *   import { computeAchievements }
 *     from 'src/runtime/today/achievementEngine.js';
 *
 * What this is
 * ────────────
 *   Pure function over event counts + streak counts that returns
 *   the unlocked achievements + a small set of "next within reach"
 *   targets the UI can surface as goals.
 *
 *   Six canonical achievements:
 *     first_scan          1+ scan
 *     first_harvest       1+ task with kind 'harvest' completed
 *     thirty_day_streak   daily_usage streak ≥ 30
 *     disease_prevented   1+ scan flagged disease + follow-up done
 *     hundred_tasks       100+ tasks completed total
 *     consistent_scans    7+ days with at least one scan
 */

const RUNTIME_VERSION = 'achievement-engine-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const ACHIEVEMENT = Object.freeze({
  FIRST_SCAN:          'first_scan',
  FIRST_HARVEST:       'first_harvest',
  THIRTY_DAY_STREAK:   'thirty_day_streak',
  DISEASE_PREVENTED:   'disease_prevented',
  HUNDRED_TASKS:       'hundred_tasks',
  CONSISTENT_SCANS:    'consistent_scans',
});

const COPY = Object.freeze({
  [ACHIEVEMENT.FIRST_SCAN]: Object.freeze({
    headlineKey: 'today.achievement.first_scan.headline',
    headlineDefault: 'First Scan',
    icon: '📷',
  }),
  [ACHIEVEMENT.FIRST_HARVEST]: Object.freeze({
    headlineKey: 'today.achievement.first_harvest.headline',
    headlineDefault: 'First Harvest',
    icon: '🌾',
  }),
  [ACHIEVEMENT.THIRTY_DAY_STREAK]: Object.freeze({
    headlineKey: 'today.achievement.thirty_day_streak.headline',
    headlineDefault: '30 Day Streak',
    icon: '🔥',
  }),
  [ACHIEVEMENT.DISEASE_PREVENTED]: Object.freeze({
    headlineKey: 'today.achievement.disease_prevented.headline',
    headlineDefault: 'Disease Prevented',
    icon: '🛡',
  }),
  [ACHIEVEMENT.HUNDRED_TASKS]: Object.freeze({
    headlineKey: 'today.achievement.hundred_tasks.headline',
    headlineDefault: '100 Tasks Completed',
    icon: '🏅',
  }),
  [ACHIEVEMENT.CONSISTENT_SCANS]: Object.freeze({
    headlineKey: 'today.achievement.consistent_scans.headline',
    headlineDefault: 'Consistent Scans',
    icon: '🌱',
  }),
});

const EVALUATORS = Object.freeze({
  [ACHIEVEMENT.FIRST_SCAN]:
    (counts) => (counts.scansTotal || 0) >= 1,
  [ACHIEVEMENT.FIRST_HARVEST]:
    (counts) => (counts.harvestTasksCompleted || 0) >= 1,
  [ACHIEVEMENT.THIRTY_DAY_STREAK]:
    (counts, streaks) => ((streaks && streaks.dailyUsage
                              && streaks.dailyUsage.count) || 0) >= 30,
  [ACHIEVEMENT.DISEASE_PREVENTED]:
    (counts) => (counts.diseaseFollowupsCompleted || 0) >= 1,
  [ACHIEVEMENT.HUNDRED_TASKS]:
    (counts) => (counts.tasksCompletedTotal || 0) >= 100,
  [ACHIEVEMENT.CONSISTENT_SCANS]:
    (counts, streaks) => ((streaks && streaks.scanActivity
                              && streaks.scanActivity.count) || 0) >= 7,
});

const PROGRESS = Object.freeze({
  [ACHIEVEMENT.HUNDRED_TASKS]:
    (counts) => Math.min(1, (counts.tasksCompletedTotal || 0) / 100),
  [ACHIEVEMENT.THIRTY_DAY_STREAK]:
    (counts, streaks) => Math.min(1, ((streaks
        && streaks.dailyUsage && streaks.dailyUsage.count) || 0) / 30),
  [ACHIEVEMENT.CONSISTENT_SCANS]:
    (counts, streaks) => Math.min(1, ((streaks
        && streaks.scanActivity && streaks.scanActivity.count) || 0) / 7),
});

/**
 * @param {{
 *   counts: {
 *     scansTotal?: number,
 *     tasksCompletedTotal?: number,
 *     harvestTasksCompleted?: number,
 *     diseaseFollowupsCompleted?: number,
 *   },
 *   streaks: ReturnType<typeof computeStreaks>,
 * }} input
 */
export function computeAchievements(input) {
  const counts  = (input && _isObj(input.counts))  ? input.counts  : {};
  const streaks = (input && _isObj(input.streaks)) ? input.streaks : null;
  const unlocked = [];
  const locked = [];
  for (const id of Object.values(ACHIEVEMENT)) {
    const ev = EVALUATORS[id];
    const reached = ev ? !!ev(counts, streaks) : false;
    const entry = Object.freeze({
      id,
      headlineKey:     COPY[id].headlineKey,
      headlineDefault: COPY[id].headlineDefault,
      icon:            COPY[id].icon,
      unlocked:        reached,
      progress:        PROGRESS[id]
                         ? Math.round(PROGRESS[id](counts, streaks) * 100) / 100
                         : (reached ? 1 : 0),
    });
    (reached ? unlocked : locked).push(entry);
  }
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    unlocked: Object.freeze(unlocked),
    locked:   Object.freeze(locked),
    totalUnlocked: unlocked.length,
    totalKnown:    Object.values(ACHIEVEMENT).length,
  });
}
