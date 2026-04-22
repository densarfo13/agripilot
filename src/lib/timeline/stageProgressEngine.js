/**
 * stageProgressEngine.js — derives farmer-friendly progress facts
 * from a crop timeline.
 *
 *   getStageProgress({ timeline }) → {
 *     journeyPercent,        // 0..100 | null
 *     stagePercent,          // 0..100 | null  (progress within current stage)
 *     stageLabelKey,         // i18n key for the current stage name
 *     nextStageLabelKey,
 *     daysRemainingCopy,     // { key, fallback } | null
 *     transitionImminent,    // true when ≤ 20% of current stage remains
 *     headline,              // { key, fallback } — one-line status
 *     confidenceLevel,
 *   }
 *
 * Kept deliberately thin — the timeline engine already computes the
 * numbers; this module turns them into UI-ready labels with safe
 * fallback copy. Progress stays separate from streak progress so
 * the two can never be confused (spec §10).
 */

import { humanDays } from './timelineHelpers.js';

function stageKeyI18n(stageKey) {
  if (!stageKey) return null;
  return `timeline.stage.${stageKey}`;
}

function headlineFor({
  cropKey, currentStage, source, overallProgressPercent,
  transitionImminent, confidenceLevel, nextStage,
}) {
  const cropCap = cropKey
    ? cropKey.charAt(0).toUpperCase() + cropKey.slice(1)
    : 'Crop';
  const stagePretty = String(currentStage || '')
    .replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

  if (source === 'generic') {
    return {
      key: 'timeline.headline.planning',
      fallback: 'Add a planting date to start your crop journey.',
    };
  }
  if (confidenceLevel === 'low') {
    return {
      key: 'timeline.headline.estimated',
      fallback: `${cropCap} is likely in the ${stagePretty.toLowerCase()} stage.`,
    };
  }
  if (transitionImminent && nextStage) {
    const nextPretty = String(nextStage).replace(/[_-]+/g, ' ');
    return {
      key: 'timeline.headline.transition',
      fallback: `Entering ${nextPretty} stage soon.`,
    };
  }
  if (currentStage === 'harvest') {
    return {
      key: 'timeline.headline.harvest',
      fallback: 'Harvest stage — get ready to bring in the crop.',
    };
  }
  if (overallProgressPercent != null) {
    return {
      key: 'timeline.headline.progress',
      fallback: `${cropCap} is about ${overallProgressPercent}% through its journey.`,
    };
  }
  return {
    key: 'timeline.headline.stage',
    fallback: `${cropCap} is in the ${stagePretty.toLowerCase()} stage.`,
  };
}

export function getStageProgress({ timeline } = {}) {
  if (!timeline || typeof timeline !== 'object') return null;

  const {
    crop, currentStage, nextStage,
    daysIntoStage, stageDurationDays, estimatedDaysRemainingInStage,
    overallProgressPercent, confidenceLevel, source,
  } = timeline;

  let stagePercent = null;
  if (Number.isFinite(daysIntoStage) && Number.isFinite(stageDurationDays)
      && stageDurationDays > 0) {
    stagePercent = Math.max(0, Math.min(100,
      Math.round((daysIntoStage / stageDurationDays) * 100)));
  }

  // "Imminent" transition = ≤ 20% remaining in the current stage
  // (matches the "entering flowering soon" notification rule).
  let transitionImminent = false;
  if (Number.isFinite(estimatedDaysRemainingInStage) && stageDurationDays > 0
      && estimatedDaysRemainingInStage / stageDurationDays <= 0.2
      && estimatedDaysRemainingInStage > 0
      && source !== 'stage_only'
      && source !== 'generic') {
    transitionImminent = true;
  }

  const daysRemainingCopy = (estimatedDaysRemainingInStage == null)
    ? null
    : humanDays(estimatedDaysRemainingInStage);

  return Object.freeze({
    journeyPercent:     overallProgressPercent,
    stagePercent,
    stageLabelKey:      stageKeyI18n(currentStage),
    nextStageLabelKey:  stageKeyI18n(nextStage),
    daysRemainingCopy,
    transitionImminent,
    headline: headlineFor({
      cropKey: crop, currentStage, source, overallProgressPercent,
      transitionImminent, confidenceLevel, nextStage,
    }),
    confidenceLevel,
  });
}

export const _internal = Object.freeze({ stageKeyI18n, headlineFor });
