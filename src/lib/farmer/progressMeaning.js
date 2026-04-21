/**
 * progressMeaning.js — turns a numeric progress score into an
 * explanation the farmer can act on (spec §5 "Improve Progress
 * Clarity").
 *
 *   getProgressMeaning({ score, stage, tasksDoneToday, tasksTodayTotal })
 *     → {
 *         headline:       'Farm progress',
 *         stageLine:      'You are in the early stage of this crop.',
 *         nextStepLine:   'Complete today\'s tasks to stay on track.',
 *         onTrack:        boolean,
 *         tone:           'good' | 'warn' | 'danger' | 'neutral',
 *         i18nKeys: { headline, stageLine, nextStepLine },
 *       }
 *
 * Purpose: never show a bare number. Every progress card includes
 * (a) what the score means, (b) whether the farmer is on track,
 * (c) what would improve it.
 *
 * Pure. Deterministic. i18n keys + English fallbacks returned so
 * the UI can translate via t() with block-level fallback.
 */

const STAGE_LINES = Object.freeze({
  planning:         { key: 'farmer.progress.stage.planning',        en: 'You are planning this crop.' },
  land_prep:        { key: 'farmer.progress.stage.land_prep',       en: 'You are preparing land for this crop.' },
  planting:         { key: 'farmer.progress.stage.planting',        en: 'You are in the planting stage.' },
  early_growth:     { key: 'farmer.progress.stage.early_growth',    en: 'You are in the early growth stage.' },
  mid_growth:       { key: 'farmer.progress.stage.mid_growth',      en: 'Your crop is in the mid growth stage.' },
  harvest:          { key: 'farmer.progress.stage.harvest',         en: 'You are in the harvest stage.' },
  post_harvest:     { key: 'farmer.progress.stage.post_harvest',    en: 'You are in the post-harvest stage.' },
});

function tierFor(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return 'neutral';
  if (s >= 80) return 'good';
  if (s >= 50) return 'neutral';
  if (s >= 30) return 'warn';
  return 'danger';
}

function nextStepFor({ score, tasksDoneToday, tasksTodayTotal }) {
  const todayLeft = Number.isFinite(tasksTodayTotal)
    ? Math.max(0, Number(tasksTodayTotal) - Number(tasksDoneToday || 0))
    : null;

  if (todayLeft != null && todayLeft > 0) {
    return {
      key: 'farmer.progress.nextStep.today_tasks',
      en: `Complete today\u2019s ${todayLeft} task${todayLeft === 1 ? '' : 's'} to stay on track.`,
    };
  }
  const s = Number(score);
  if (Number.isFinite(s) && s >= 80) {
    return {
      key: 'farmer.progress.nextStep.on_track',
      en: 'You are on track. Check back tomorrow for the next task.',
    };
  }
  if (Number.isFinite(s) && s < 30) {
    return {
      key: 'farmer.progress.nextStep.restart',
      en: 'Open today\u2019s task and log your first action.',
    };
  }
  return {
    key: 'farmer.progress.nextStep.complete_today',
    en: 'Complete today\u2019s task to improve your score.',
  };
}

/**
 * getProgressMeaning — main entry. Returns frozen copy + i18n keys
 * so the UI can translate atomically (block-level fallback).
 */
export function getProgressMeaning({
  score            = null,
  stage            = null,
  tasksDoneToday   = null,
  tasksTodayTotal  = null,
} = {}) {
  const stageRow = STAGE_LINES[String(stage || '').toLowerCase()] || STAGE_LINES.planning;
  const nextStep = nextStepFor({ score, tasksDoneToday, tasksTodayTotal });
  const tone = tierFor(score);
  const onTrack = tone === 'good' || (
    Number.isFinite(Number(score)) && Number(score) >= 50
  );

  const headline = {
    key: 'farmer.progress.headline',
    en:  'Farm progress',
  };

  return Object.freeze({
    headline:     headline.en,
    stageLine:    stageRow.en,
    nextStepLine: nextStep.en,
    onTrack,
    tone,
    i18nKeys: Object.freeze({
      headline:     headline.key,
      stageLine:    stageRow.key,
      nextStepLine: nextStep.key,
    }),
  });
}

export const _internal = Object.freeze({ STAGE_LINES, tierFor, nextStepFor });
