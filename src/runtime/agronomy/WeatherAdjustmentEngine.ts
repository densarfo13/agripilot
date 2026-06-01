/**
 * WeatherAdjustmentEngine.ts — spec-canonical facade. Reads the existing
 * __weatherRiskHealth probe to decide whether to adjust a recommendation
 * for current conditions (rain / wind / heat / cold / humidity).
 *
 * NEVER fabricates weather — when the probe isn't available the facade
 * returns { adjust: false, reason: 'no weather signal' } so the caller
 * falls through to the unadjusted recommendation.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export const WEATHER_ADJUSTMENT_ENGINE_VERSION = 'weather-adjustment-engine-v1' as const;

export interface WeatherAdjustment {
  adjust: boolean;
  block: ReadonlyArray<string>;       // suggested actions to AVOID right now
  prefer: ReadonlyArray<string>;      // suggested alternative actions
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  limitations: string;
}

const NEVER_ADJUST: Readonly<WeatherAdjustment> = Object.freeze({
  adjust: false,
  block: Object.freeze([]) as ReadonlyArray<string>,
  prefer: Object.freeze([]) as ReadonlyArray<string>,
  reason: 'no weather signal',
  confidence: 'low',
  limitations: 'No live weather probe — recommendation unadjusted. Decision support, not a guarantee.',
});

export function weatherAdjustmentForToday(): Readonly<WeatherAdjustment> {
  return _safe(() => {
    if (typeof window === 'undefined') return NEVER_ADJUST;
    const w = window as any;
    const probe = typeof w.__weatherRiskHealth === 'function' ? w.__weatherRiskHealth() : null;
    if (!probe) return NEVER_ADJUST;
    const v = (probe as any).value || probe;
    const heavyRain = !!(v as any).heavyRain || !!(v as any).rainExpected;
    const wind = !!(v as any).highWind;
    const heat = !!(v as any).heatRisk;
    const cold = !!(v as any).coldRisk;
    const humid = !!(v as any).humidityRisk;
    const block: string[] = [];
    const prefer: string[] = [];
    if (heavyRain) { block.push('spraying'); prefer.push('drainage_inspection'); }
    if (wind) { block.push('spraying'); }
    if (heat) { block.push('midday_field_work'); prefer.push('early_morning_inspection'); }
    if (cold) { prefer.push('seedling_protection'); }
    if (humid) { prefer.push('disease_scan'); }
    return Object.freeze<WeatherAdjustment>({
      adjust: block.length > 0 || prefer.length > 0,
      block: Object.freeze(block) as ReadonlyArray<string>,
      prefer: Object.freeze(prefer) as ReadonlyArray<string>,
      reason: heavyRain ? 'heavy_rain' : wind ? 'high_wind' : heat ? 'heat' : cold ? 'cold' : humid ? 'humidity' : 'no_adjustment',
      confidence: ((probe as any).confidence as 'low' | 'medium' | 'high') || 'medium',
      limitations: 'Weather inputs are approximate; recommendations are advisory. Decision support, not a guarantee.',
    });
  }, NEVER_ADJUST);
}
