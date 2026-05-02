/**
 * dailyIntelligenceEngine.js — orchestrator that turns a
 * farm profile + weather + recent activity into a single
 * DailyPlan the card renders.
 *
 * Strict-rule audit
 *   • Pure / no side effects — no fetch, no setState. The
 *     caller passes everything in; the engine returns a
 *     plain object.
 *   • Existing task / weather engines are NOT touched.
 *   • All recommendations route through reviewed copy in
 *     taskGenerator + weatherTaskRules — no LLM access.
 */

import { estimateCropStage, isHarvestStage } from './cropStageEstimator.js';
import { applyWeatherRules } from './weatherTaskRules.js';
import { generateActions } from './taskGenerator.js';
import { getCompletedActionIdsToday } from './dailyTaskCompletion.js';
import {
  getRegionConfig,
  shouldUseBackyardExperience,
} from '../config/regionConfig.js';
import { getBackyardDailyPlan, getBackyardWeatherAlerts } from '../experience/backyardExperience.js';
import { getFarmDailyPlan, getFarmWeatherFocusAlerts } from '../experience/farmExperience.js';
import { getGenericDailyPlan } from '../experience/genericExperience.js';
import { resolveRegionUX } from './regionUXEngine.js';
import { isFeatureEnabled } from '../config/features.js';
import { getActiveScanTasks } from './scanToTask.js';
// Land Intelligence — derives scaleType + riskProfile from
// (sizeSqFt, country, weather, experience) and surfaces extra
// actions the daily plan can append to the existing rule output.
// Pure helper; never throws; offline-safe.
import { landIntelligenceEngine } from './landIntelligenceEngine.js';

/**
 * @typedef {{
 *   farmId: string,
 *   cropId: string|null,
 *   cropStage: string|null,
 *   date: string,
 *   summary: string,
 *   actions: object[],
 *   alerts: object[],
 *   confidence: 'low'|'medium'|'high',
 *   needsPlantingDate: boolean,
 *   needsCrop: boolean,
 *   needsLocation: boolean,
 *   weatherUsed: boolean,
 *   harvestReady: boolean,
 *   generatedAt: string,
 * }} DailyPlan
 */

function isoDay(d = new Date()) {
  try {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return ''; }
}

function nowIso() {
  try { return new Date().toISOString(); } catch { return ''; }
}

/**
 * computeConfidence — the spec calls out three levels:
 *
 *   high   — crop, plantingDate, location, AND weather all set
 *   medium — at least crop + plantingDate (or weather)
 *   low    — anything less, including offline / cached weather
 */
function computeConfidence({
  hasCrop, hasPlantingDate, hasLocation, hasWeather, weatherStale,
}) {
  if (hasCrop && hasPlantingDate && hasLocation && hasWeather && !weatherStale) {
    return 'high';
  }
  if ((hasCrop && hasPlantingDate) || hasWeather) return 'medium';
  return 'low';
}

/**
 * buildAlerts — gather every cross-cutting alert (missing
 * profile data + weather-driven). Severity-ordered for the
 * UI: critical first, then warning, then info.
 */
function buildAlerts({
  needsCrop, needsPlantingDate, needsLocation, weatherAlerts,
}) {
  const out = [];
  if (Array.isArray(weatherAlerts)) out.push(...weatherAlerts);

  if (needsCrop) {
    out.push({
      id: 'profile.missingCrop',
      title: 'Add your crop',
      message: 'Select a crop on My Farm so we can tailor today\u2019s actions.',
      severity: 'warning',
    });
  }
  if (needsPlantingDate) {
    out.push({
      id: 'profile.missingPlantingDate',
      title: 'Add your planting date',
      message: 'Tell us when you planted so we can show stage-aware actions.',
      severity: 'warning',
    });
  }
  if (needsLocation) {
    out.push({
      id: 'profile.missingLocation',
      title: 'Add your farm location',
      message: 'A location lets us match weather and risk alerts to your farm.',
      severity: 'info',
    });
  }

  const RANK = { critical: 3, warning: 2, info: 1 };
  out.sort((a, b) => (RANK[b.severity] || 0) - (RANK[a.severity] || 0));
  return out;
}

/**
 * buildSummary — short, plain-language one-liner that the
 * card surfaces under the greeting. Voice integration reads
 * this verbatim.
 */
function buildSummary({
  cropStage, harvestReady, hasWeather, weatherCondition,
}) {
  if (harvestReady) {
    return 'Your crop is at harvest stage. Confirm readiness and prepare to sell.';
  }
  if (cropStage === 'flowering') {
    return 'Flowering stage today — small problems now turn into big yield losses.';
  }
  if (cropStage === 'grain_filling') {
    return 'Grain-fill stage — keep soil moisture steady and watch for pests.';
  }
  if (cropStage === 'germination' || cropStage === 'establishment') {
    return 'Early stage — your crop is fragile, focus on light water and weed control.';
  }
  if (hasWeather && weatherCondition) {
    return `Today\u2019s focus: ${weatherCondition.toLowerCase()}.`;
  }
  return 'Here is your plan for today.';
}

