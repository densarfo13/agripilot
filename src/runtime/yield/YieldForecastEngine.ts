/**
 * src/runtime/yield/YieldForecastEngine.ts — pure deterministic
 * yield-forecast band estimator. Never claims an exact number —
 * returns a band {low, expected, high} or unknown.
 *
 * Pure. Never throws.
 */

import type { YieldForecastBand } from './yieldContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  return null;
}

/**
 * Wave-37 risk-fix #2 — Per-region yield multipliers applied to
 * the global reference yields below. Reflects that yield potential
 * varies dramatically by region (rainfall, soil, infrastructure,
 * inputs availability). Multiplier of 1.0 = global average; <1.0 =
 * typically below average; >1.0 = typically above average.
 *
 * Pure data. Composes the region field caller passes in via the
 * forecast input. Default (no region match) is 1.0 — preserves
 * pre-wave-37 behavior.
 */
const REGION_YIELD_MULTIPLIER: Readonly<Record<string, number>> =
  Object.freeze({
    ghana:        0.7,      // smallholder rainfed
    nigeria:      0.65,     // smallholder rainfed
    kenya:        0.75,     // mixed infrastructure
    uganda:       0.7,
    tanzania:     0.7,
    south_africa: 1.05,     // commercial sector strong
    usa:          1.4,      // commercial irrigated baseline
  });

/**
 * Per-crop reference yields (kg/ha) — used as the central "expected"
 * band anchor. These are conservative, region-non-specific
 * approximations. Region multipliers (above) adjust for known
 * regional yield potential. Forecast band widens to ±30% to ±50%
 * based on risk uncertainty.
 */
const REFERENCE_YIELD_KG_PER_HA: Readonly<Record<string, number>> =
  Object.freeze({
    maize:        4500,
    rice:         4000,
    cassava:     20000,    // tubers
    yam:         15000,
    plantain:    12000,
    banana:      25000,
    cocoa:         600,
    coffee_arabica: 1200,
    coffee_robusta: 1500,
    cotton:       2000,
    sorghum:      2500,
    millet:       1500,
    millet_pearl: 1500,
    groundnut:    1500,
    soybean:      2000,
    cowpea:       1200,
    tomato:      30000,
    pepper:       8000,
    onion:       25000,
    cucumber:    20000,
    watermelon:  35000,
    potato:      25000,
    sweet_potato: 18000,
  });

export interface YieldForecastInput {
  plantId:           string;
  farmSizeHa?:       number;       // farm size in hectares
  plantCount?:       number;       // alternative when no size
  growthStage?:      string;
  region?:           string;       // wave-37 region multiplier key
  riskScore:         number;       // 0-100 from YieldRiskEngine
  hasSufficientData: boolean;
}

export function evaluateYieldForecast(input: YieldForecastInput): YieldForecastBand {
  return _safe(() => {
    if (!input.hasSufficientData) return Object.freeze({});

    const pid = typeof input.plantId === 'string' ? input.plantId.toLowerCase() : '';
    const refYield = REFERENCE_YIELD_KG_PER_HA[pid];
    if (!refYield) return Object.freeze({});

    const ha = _num(input.farmSizeHa);
    if (ha === null) return Object.freeze({});

    // Wave-37 — apply per-region multiplier when the caller passed
    // a region. Default 1.0 preserves pre-wave-37 behavior.
    const regionKey = typeof input.region === 'string'
                      ? input.region.toLowerCase() : '';
    const regionMult = REGION_YIELD_MULTIPLIER[regionKey] ?? 1.0;

    // Base expected yield from area × reference × region multiplier.
    const baseExpected = refYield * ha * regionMult;

    // Risk-adjusted central estimate.
    const riskPenalty = 1 - Math.min(0.6, input.riskScore / 200); // up to -30%
    const expected = Math.round(baseExpected * riskPenalty);

    // Band width grows with risk uncertainty: ±30% at low risk to
    // ±50% at high risk.
    const bandWidth = 0.3 + Math.min(0.2, input.riskScore / 500);
    const low  = Math.round(expected * (1 - bandWidth));
    const high = Math.round(expected * (1 + bandWidth));

    return Object.freeze({
      low,
      expected,
      high,
      unit: 'kg',
    });
  }, Object.freeze({}));
}

export const YIELD_FORECAST_ENGINE_VERSION = 'yield-forecast-engine-v1';
