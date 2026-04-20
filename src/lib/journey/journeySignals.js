/**
 * journeySignals.js — derive the farmer-journey state from whatever
 * signals the app already captures.
 *
 *   deriveJourneyState({
 *     profile,          // server profile (optional)
 *     activeFarm,       // local active farm row
 *     activeCycle,      // server crop cycle (optional)
 *     completions,      // [{ taskId, completed, timestamp }]
 *     journeyRecord,    // current stored journey — used as a hint
 *     now,
 *   })
 *     → { state, crop, farmId, plantedAt, harvestedAt, reason }
 *
 * Rules (pick the first that matches):
 *   1. Harvest submitted / cropStage post_harvest  → 'post_harvest'
 *   2. activeCycle.lifecycleStatus === 'harvest_ready'
 *      OR cropStage === 'harvest'                  → 'harvest'
 *   3. plantedAt present AND ≤ 210 days ago        → 'active_farming'
 *   4. plantedAt present AND > 210 days ago        → 'harvest'
 *   5. No plantedAt, but a farm + crop exist       → 'planning'
 *      (caller may flip this to 'crop_selected' when the user has
 *      literally just picked a crop and nothing else)
 *   6. Farm exists but no crop                     → 'crop_selected'
 *   7. Otherwise                                    → 'onboarding'
 *
 * The returned `reason` explains which branch fired — handy for
 * debugging / analytics / the dev panel. Never throws.
 */

const DAY_MS = 24 * 3600 * 1000;
const ACTIVE_MAX_DAYS = 210;     // ~7 months; beyond that we assume harvest

function toMs(x) {
  if (x == null) return null;
  if (x instanceof Date) return x.getTime();
  const n = Number(x);
  if (Number.isFinite(n)) return n;
  const parsed = Date.parse(String(x));
  return Number.isFinite(parsed) ? parsed : null;
}

function stageIndicatesHarvest(stage) {
  if (!stage) return false;
  const s = String(stage).toLowerCase();
  return s === 'harvest' || s === 'harvest_ready' || s === 'flowering'
      || s === 'fruiting' || s === 'near_harvest';
}
function stageIndicatesPostHarvest(stage) {
  if (!stage) return false;
  const s = String(stage).toLowerCase();
  return s === 'post_harvest' || s === 'harvested';
}

export function deriveJourneyState({
  profile = null,
  activeFarm = null,
  activeCycle = null,
  completions = [],
  journeyRecord = null,
  now = null,
} = {}) {
  const nowTs = toMs(now) || Date.now();

  const farmId = (activeCycle && activeCycle.id)
    || (activeFarm && activeFarm.id)
    || (profile && profile.id)
    || null;
  const crop = (activeCycle && activeCycle.cropType)
    || (activeFarm && activeFarm.crop)
    || (profile && (profile.cropType || profile.crop))
    || null;
  const plantedAt = toMs(
    (activeCycle && (activeCycle.plantedAt || activeCycle.startedAt))
    || (journeyRecord && journeyRecord.plantedAt)
    || null,
  );
  const cycleStage = (activeCycle && activeCycle.lifecycleStatus) || null;
  const profileStage = (profile && profile.cropStage) || null;
  const harvestedAt = toMs(
    (activeCycle && activeCycle.harvestedAt)
    || (journeyRecord && journeyRecord.harvestedAt)
    || null,
  );

  // 1. Post-harvest
  if (harvestedAt != null
      || stageIndicatesPostHarvest(cycleStage)
      || stageIndicatesPostHarvest(profileStage)) {
    return Object.freeze({
      state: 'post_harvest', crop, farmId, plantedAt, harvestedAt,
      reason: 'harvest_submitted',
    });
  }

  // 2. Harvest
  if (stageIndicatesHarvest(cycleStage) || stageIndicatesHarvest(profileStage)) {
    return Object.freeze({
      state: 'harvest', crop, farmId, plantedAt, harvestedAt,
      reason: 'stage_harvest',
    });
  }

  // 3–4. Active farming vs late harvest by elapsed time
  if (plantedAt != null) {
    const days = Math.max(0, Math.floor((nowTs - plantedAt) / DAY_MS));
    if (days <= ACTIVE_MAX_DAYS) {
      return Object.freeze({
        state: 'active_farming', crop, farmId, plantedAt, harvestedAt,
        reason: 'plantedAt_recent',
      });
    }
    return Object.freeze({
      state: 'harvest', crop, farmId, plantedAt, harvestedAt,
      reason: 'plantedAt_past_window',
    });
  }

  // 5. Farm + crop but no planting date → planning
  if (farmId && crop) {
    // Preserve the two intermediate states if the stored journey is
    // still fresh — moves from crop_selected → planning deliberately.
    if (journeyRecord && journeyRecord.state === 'crop_selected') {
      return Object.freeze({
        state: 'crop_selected', crop, farmId, plantedAt, harvestedAt,
        reason: 'record_crop_selected',
      });
    }
    return Object.freeze({
      state: 'planning', crop, farmId, plantedAt, harvestedAt,
      reason: 'farm_with_crop',
    });
  }

  // 6. Farm without crop
  if (farmId && !crop) {
    return Object.freeze({
      state: 'crop_selected', crop, farmId, plantedAt, harvestedAt,
      reason: 'farm_without_crop',
    });
  }

  // 7. Default
  return Object.freeze({
    state: 'onboarding', crop: null, farmId: null, plantedAt: null, harvestedAt: null,
    reason: 'default_onboarding',
  });
}

export const _internal = Object.freeze({
  DAY_MS, ACTIVE_MAX_DAYS, stageIndicatesHarvest, stageIndicatesPostHarvest,
});
