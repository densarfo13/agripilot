/**
 * harvestSummaryEngine.js — builds the post-record summary view.
 *
 *   getHarvestSummary({ record, farm }) → {
 *     harvestedAmount, harvestedUnit,
 *     harvestedAtIso,
 *     amountInKg,           // normalised for the value calc
 *     valueEstimate,        // { lowValue, highValue, currency, formatted } | null
 *     cropCycleCompleted,   // true once we have a record
 *     headline, body,       // i18n-keyed copy
 *     nextStepKey, nextStepFallback,
 *   } | null
 *
 * Uses the existing valueEngine from the farm intelligence layer so
 * the harvest summary renders monetary estimates in the farmer's
 * local currency when priced, falling back to USD otherwise.
 */

import { estimateValue } from '../intelligence/valueEngine.js';
import { normalizeCrop } from '../../config/crops.js';

// Crude unit → kg conversion. "bags", "crates", and "pieces" are
// crop-specific in reality — we pick conservative averages so the
// value estimate stays honest. The summary flags the unit used.
const UNIT_KG_FACTOR = Object.freeze({
  kg:     1,
  tons:   1000,
  // Typical smallholder sack / crate weights — wide variance, used
  // only for a loose value estimate.
  bags:   50,
  crates: 15,
  pieces: 0.3,
});

function amountToKg(amount, unit) {
  const u = String(unit || 'kg').toLowerCase();
  const f = UNIT_KG_FACTOR[u];
  if (!Number.isFinite(f)) return null;
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * f;
}

export function getHarvestSummary({ record = null, farm = null } = {}) {
  if (!record || typeof record !== 'object') return null;
  const amountInKg = amountToKg(record.harvestedAmount, record.harvestedUnit);
  const crop = normalizeCrop(record.crop || (farm && (farm.crop || farm.cropType)));

  // Build a synthetic yield estimate so valueEngine can produce a
  // ± band around the recorded amount (±15%).
  let valueEstimate = null;
  if (amountInKg != null && crop) {
    const yieldEstimate = {
      crop,
      lowEstimateKg:     +(amountInKg * 0.85).toFixed(2),
      highEstimateKg:    +(amountInKg * 1.15).toFixed(2),
      typicalEstimateKg: +amountInKg.toFixed(2),
      unit: 'kg',
      confidenceLevel: 'medium',
    };
    valueEstimate = estimateValue({
      yieldEstimate, crop,
      countryCode: farm && (farm.countryCode || farm.country),
    });
  }

  const headline = {
    key: 'harvest.summary.headline',
    fallback: 'Harvest recorded',
  };
  const body = {
    key: 'harvest.summary.body',
    fallback: `You harvested ${record.harvestedAmount} ${record.harvestedUnit} of ${crop || 'your crop'}.`,
  };
  const nextStepKey = 'harvest.summary.nextStep';
  const nextStepFallback = valueEstimate
    ? 'Store the produce properly, then plan your next planting cycle.'
    : 'Review how this season went, then plan your next planting cycle.';

  return Object.freeze({
    recordId:            record.id,
    farmId:              record.farmId,
    crop,
    harvestedAmount:     record.harvestedAmount,
    harvestedUnit:       record.harvestedUnit,
    harvestedAtIso:      record.harvestedAt,
    amountInKg,
    valueEstimate,
    cropCycleCompleted:  true,
    headline, body,
    nextStepKey, nextStepFallback,
  });
}

export const _internal = Object.freeze({ UNIT_KG_FACTOR, amountToKg });
