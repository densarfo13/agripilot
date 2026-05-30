/**
 * src/runtime/weatherRisk/WeatherRiskRuntime.ts — derives weather-
 * driven crop-risk advisories from (a) the existing weather
 * provider snapshot (passed in — runtime never fetches), (b) the
 * current scan signals, and (c) the farmer's farm/garden region.
 *
 * Composition rule: this runtime NEVER calls the weather provider
 * itself. The caller (ScanPage) reads `useLiveWeather` and passes
 * the snapshot in. Same for region — caller supplies it.
 *
 *   evaluate({ scanResult, plantContext, weather, timestamp })
 *     → frozen WeatherRiskResult
 *
 * Wording rules
 *   • Use 'likely' / 'possible' / 'expected' / 'forecast'.
 *   • NEVER use 'guaranteed' / 'definitely' / 'confirmed'.
 *   • CI gate enforces this on executable strings.
 */

import {
  WEATHER_RISK_RUNTIME_VERSION,
  WEATHER_RISK_LEVEL,
  type WeatherRiskLevelValue,
  type WeatherRiskAdvisory,
  type WeatherRiskResult,
  type WeatherRiskHealth,
} from './weatherRiskContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

function _str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function _num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// ─── Public entry ─────────────────────────────────────────────────

export interface WeatherRiskEvaluateInput {
  scanResult:    any;
  plantContext?: { plantId?: string; region?: string };
  /**
   * Weather snapshot from useLiveWeather (or any compatible
   * source). Pass in `{ tempC, rainChance, weatherType,
   * humidity, windKph, forecastDays }`. Runtime treats all as
   * optional — degrades gracefully when absent.
   */
  weather?: any;
  timestamp?: string;
}

export function evaluate(input: WeatherRiskEvaluateInput): WeatherRiskResult {
  const fallback = (scanId: string, plantId: string): WeatherRiskResult =>
    Object.freeze({
      plantId,
      scanId,
      region: input?.plantContext?.region,
      advisories:  Object.freeze([]),
      overallRisk: WEATHER_RISK_LEVEL.UNKNOWN,
      needsReview: true,
      timestamp:   _str(input?.timestamp),
    } as WeatherRiskResult);

  return _safe(() => {
    const scan = input.scanResult || {};
    const scanId = _str(scan.scanId) || _str(scan.id) || '';
    if (!scanId) return fallback('', '');
    const plantId = _lower(input.plantContext?.plantId)
                  || _lower(scan.plantId)
                  || _lower(scan.crop)
                  || 'unknown';
    const region = _str(input.plantContext?.region);

    const w = input.weather || {};
    const rainChance = _num(w.rainChance) ?? _num(w.precipitationChance);
    const tempC      = _num(w.tempC)      ?? _num(w.temperatureC);
    const humidity   = _num(w.humidity);
    const windKph    = _num(w.windKph);
    const wtype      = _lower(w.weatherType);

    const advisories: WeatherRiskAdvisory[] = [];

    // Disease intersection — if the scan flagged a disease signal
    // AND rain / humidity is high → fungal risk likely.
    const issue = _lower(scan.possibleIssue) + ' ' + _lower(scan.diagnosis);
    const diseaseSignal = /(blight|rot|mold|mildew|wilt|spot|rust|virus|fungal)/i
                            .test(issue);
    const rainSoon = (rainChance !== null && rainChance >= 50)
                  || wtype.includes('rain');
    const highHumidity = humidity !== null && humidity >= 75;
    if (diseaseSignal && (rainSoon || highHumidity)) {
      advisories.push(Object.freeze({
        level:    WEATHER_RISK_LEVEL.HIGH,
        category: 'fungal',
        headline: 'High fungal risk likely this week',
        body:     'Disease signals plus a rainy or humid forecast often raise fungal spread risk. Remove visibly affected leaves and improve airflow where possible.',
      }));
    } else if (diseaseSignal) {
      advisories.push(Object.freeze({
        level:    WEATHER_RISK_LEVEL.MEDIUM,
        category: 'fungal',
        headline: 'Possible disease pressure',
        body:     'A disease signal was detected. Inspect again in 2-3 days; rain or dew can accelerate spread.',
      }));
    }

    // Irrigation-delay advisory — if it's likely to rain tomorrow,
    // suggest delaying irrigation to avoid waterlogging.
    if (rainSoon) {
      advisories.push(Object.freeze({
        level:    WEATHER_RISK_LEVEL.LOW,
        category: 'irrigation_delay',
        headline: 'Rain forecast — consider delaying irrigation',
        body:     'Watering on top of a rainy forecast risks waterlogging. Skip the next planned irrigation if the soil is still moist tomorrow.',
      }));
    }

    // Heat-stress advisory.
    if (tempC !== null && tempC >= 35) {
      advisories.push(Object.freeze({
        level:    WEATHER_RISK_LEVEL.MEDIUM,
        category: 'heat_stress',
        headline: 'Heat stress possible',
        body:     'High temperatures forecast. Water early morning or late evening, and shade young plants where possible.',
      }));
    }

    // Wind-damage advisory.
    if (windKph !== null && windKph >= 40) {
      advisories.push(Object.freeze({
        level:    WEATHER_RISK_LEVEL.MEDIUM,
        category: 'wind_damage',
        headline: 'Strong winds expected',
        body:     'Wind speeds may damage tall crops or flowering plants. Stake or shield as needed.',
      }));
    }

    const frozen = Object.freeze([...advisories]) as ReadonlyArray<WeatherRiskAdvisory>;
    const overall: WeatherRiskLevelValue =
      frozen.length === 0                                  ? WEATHER_RISK_LEVEL.UNKNOWN :
      frozen.some((a) => a.level === WEATHER_RISK_LEVEL.HIGH)   ? WEATHER_RISK_LEVEL.HIGH :
      frozen.some((a) => a.level === WEATHER_RISK_LEVEL.MEDIUM) ? WEATHER_RISK_LEVEL.MEDIUM :
                                                                 WEATHER_RISK_LEVEL.LOW;

    return Object.freeze({
      plantId,
      scanId,
      region: region || undefined,
      advisories: frozen,
      overallRisk: overall,
      needsReview: overall === WEATHER_RISK_LEVEL.UNKNOWN,
      timestamp: _str(input.timestamp),
    } as WeatherRiskResult);
  }, fallback(_str(input?.scanResult?.scanId), _str(input?.plantContext?.plantId)));
}

// ─── Diagnostic envelope ──────────────────────────────────────────

export function weatherRiskHealth(): WeatherRiskHealth {
  return _safe(() => Object.freeze({
    runtimeVersion:    WEATHER_RISK_RUNTIME_VERSION,
    initialized:       true,
    weatherRiskReady:  true,
    advisoryCategories: Object.freeze([
      'fungal', 'heat_stress', 'irrigation_delay', 'wind_damage',
    ]),
  }), Object.freeze({
    runtimeVersion:    WEATHER_RISK_RUNTIME_VERSION,
    initialized:       false,
    weatherRiskReady:  false,
    advisoryCategories: Object.freeze([]),
  }));
}

export function installWeatherRiskGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__weatherRiskHealth !== 'function') {
      w.__weatherRiskHealth = function () {
        const out = weatherRiskHealth();
        try { console.log('[Farroway · Weather Risk]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
