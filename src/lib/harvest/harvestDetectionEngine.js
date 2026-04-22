/**
 * harvestDetectionEngine.js — decides whether a farm's current crop
 * cycle is approaching harvest, already at harvest, or completed.
 *
 *   detectHarvestState({ farm, now }) → {
 *     cycleState,               // 'active' | 'harvest_ready' | 'completed'
 *     currentStage,              // canonical stage key (from timeline)
 *     harvestReady,              // boolean
 *     harvestApproaching,        // boolean (≤ 20% of penultimate stage remains)
 *     daysPastExpectedHarvest,   // number | null
 *     confidenceLevel,           // 'low' | 'medium' | 'high'
 *     why: Array<{ tag, detail }>,
 *     timeline,                  // pass-through timeline object
 *     latestHarvest,             // most recent record for this farm | null
 *   } | null
 *
 * Pure. Reads only the farm row (for plantingDate / manual override)
 * and the harvestRecordStore (via getLatestHarvest). Never mutates
 * anything — the UI is the only place that calls recordHarvest.
 *
 * Source priority (mirrors the timeline engine for consistency):
 *   1. manualStageOverride === 'harvest'         → harvestReady, medium
 *   2. latestHarvest for this planting cycle     → completed, high
 *   3. timeline.currentStage === 'harvest'       → harvestReady, engine confidence
 *   4. timeline past lifecycle total (overshoot) → harvestReady, medium
 *   5. transitionImminent into harvest           → harvestApproaching
 *   6. else                                       → active
 */

import { getCropTimeline }  from '../timeline/cropTimelineEngine.js';
import { getStageProgress } from '../timeline/stageProgressEngine.js';
import { normalizeStageKey } from '../../config/cropLifecycles.js';
import { getLatestHarvest, hasRecentHarvest } from './harvestRecordStore.js';

export function detectHarvestState({ farm = null, now = null } = {}) {
  if (!farm || typeof farm !== 'object') return null;
  const farmId = farm.id || farm._id || null;

  const timeline = getCropTimeline({ farm, now });
  if (!timeline) {
    // No crop at all — treat as active with nothing to say.
    return Object.freeze({
      cycleState: 'active',
      currentStage: null,
      harvestReady: false,
      harvestApproaching: false,
      daysPastExpectedHarvest: null,
      confidenceLevel: 'low',
      why: Object.freeze([{ tag: 'no_crop',
        detail: 'This farm has no crop set — harvest detection skipped.' }]),
      timeline: null,
      latestHarvest: null,
    });
  }

  const progress = getStageProgress({ timeline });
  const latestHarvest = farmId ? getLatestHarvest(farmId) : null;
  const why = [];

  // 2) Completed via recorded harvest (takes precedence over stage).
  if (farmId && hasRecentHarvest({ farmId, plantingDate: farm.plantingDate || null })) {
    why.push({ tag: 'harvest_recorded',
      detail: 'A harvest record is on file for this cycle — marked completed.' });
    return Object.freeze({
      cycleState: 'completed',
      currentStage: 'harvest',
      harvestReady: false,
      harvestApproaching: false,
      daysPastExpectedHarvest: null,
      confidenceLevel: 'high',
      why: Object.freeze(why),
      timeline,
      latestHarvest,
    });
  }

  // 1) Manual override wins when it points at harvest.
  const manual = normalizeStageKey(farm.manualStageOverride);
  if (manual === 'harvest') {
    why.push({ tag: 'manual_override',
      detail: 'Farmer manually set this crop to the harvest stage.' });
    return Object.freeze({
      cycleState: 'harvest_ready',
      currentStage: 'harvest',
      harvestReady: true,
      harvestApproaching: false,
      daysPastExpectedHarvest: null,
      confidenceLevel: 'medium',
      why: Object.freeze(why),
      timeline,
      latestHarvest,
    });
  }

  // 3) Timeline says we're in harvest stage already.
  if (timeline.currentStage === 'harvest') {
    why.push({ tag: 'timeline_harvest_stage',
      detail: 'Timeline places the crop in the harvest stage based on elapsed days.' });
    // Days past *expected* harvest = elapsed minus total lifecycle
    // minus the harvest stage's own duration. Positive means overdue.
    const totalMinusHarvest = timeline.totalDurationDays - (timeline.stageDurationDays || 0);
    const dph = Number.isFinite(timeline.elapsedDays)
      ? Math.max(0, timeline.elapsedDays - totalMinusHarvest - (timeline.stageDurationDays || 0))
      : null;
    return Object.freeze({
      cycleState: 'harvest_ready',
      currentStage: 'harvest',
      harvestReady: true,
      harvestApproaching: false,
      daysPastExpectedHarvest: dph,
      confidenceLevel: timeline.confidenceLevel,
      why: Object.freeze(why),
      timeline,
      latestHarvest,
    });
  }

  // 4) Overshoot — elapsed beyond total lifecycle even if timeline
  //    bucketed us into the final stage. (stageAt's overshoot flag.)
  if (timeline.source === 'planting_date'
      && timeline.elapsedDays > timeline.totalDurationDays) {
    const dph = timeline.elapsedDays - timeline.totalDurationDays;
    why.push({ tag: 'past_lifecycle',
      detail: `Crop is ${dph} day${dph === 1 ? '' : 's'} past its typical lifecycle — likely harvest-ready.` });
    return Object.freeze({
      cycleState: 'harvest_ready',
      currentStage: 'harvest',
      harvestReady: true,
      harvestApproaching: false,
      daysPastExpectedHarvest: dph,
      confidenceLevel: 'medium',
      why: Object.freeze(why),
      timeline,
      latestHarvest,
    });
  }

  // 5) Transition imminent INTO harvest.
  if (progress && progress.transitionImminent && timeline.nextStage === 'harvest') {
    why.push({ tag: 'harvest_approaching',
      detail: 'Harvest stage is approaching based on the crop timeline.' });
    return Object.freeze({
      cycleState: 'active',
      currentStage: timeline.currentStage,
      harvestReady: false,
      harvestApproaching: true,
      daysPastExpectedHarvest: null,
      confidenceLevel: timeline.confidenceLevel,
      why: Object.freeze(why),
      timeline,
      latestHarvest,
    });
  }

  // 6) Default — active, mid-journey.
  why.push({ tag: 'active_cycle',
    detail: 'Crop is still growing — harvest not yet in range.' });
  return Object.freeze({
    cycleState: 'active',
    currentStage: timeline.currentStage,
    harvestReady: false,
    harvestApproaching: false,
    daysPastExpectedHarvest: null,
    confidenceLevel: timeline.confidenceLevel,
    why: Object.freeze(why),
    timeline,
    latestHarvest,
  });
}

export const _internal = Object.freeze({});
