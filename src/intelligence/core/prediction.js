/**
 * prediction — rule-based "next best action" recommender (spec §3).
 *
 *   predictNextBestAction(context) → Prediction | null
 *
 * RULES IMPLEMENTED (spec §3)
 *   1. rain + land prep stage     → check drainage
 *   2. heat + small container     → check soil moisture
 *   3. recent yellowing scan      → inspect lower leaves
 *   4. harvest stage              → prepare listing
 *   5. no location                → add region/weather location
 *   6. completed-task streak      → growth momentum nudge
 *
 *   Multiple rules may apply; the first match wins (spec §10
 *   "one visible insight per screen"). Order is tuned so the
 *   most time-sensitive nudge — weather — leads.
 *
 * SAFETY
 *   • Pure function. Never throws. Returns null when nothing
 *     applies (orchestrator falls back to a generic insight).
 *   • userFacingText is calm, action-framed, no scores.
 */

import { PREDICTION_TYPE, CONFIDENCE } from './intelligenceTypes.js';

/**
 * @param {import('./intelligenceTypes.js').IntelligenceContext} context
 * @returns {import('./intelligenceTypes.js').Prediction|null}
 */
export function predictNextBestAction(context) {
  if (!context || typeof context !== 'object') return null;

  const weather = context.weather || {};
  const rainProb = Number(weather.rainProbability ?? weather.precipitationProbability ?? weather.rainProb);
  const tempC    = Number(weather.tempC ?? weather.temperature ?? weather.temp);
  const stage    = String(context.cropStage || '').toLowerCase();
  const isLandPrep = stage.includes('land') || stage.includes('prep') || stage.includes('seedbed');
  const isHarvest  = stage.includes('harvest') || stage.includes('mature');
  const isGarden   = context.mode === 'garden';
  const smallPot   = isGarden && /(small|pot|tin)/i.test(String(context.gardenContainer || ''));

  // Rule 1 — rain + land prep
  if (Number.isFinite(rainProb) && rainProb >= 0.6 && (isLandPrep || !context.cropStage)) {
    return _pred({
      predictionType:    PREDICTION_TYPE.WEATHER_PREP,
      recommendedAction: 'check_drainage',
      reason:            `rainProb=${rainProb} stage=${stage || 'n/a'}`,
      confidence:        CONFIDENCE.MEDIUM,
      timeWindow:        'today',
      userFacingText:    'Check drainage before the rain comes.',
      internalSignals:   { rainProb, isLandPrep },
    });
  }

  // Rule 2 — heat + small container
  if (Number.isFinite(tempC) && tempC >= 32 && smallPot) {
    return _pred({
      predictionType:    PREDICTION_TYPE.WEATHER_PREP,
      recommendedAction: 'check_soil_moisture',
      reason:            `tempC=${tempC} smallPot`,
      confidence:        CONFIDENCE.MEDIUM,
      timeWindow:        'today',
      userFacingText:    'Hot day — check if your pots need water.',
      internalSignals:   { tempC, smallPot: true },
    });
  }

  // Rule 3 — recent yellowing scan
  const recentScan = (context.scanHistory || [])[0];
  if (recentScan && typeof recentScan === 'object'
      && (recentScan.category === 'yellowing'
       || /yellow/i.test(String(recentScan.possibleIssue || recentScan.label || '')))) {
    return _pred({
      predictionType:    PREDICTION_TYPE.SCAN_FOLLOWUP,
      recommendedAction: 'inspect_lower_leaves',
      reason:            'recent_yellowing_scan',
      confidence:        CONFIDENCE.LOW,
      timeWindow:        'today',
      userFacingText:    'Check lower leaves on the plant you scanned.',
      internalSignals:   { scanId: recentScan.scanId || recentScan.id || null },
    });
  }

  // Rule 4 — harvest stage
  if (isHarvest && (context.produceListings || []).length === 0) {
    return _pred({
      predictionType:    PREDICTION_TYPE.HARVEST_LISTING,
      recommendedAction: 'prepare_listing',
      reason:            `stage=${stage}`,
      confidence:        CONFIDENCE.MEDIUM,
      timeWindow:        'this week',
      userFacingText:    'Your crop is close to harvest — start a sell listing.',
      internalSignals:   { stage },
    });
  }

  // Rule 5 — no location / no weather
  if (!context.region && !context.weather) {
    return _pred({
      predictionType:    PREDICTION_TYPE.LOCATION_SETUP,
      recommendedAction: 'add_location',
      reason:            'missing_region_and_weather',
      confidence:        CONFIDENCE.LOW,
      timeWindow:        'soon',
      userFacingText:    'Add your region so we can tailor today’s guidance.',
      internalSignals:   {},
    });
  }

  // Rule 6 — growth momentum
  const completedTasks = (context.tasks || []).filter((t) => t && t.completed).length;
  if (completedTasks >= 3) {
    return _pred({
      predictionType:    PREDICTION_TYPE.GROWTH_MOMENTUM,
      recommendedAction: 'celebrate_progress',
      reason:            `completedTasks=${completedTasks}`,
      confidence:        CONFIDENCE.LOW,
      timeWindow:        'this week',
      userFacingText:    `You’ve completed ${completedTasks} tasks recently — keep going.`,
      internalSignals:   { completedTasks },
    });
  }

  return null;
}

function _pred(o) {
  return Object.freeze({
    predictionType:    String(o.predictionType),
    recommendedAction: String(o.recommendedAction),
    reason:            String(o.reason || ''),
    confidence:        String(o.confidence),
    timeWindow:        String(o.timeWindow || ''),
    userFacingText:    String(o.userFacingText),
    internalSignals:   Object.freeze({ ...(o.internalSignals || {}) }),
  });
}

const _module = { predictNextBestAction };
export default _module;
