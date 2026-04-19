/**
 * getCropStage({ plantedDate, progressPercent, status,
 *                cropDurationWeeks }) → { stage, label, progress }
 *
 * Derives a realistic stage from a crop cycle's dates + progress so
 * the UI shows the farmer something truthful instead of a
 * hand-picked value. If the backend already supplied a lifecycle
 * status it always wins (reviewers edit that field manually and
 * their choice is authoritative).
 *
 * Stage progression:
 *   planned → land_preparation → planting → early_growth →
 *   active_growth → flowering → harvest_ready → harvested
 *
 * Fraction thresholds (percentage of total duration):
 *   <5%    land_preparation
 *   5–15%  planting
 *   15–40% early_growth
 *   40–65% active_growth
 *   65–85% flowering
 *   85–100% harvest_ready
 *   >100%  harvested
 */

export const STAGE_ORDER = Object.freeze([
  'planned', 'land_preparation', 'planting',
  'early_growth', 'active_growth', 'flowering',
  'harvest_ready', 'harvested',
]);

const SERVER_TO_UI = Object.freeze({
  planned: 'planned',
  planting: 'planting',
  growing: 'active_growth',
  flowering: 'flowering',
  harvest_ready: 'harvest_ready',
  harvested: 'harvested',
  delayed: 'active_growth',
  failed: 'harvested',
});

export function getCropStage({
  plantedDate, progressPercent, status, cropDurationWeeks, now = new Date(),
} = {}) {
  // Server's lifecycle status wins when supplied.
  if (status && SERVER_TO_UI[status]) {
    const stage = SERVER_TO_UI[status];
    return { stage, label: stageLabel(stage), progress: clampProgress(progressPercent) };
  }

  if (!plantedDate || !Number.isFinite(cropDurationWeeks) || cropDurationWeeks <= 0) {
    return { stage: 'planned', label: stageLabel('planned'), progress: 0 };
  }

  const planted = new Date(plantedDate);
  if (Number.isNaN(planted.getTime())) {
    return { stage: 'planned', label: stageLabel('planned'), progress: 0 };
  }

  const daysSince = Math.max(0, Math.floor((now.getTime() - planted.getTime()) / 86_400_000));
  const totalDays = cropDurationWeeks * 7;
  const fraction = daysSince / totalDays;

  let stage;
  if (fraction < 0.05) stage = 'land_preparation';
  else if (fraction < 0.15) stage = 'planting';
  else if (fraction < 0.40) stage = 'early_growth';
  else if (fraction < 0.65) stage = 'active_growth';
  else if (fraction < 0.85) stage = 'flowering';
  else if (fraction < 1.01) stage = 'harvest_ready';
  else stage = 'harvested';

  const progress = clampProgress(
    Number.isFinite(progressPercent) ? progressPercent : Math.round(fraction * 100),
  );

  return { stage, label: stageLabel(stage), progress };
}

function clampProgress(p) {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(100, Math.round(p)));
}

/** Human-readable fallback label for when i18n hasn't loaded yet. */
function stageLabel(stage) {
  switch (stage) {
    case 'planned':          return 'Planned';
    case 'land_preparation': return 'Land preparation';
    case 'planting':         return 'Planting';
    case 'early_growth':     return 'Early growth';
    case 'active_growth':    return 'Active growth';
    case 'flowering':        return 'Flowering';
    case 'harvest_ready':    return 'Harvest ready';
    case 'harvested':        return 'Harvested';
    default:                 return stage;
  }
}

export const _internal = { STAGE_ORDER, SERVER_TO_UI, stageLabel };
