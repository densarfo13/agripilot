/**
 * rainfallFitEngine.js — pure rainfall ↔ crop suitability scorer.
 *
 *   getRainfallFit(cropId, weatherState) → {
 *     cropId,
 *     rainfallFit:     'high' | 'medium' | 'low' | 'unknown',
 *     scoreAdjustment: number,    // +30 / +10 / -25 / 0
 *     plantingMessage: i18nKey,
 *     riskMessage:     i18nKey | null,
 *     taskHint:        i18nKey | null,
 *     reasons:         i18nKey[],
 *     source:          'water_profile' | 'fallback',
 *   }
 *
 * The engine is deliberately small:
 *   - "preferred" state  → high fit, big bonus, supportive message
 *   - "tolerates" state  → medium fit, small bonus
 *   - "sensitiveTo"       → low fit, penalty, explicit risk message
 *   - unknown state        → unknown (caller layers seasonality on top)
 *
 * Messages are always translation KEYS — never raw English. The UI
 * renders them through the existing i18n system so language switches
 * take effect immediately with no mixed-language state.
 */

import { normalizeCropId } from '../../config/crops/index.js';
import { getCropWaterProfile } from '../../config/crops/cropWaterProfiles.js';
import { isRainfallState } from '../weather/weatherState.js';

const f = Object.freeze;

// ─── Score weights (spec §5) ───────────────────────────────────
const ADJ = f({ high: +30, medium: +10, low: -25, unknown: 0 });

// ─── Message keys ──────────────────────────────────────────────
const MSG = f({
  high:    'rainfall.msg.goodForCurrentRain',
  medium:  'rainfall.msg.manageable',
  low_dry: 'rainfall.msg.drySlowsEstablishment',
  low_wet: 'rainfall.msg.heavyRainDamage',
  low_generic: 'rainfall.msg.currentConditionsMayAffect',
  unknown: 'rainfall.msg.checkLocalConditions',
});

// ─── Risk messages (used by the risk engine + warning chips) ──
const RISK = f({
  dry:            'rainfall.risk.waterStress',
  heavy_rain:     'rainfall.risk.floodOrRootRot',
  moderate_rain:  null,
  light_rain:     null,
  unknown:        null,
});

// ─── Task hints surfaced by the task engine ────────────────────
const TASK = f({
  dry:            'rainfall.task.planIrrigation',
  heavy_rain:     'rainfall.task.checkDrainage',
  moderate_rain:  null,
  light_rain:     null,
  unknown:        null,
});

/**
 * getRainfallFit(cropId, weatherState)
 *   Pure — no I/O. Returns a frozen result; never throws.
 */
export function getRainfallFit(cropId, weatherState) {
  const id = normalizeCropId(cropId);
  const state = isRainfallState(weatherState) ? weatherState
               : (weatherState === 'unknown' ? 'unknown' : 'unknown');

  if (!id) return buildUnknown(null, state);
  const water = getCropWaterProfile(id);
  if (!water) return buildUnknown(id, state);

  if (state === 'unknown') {
    return f({
      cropId: id,
      rainfallFit: 'unknown',
      scoreAdjustment: ADJ.unknown,
      plantingMessage: MSG.unknown,
      riskMessage: null,
      taskHint: null,
      reasons: f([]),
      source: 'water_profile',
    });
  }

  let fit = 'unknown';
  let reasonKey = null;
  if (water.preferred.includes(state))        { fit = 'high';   reasonKey = 'rainfall.reason.rainSupportsCrop'; }
  else if (water.tolerates.includes(state))   { fit = 'medium'; reasonKey = 'rainfall.reason.manageable'; }
  else if (water.sensitiveTo.includes(state)) { fit = 'low';    reasonKey = pickLowReason(state); }

  // Crop has a profile but no entry for this state (neither liked
  // nor disliked) → neutral. We surface it as `medium` so the score
  // isn't penalised — e.g. "tolerates" was empty but the state isn't
  // sensitive either.
  if (fit === 'unknown') { fit = 'medium'; reasonKey = 'rainfall.reason.manageable'; }

  return f({
    cropId: id,
    rainfallFit:     fit,
    scoreAdjustment: ADJ[fit] || 0,
    plantingMessage: pickMessage(fit, state),
    riskMessage:     fit === 'low' ? (RISK[state] || null) : null,
    taskHint:        fit === 'low' ? (TASK[state] || null) : null,
    reasons:         f(reasonKey ? [reasonKey] : []),
    source:          'water_profile',
  });
}

function pickLowReason(state) {
  if (state === 'dry')        return 'rainfall.reason.dryHurtsCrop';
  if (state === 'heavy_rain') return 'rainfall.reason.heavyRainHurtsCrop';
  return 'rainfall.reason.conditionsMayAffect';
}

function pickMessage(fit, state) {
  if (fit === 'high')   return MSG.high;
  if (fit === 'medium') return MSG.medium;
  if (fit === 'low') {
    if (state === 'dry')        return MSG.low_dry;
    if (state === 'heavy_rain') return MSG.low_wet;
    return MSG.low_generic;
  }
  return MSG.unknown;
}

function buildUnknown(cropId, state) {
  return f({
    cropId,
    rainfallFit: 'unknown',
    scoreAdjustment: 0,
    plantingMessage: MSG.unknown,
    riskMessage: null,
    taskHint: null,
    reasons: f([]),
    source: 'fallback',
  });
}

export const _internal = f({ ADJ, MSG, RISK, TASK });