/**
 * generateDailyPlan — main entry point.
 *
 * @param  {object} args
 * @param  {object} args.farm           required — { id, crop / cropType,
 *                                                    plantingDate, country,
 *                                                    state, manualStage }
 * @param  {object} [args.weather]      optional weather snapshot
 * @param  {object[]} [args.recentTasks] optional last-3-day task slice
 * @param  {boolean} [args.weatherStale] true when last-known cached
 * @param  {Date}    [args.now]
 *
 * @returns {DailyPlan}
 */
export function generateDailyPlan({
  farm,
  weather = null,
  recentTasks = [],
  weatherStale = false,
  now,
} = {}) {
  if (!farm || !farm.id) {
    return {
      farmId: null,
      cropId: null,
      cropStage: null,
      date: isoDay(now),
      summary: 'Set up your farm to see today\u2019s actions.',
      actions: [],
      alerts: [{
        id: 'profile.missingFarm',
        title: 'No farm yet',
        message: 'Add your farm details to get a daily plan.',
        severity: 'warning',
      }],
      confidence: 'low',
      needsPlantingDate: true,
      needsCrop: true,
      needsLocation: true,
      weatherUsed: false,
      harvestReady: false,
      generatedAt: nowIso(),
    };
  }

  const cropId = farm.crop || farm.cropType || null;
  const plantingDate = farm.plantingDate || farm.plantedAt || null;
  const country = farm.country || farm.countryCode || null;

  // Region UX resolution (Region UX System spec §1, §4).
  // Behind a feature flag — when off, behaviour is identical
  // to before. When on, an `experience: 'generic'` resolution
  // (unknown / planned country, or no farmType pivot) returns
  // the genericExperience plan, sidestepping the farm/backyard
  // routing below.
  const regionUxOn = isFeatureEnabled('regionUxSystem');
  if (regionUxOn) {
    const ux = resolveRegionUX({
      detectedCountry: country || farm.detectedCountry,
      detectedRegion:  farm.region || farm.detectedRegion,
      farmType:        farm.farmType || farm.type,
    });
    if (ux.experience === 'generic') {
      const generic = getGenericDailyPlan({ farm, weather, recentTasks });
      return {
        farmId:            farm.id,
        cropId,
        cropStage:         farm.manualStage || farm.cropStage || null,
        date:              isoDay(now),
        summary:           generic.summary,
        actions:           generic.actions,
        alerts:            generic.alerts,
        confidence:        generic.confidence,
        // Generic plan doesn't depend on per-farm signals; flag
        // them as unknown rather than missing so the card doesn't
        // emit "needs planting date" prompts that don't apply.
        needsPlantingDate: false,
        needsCrop:         false,
        needsLocation:     false,
        weatherUsed:       false,
        harvestReady:      false,
        generatedAt:       nowIso(),
        // Surfaced for telemetry / banner rendering. Existing
        // consumers that ignore unknown fields stay safe.
        regionUx:          ux,
      };
    }
    // Farm / backyard branches below already handle the rest.
  }

  // Region-aware experience selection (spec §5). Reads
  // through the config so no country logic is hardcoded
  // here — Mexico's mixed experience + home_garden farm type
  // resolves to backyard automatically.
  const regionConfig = getRegionConfig(country);
  const isBackyard = shouldUseBackyardExperience(country, farm.farmType);

  // Stage: prefer manual override, else estimate from days
  // since planting.
  const stageInfo = estimateCropStage({
    cropId,
    plantingDate,
    now: now ? (now instanceof Date ? now.getTime() : now) : undefined,
  });
  const stage = farm.manualStage || farm.cropStage || stageInfo.stage || null;
  const harvestReady = isHarvestStage(stage);

  // Weather rules — empty arrays when no weather passed in.
  const baseWeatherRules = weather ? applyWeatherRules(weather) : { actions: [], alerts: [] };

  // Region-specific weather alerts (typhoon / monsoon /
  // drought / flood / frost / heat). Merged on top of the
  // base rules so the Philippine farmer sees the typhoon
  // banner and the U.S. backyarder sees the frost watch.
  const focusAlerts = isBackyard
    ? getBackyardWeatherAlerts(weather)
    : getFarmWeatherFocusAlerts(weather, regionConfig.weatherFocus || []);
  const weatherRules = {
    actions: baseWeatherRules.actions,
    alerts:  [...focusAlerts, ...baseWeatherRules.alerts],
  };

  // Already-completed-today filter.
  let completedToday = [];
  try { completedToday = getCompletedActionIdsToday(farm.id) || []; }
  catch { completedToday = []; }

  // Action list (capped at 3 inside generateActions).
  let actions = generateActions({
    cropStageInfo: { ...stageInfo, stage },
    weatherRules,
    recentTasks,
    completedToday,
    // Spec §9: backyard users never see Sell as an action,
    // so suppress harvestReady → "Prepare to sell" emission
    // for them. Farm region gating happens via
    // regionConfig.enableSellFlow below.
    harvestReady: harvestReady && !isBackyard && regionConfig.enableSellFlow !== false,
  });

  // Scan-derived follow-ups (feature-flag gated). When a recent
  // /scan flagged "check the affected leaf again tomorrow" we
  // surface those tasks alongside the engine's regular output.
  // Capped at 1 per render so the daily card stays scannable;
  // the rest of the slots come from the existing generator below.
  if (isFeatureEnabled('scanToTask')) {
    try {
      const scanTasks = getActiveScanTasks({ farmId: farm.id });
      if (Array.isArray(scanTasks) && scanTasks.length > 0) {
        const seen = new Set(actions.map((a) => a.id));
        for (const t of scanTasks.slice(0, 1)) {
          if (actions.length >= 3) break;
          if (seen.has(t.id)) continue;
          actions = [
            ...actions,
            {
              id:         t.id,
              title:      t.title,
              detail:     t.reason,
              urgency:    t.urgency || 'medium',
              actionType: t.actionType || 'inspect',
              source:     'scan',
            },
          ];
          seen.add(t.id);
        }
      }
    } catch { /* never let scan-task lookup break daily plan */ }
  }

  // Experience fallback: when the engine can't fill three
  // slots, top up from the experience-specific safe set so
  // the daily card never reads empty for a known region.
  if (actions.length < 3) {
    const fallback = isBackyard
      ? getBackyardDailyPlan().actions
      : getFarmDailyPlan().actions;
    const seen = new Set(actions.map((a) => a.id));
    for (const a of fallback) {
      if (actions.length >= 3) break;
      if (!seen.has(a.id)) actions = [...actions, a];
    }
  }

  // Land Intelligence enrichment — when humidity / heat / rain
  // signals are present, append the matching risk action so the
  // daily plan reflects today's conditions even when the rule
  // engine didn't pick up the same signal. Bounded by the
  // 3-slot cap and deduped against existing entries (case-
  // insensitive title match).
  try {
    const land = landIntelligenceEngine({
      sizeSqFt:         Number(farm.landSizeSqFt) || Number(farm.farmSize) || null,
      country,
      region:           farm.region || farm.state || null,
      cropName:         cropId || null,
      activeExperience: isBackyard ? 'garden' : 'farm',
      weather,
    });
    if (land && Array.isArray(land.suggestedActions) && land.suggestedActions.length > 0) {
      const existingTitles = new Set(
        actions.map((a) => String(a.title || '').trim().toLowerCase()),
      );
      for (const text of land.suggestedActions) {
        if (actions.length >= 3) break;
        const k = String(text || '').trim().toLowerCase();
        if (!k || existingTitles.has(k)) continue;
        actions = [
          ...actions,
          {
            id:         `land_${k.replace(/[^a-z0-9]+/g, '_').slice(0, 32)}`,
            title:      text,
            detail:     '',
            urgency:    'medium',
            actionType: 'inspect',
            source:     'land_intel',
            scaleType:  land.scaleType,
          },
        ];
        existingTitles.add(k);
      }
    }
  } catch { /* never let land enrichment break the daily plan */ }

  // Alerts — combine weather + profile gaps.
  const alerts = buildAlerts({
    needsCrop:           !cropId,
    needsPlantingDate:   stageInfo.needsPlantingDate,
    needsLocation:       !country,
    weatherAlerts:       weatherRules.alerts,
  });

  const confidence = computeConfidence({
    hasCrop:         !!cropId,
    hasPlantingDate: !stageInfo.needsPlantingDate,
    hasLocation:     !!country,
    hasWeather:      !!weather,
    weatherStale,
  });

  const summary = buildSummary({
    cropStage: stage,
    harvestReady,
    hasWeather: !!weather,
    weatherCondition: weather && weather.condition ? weather.condition : null,
  });

  return {
    farmId: farm.id,
    cropId,
    cropStage: stage,
    date: isoDay(now),
    summary: isBackyard ? getBackyardDailyPlan().summary : summary,
    actions,
    alerts,
    confidence,
    needsPlantingDate: stageInfo.needsPlantingDate,
    needsCrop:         !cropId,
    needsLocation:     !country,
    weatherUsed:       !!weather,
    weatherStale,
    harvestReady,
    // Region context for downstream consumers (UI labels,
    // sell-flow gating, measurement system).
    experience:        isBackyard ? 'backyard' : regionConfig.experience,
    enableSellFlow:    !isBackyard && regionConfig.enableSellFlow !== false,
    measurementSystem: regionConfig.measurementSystem,
    country,
    generatedAt: nowIso(),
  };
}

/**
 * getDailyPlanVoiceSummary — short, speakable version used by
 * the voice intent ("What should I do today?"). Picks summary
 * + first action title + first alert message, joined.
 */
export function getDailyPlanVoiceSummary(plan) {
  if (!plan) return '';
  const parts = [];
  if (plan.summary) parts.push(plan.summary);
  if (plan.actions && plan.actions[0]) {
    parts.push(`First action: ${plan.actions[0].title}.`);
  }
  if (plan.alerts && plan.alerts[0] && plan.alerts[0].severity !== 'info') {
    parts.push(plan.alerts[0].message);
  }
  return parts.join(' ');
}

export const _internal = Object.freeze({ buildSummary, computeConfidence, buildAlerts });
