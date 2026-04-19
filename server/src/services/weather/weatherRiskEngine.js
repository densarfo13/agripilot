/**
 * weatherRiskEngine.js — turn a weather forecast into farmer-facing
 * risk levels. Pure function, no I/O.
 *
 * Input shape:
 *   {
 *     tempHighC / tempLowC           — today's temps in Celsius
 *     rainChancePct                  — 0..100 (today)
 *     rainMmToday / rainMmNext24h    — mm of rain expected
 *     humidityPct                    — 0..100
 *     windKph                        — surface wind speed
 *     forecast: [{ day, tempHighC, rainMmToday, ...}, ...]  optional
 *   }
 *
 * Outputs:
 *   heatRisk / rainRisk / frostRisk / humidityPestRisk  — 'low'|'medium'|'high'
 *   overallWeatherRisk  — 'low'|'medium'|'high'
 *   reasons             — array of short farmer-facing strings
 *
 * Thresholds live in WEATHER_CONFIG so ops can tune without
 * re-reading the engine.
 */

export const WEATHER_CONFIG = Object.freeze({
  heat:   { medium: 32, high: 37 },     // °C for daily high
  frost:  { medium: 3, high: 0 },       // °C for daily low
  rainMm: { medium: 10, high: 25 },     // mm in the 24h window
  rainPct:{ medium: 60, high: 85 },     // chance of rain
  humidity:{ medium: 80, high: 90 },
  windKph:{ medium: 35, high: 55 },
});

function band(value, lo, hi) {
  if (!Number.isFinite(value)) return 'low';
  if (value >= hi) return 'high';
  if (value >= lo) return 'medium';
  return 'low';
}

function bandReverse(value, lo, hi) {
  // For thresholds where LOWER = worse (frost).
  if (!Number.isFinite(value)) return 'low';
  if (value <= hi) return 'high';
  if (value <= lo) return 'medium';
  return 'low';
}

function maxBand(...levels) {
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  return 'low';
}

export function getWeatherRisk(weather = {}) {
  const CFG = WEATHER_CONFIG;
  const reasons = [];

  const heatRisk = band(weather.tempHighC, CFG.heat.medium, CFG.heat.high);
  if (heatRisk === 'high') reasons.push('High heat expected today — keep crops watered and shaded.');
  else if (heatRisk === 'medium') reasons.push('Warm day ahead — water earlier if you can.');

  const frostRisk = bandReverse(weather.tempLowC, CFG.frost.medium, CFG.frost.high);
  if (frostRisk === 'high') reasons.push('Frost possible overnight — cover sensitive seedlings.');
  else if (frostRisk === 'medium') reasons.push('Chilly overnight low — watch frost-sensitive crops.');

  const rainMm = Number.isFinite(weather.rainMmNext24h)
    ? weather.rainMmNext24h
    : weather.rainMmToday;
  const rainChance = Number.isFinite(weather.rainChancePct) ? weather.rainChancePct : 0;
  const rainByMm = band(rainMm, CFG.rainMm.medium, CFG.rainMm.high);
  const rainByPct = band(rainChance, CFG.rainPct.medium, CFG.rainPct.high);
  const rainRisk = maxBand(rainByMm, rainByPct);
  if (rainRisk === 'high') reasons.push('Heavy rain expected — delay planting and protect harvested crops.');
  else if (rainRisk === 'medium') reasons.push('Rain likely — you can skip watering today.');

  const humidityPestRisk = band(weather.humidityPct, CFG.humidity.medium, CFG.humidity.high);
  if (humidityPestRisk === 'high') reasons.push('Humidity is high — walk the rows and scout for disease.');

  const windRisk = band(weather.windKph, CFG.windKph.medium, CFG.windKph.high);
  if (windRisk === 'high') reasons.push('Windy day — skip spraying and stake tall plants.');

  const overallWeatherRisk = maxBand(heatRisk, frostRisk, rainRisk, humidityPestRisk, windRisk);

  return {
    heatRisk,
    rainRisk,
    frostRisk,
    humidityPestRisk,
    windRisk,
    overallWeatherRisk,
    reasons,
  };
}

export const _internal = { band, bandReverse, maxBand };
