/**
 * weatherEngine.js — lightweight weather signals for the
 * predictive-risk layer.
 *
 * Two surfaces:
 *
 *   getWeatherSignals()
 *     -> the spec's frozen-default surface used when no real
 *        weather data is wired. Always returns the same shape
 *        so the risk engines can be tested without mocking.
 *
 *   buildSignalsFromWeather(weather)
 *     -> derive the same { rainLast3Days, temperatureHigh,
 *        humidityHigh } booleans from a richer weather payload
 *        (the shape produced by the existing WeatherContext +
 *        engine/weatherEngine.js). Components that already use
 *        the WeatherContext can pipe its `weather` object
 *        through this adapter.
 *
 * Strict-rule audit
 *   * pure (no I/O, no Date.now read)
 *   * never throws on missing / malformed inputs
 *   * works offline (no network call here; the underlying
 *     WeatherContext owns the fetch path)
 *   * additive: nothing else in the codebase needs to change
 *     to consume getWeatherSignals().
 */

/* ─── Tunables ─────────────────────────────────────────────────── */

export const WEATHER_THRESHOLDS = Object.freeze({
  HIGH_TEMP_C:     32,    // tempHighC at/above => temperatureHigh
  HIGH_HUMIDITY:   75,    // humidityPct at/above => humidityHigh
  DRY_DAY_RAIN_MM: 1,     // rainTodayMm strictly below => "no rain today"
});

/* ─── Default surface ──────────────────────────────────────────── */

const DEFAULTS = Object.freeze({
  rainLast3Days:   false,
  temperatureHigh: true,
  humidityHigh:    true,
});

/**
 * Frozen, deterministic signals used when no real weather data
 * is available. Matches the spec contract exactly so callers
 * can use it directly + the risk engines can be unit-tested
 * without injecting weather.
 */
export function getWeatherSignals() {
  return DEFAULTS;
}

/* ─── Adapter from WeatherContext shape ────────────────────────── */

/**
 * buildSignalsFromWeather(weather)
 *
 *   weather: any shape - we read defensively
 *     * tempHighC OR tempC OR temperatureHigh boolean
 *     * humidityPct OR humidity OR humidityHigh boolean
 *     * rainLast3DaysMm OR rainPast3DaysMm OR rainLast3Days boolean
 *     * rainTodayMm + recent rain history when 3-day total isn't
 *       supplied
 *
 * Returns the same shape as getWeatherSignals(). Falls back to
 * DEFAULTS on any field we can't derive, so a partial weather
 * payload still yields a usable signal set.
 */
export function buildSignalsFromWeather(weather) {
  if (!weather || typeof weather !== 'object') return getWeatherSignals();

  const out = { ...DEFAULTS };

  // ── temperatureHigh ───────────────────────────────────────────
  if (typeof weather.temperatureHigh === 'boolean') {
    out.temperatureHigh = weather.temperatureHigh;
  } else {
    const t = Number(
      weather.tempHighC != null ? weather.tempHighC :
      weather.tempC     != null ? weather.tempC     :
      weather.temperature
    );
    if (Number.isFinite(t)) {
      out.temperatureHigh = t >= WEATHER_THRESHOLDS.HIGH_TEMP_C;
    }
  }

  // ── humidityHigh ──────────────────────────────────────────────
  if (typeof weather.humidityHigh === 'boolean') {
    out.humidityHigh = weather.humidityHigh;
  } else {
    const h = Number(
      weather.humidityPct != null ? weather.humidityPct :
      weather.humidity
    );
    if (Number.isFinite(h)) {
      out.humidityHigh = h >= WEATHER_THRESHOLDS.HIGH_HUMIDITY;
    }
  }

  // ── rainLast3Days ─────────────────────────────────────────────
  if (typeof weather.rainLast3Days === 'boolean') {
    out.rainLast3Days = weather.rainLast3Days;
  } else {
    const mm3 = Number(
      weather.rainLast3DaysMm  != null ? weather.rainLast3DaysMm  :
      weather.rainPast3DaysMm
    );
    if (Number.isFinite(mm3)) {
      out.rainLast3Days = mm3 >= WEATHER_THRESHOLDS.DRY_DAY_RAIN_MM;
    } else if (Number.isFinite(Number(weather.rainTodayMm))) {
      // Best-effort fallback: if 3-day total isn't supplied but
      // it rained today, count that as recent rain.
      out.rainLast3Days = Number(weather.rainTodayMm) >= WEATHER_THRESHOLDS.DRY_DAY_RAIN_MM;
    }
  }

  return Object.freeze(out);
}

export const _internal = Object.freeze({ DEFAULTS });
