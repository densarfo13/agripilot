/**
 * predictiveRisk.js — rule-based predictive risk engine.
 *
 *   const risks = computePredictiveRisks({
 *     weather:        cachedWeatherSnapshot,
 *     cropName:       profile.crop,
 *     scanHistory:    history,
 *   });
 *   // → [{ kind, level, headline, action, factors }, ...]
 *
 * Why this exists (spec §2)
 * ─────────────────────────
 *   The spec asks us to predict fungal outbreaks, drought stress,
 *   pest pressure, nutrient risk, flooding, and harvest timing
 *   BEFORE visible symptoms appear. That target is partly an ML
 *   problem and partly a *signals* problem — many of these risks
 *   have well-known precursors (humidity → fungal, no rain →
 *   drought, heatwave → heat stress) that don't need ML to flag.
 *
 *   This engine surfaces the *signal-based* half honestly:
 *
 *     • Fungal risk      — sustained high humidity (≥75%) and warm
 *                          temperatures (≥20°C) plus a susceptible
 *                          crop (tomato, pepper, cassava, maize).
 *     • Drought stress   — multi-day no-rain run + above-normal temps.
 *     • Heat stress      — peak temp ≥34°C for ≥2 consecutive days.
 *     • Flood risk       — heavy rain forecast (≥30mm/24h) or
 *                          recent flood signal.
 *     • Recent-issue alert — when scan history flagged a high-severity
 *                          issue within the past 7 days, surface it
 *                          as a "watch closely" risk so the daily
 *                          briefing reminds the farmer.
 *
 *   Each risk carries a kind, a level (low/medium/high), a calm
 *   headline, an actionable next step, and the list of factors that
 *   fired. The dailyBriefing composer picks the top non-low risk
 *   and surfaces it.
 *
 *   What we deliberately DO NOT do
 *     • ML model inference (no model on-device yet).
 *     • Nutrient deficiency prediction without soil data.
 *     • Pest-pressure curves — those need regional aggregation that
 *       isn't built. We surface a *recent-issue* signal as the
 *       closest honest substitute.
 *     • Harvest-timing prediction without crop-stage data.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Returns [] when there are no signals to act on — caller
 *     renders nothing rather than a fake "all clear" badge.
 *   • All thresholds frozen for tests + future ops adjustment.
 */

export const RISK_THRESHOLDS = Object.freeze({
  FUNGAL_HUMIDITY_MIN:     75,    // % humidity sustaining fungal pressure
  FUNGAL_TEMP_MIN:         20,    // °C  warm enough for most fungal pathogens
  DROUGHT_DAYS_NO_RAIN:    7,     // consecutive dry days that trigger drought
  HEAT_STRESS_TEMP:        34,    // °C  threshold for heat stress
  FLOOD_RAINFALL_MM_24H:   30,    // mm  in 24h that flags flooding risk
  RECENT_ISSUE_WINDOW_MS:  7 * 24 * 60 * 60 * 1000,
});

// Crops known to be susceptible to fungal pressure under warm-humid
// conditions. The list is conservative — when the cropName isn't on
// the list, we still surface the weather signal but at one level
// lower confidence (the heuristic is general, not crop-specific).
const FUNGAL_SUSCEPTIBLE_CROPS = new Set([
  'tomato', 'tomatoes',
  'pepper', 'peppers',
  'cassava',
  'maize', 'corn',
  'cocoa',
  'plantain', 'banana',
  'rice',
  'yam',
]);

// ─── Helpers ──────────────────────────────────────────────────

function _num(v, fallback) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return fallback;
}

function _normCrop(c) {
  return String(c || '').toLowerCase().trim();
}

function _isoTime(iso) {
  if (!iso) return null;
  const t = Date.parse(String(iso));
  return Number.isNaN(t) ? null : t;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * @param {object} input
 * @param {object} [input.weather]      — snapshot with optional fields:
 *                                          tempC, temperature, maxTempC,
 *                                          humidity, daysNoRain,
 *                                          rainfallNext24h, floodSignal,
 *                                          consecutiveHotDays.
 * @param {string} [input.cropName]     — active crop, used for fungal
 *                                          susceptibility weighting.
 * @param {Array<object>} [input.scanHistory] — entries from scanHistoryStore.
 * @param {number} [input.nowMs]        — injection point for tests.
 * @returns {Array<{ kind, level, headline, action, factors }>}
 */
export function computePredictiveRisks(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const nowMs = (typeof safe.nowMs === 'number') ? safe.nowMs : Date.now();
  const weather = (safe.weather && typeof safe.weather === 'object') ? safe.weather : {};
  const crop = _normCrop(safe.cropName);
  const cropIsSusceptible = crop && FUNGAL_SUSCEPTIBLE_CROPS.has(crop);

  const risks = [];

  // ── Fungal risk ────────────────────────────────────────────
  // Sustained high humidity + warm temps is the cleanest signal we
  // can compute without disease-specific models. We surface as
  // medium for general crops; high when the crop is on the
  // susceptible list.
  const humidity = _num(weather.humidity, null);
  const tempC = _num(weather.tempC, _num(weather.temperature, null));
  if (humidity != null && humidity >= RISK_THRESHOLDS.FUNGAL_HUMIDITY_MIN
      && tempC != null && tempC >= RISK_THRESHOLDS.FUNGAL_TEMP_MIN) {
    risks.push({
      kind:    'fungal',
      level:   cropIsSusceptible ? 'high' : 'medium',
      headline: cropIsSusceptible
        ? `High humidity today increases fungal risk for ${crop}.`
        : 'High humidity today raises fungal pressure across most crops.',
      action: 'Delay irrigation until evening and check lower leaves for dark spots.',
      factors: [
        'humidity ' + Math.round(humidity) + '%',
        'temp '     + Math.round(tempC) + '°C',
        cropIsSusceptible ? 'crop:' + crop : 'crop:generic',
      ],
    });
  }

  // ── Drought stress ─────────────────────────────────────────
  const daysNoRain = _num(weather.daysNoRain, _num(weather.dryDays, null));
  if (daysNoRain != null && daysNoRain >= RISK_THRESHOLDS.DROUGHT_DAYS_NO_RAIN) {
    risks.push({
      kind:    'drought',
      level:   daysNoRain >= 14 ? 'high' : 'medium',
      headline: `No measurable rainfall in the last ${daysNoRain} days.`,
      action:  'Water in the early morning or after sunset to reduce evaporation loss.',
      factors: ['daysNoRain ' + daysNoRain],
    });
  }

  // ── Heat stress ────────────────────────────────────────────
  const maxTempC = _num(weather.maxTempC, _num(weather.maxTemperature, tempC));
  const hotDays  = _num(weather.consecutiveHotDays, null);
  if (maxTempC != null && maxTempC >= RISK_THRESHOLDS.HEAT_STRESS_TEMP) {
    risks.push({
      kind:    'heat',
      level:   (hotDays != null && hotDays >= 2) ? 'high' : 'medium',
      headline: `Peak temperature near ${Math.round(maxTempC)}°C${(hotDays != null && hotDays >= 2) ? ' on day ' + hotDays + ' of a hot streak' : ''}.`,
      action:  'Shade young transplants and water mid-afternoon if you can.',
      factors: [
        'maxTemp ' + Math.round(maxTempC) + '°C',
        ...(hotDays != null ? ['hotStreak ' + hotDays] : []),
      ],
    });
  }

  // ── Flood risk ─────────────────────────────────────────────
  const rainfall24h = _num(weather.rainfallNext24h, _num(weather.expectedRainfall24h, null));
  if (rainfall24h != null && rainfall24h >= RISK_THRESHOLDS.FLOOD_RAINFALL_MM_24H) {
    risks.push({
      kind:    'flood',
      level:   rainfall24h >= 60 ? 'high' : 'medium',
      headline: `Heavy rainfall expected (${Math.round(rainfall24h)} mm in 24h).`,
      action:  'Clear drainage channels around vulnerable rows before evening.',
      factors: ['rainfall24h ' + Math.round(rainfall24h) + 'mm'],
    });
  } else if (weather.floodSignal === true) {
    risks.push({
      kind:    'flood',
      level:   'medium',
      headline: 'Flood signal detected in your area.',
      action:  'Check drainage and move stored harvest above ground level.',
      factors: ['floodSignal'],
    });
  }

  // ── Recent-issue alert ─────────────────────────────────────
  // When a severe scan landed in the last 7 days, surface it as a
  // calm reminder. We're not predicting a NEW issue here — we're
  // reminding the user the previous one needs follow-through.
  const history = Array.isArray(safe.scanHistory) ? safe.scanHistory : [];
  const recentSevere = history.find((e) => {
    if (!e) return false;
    const t = _isoTime(e.createdAt);
    if (t === null) return false;
    if ((nowMs - t) > RISK_THRESHOLDS.RECENT_ISSUE_WINDOW_MS) return false;
    const sev = String(e.severity || '').toLowerCase();
    return sev === 'high' || sev === 'medium';
  });
  if (recentSevere) {
    const ageDays = Math.max(1, Math.round((nowMs - _isoTime(recentSevere.createdAt)) / (24 * 60 * 60 * 1000)));
    const noticed = recentSevere.noticed ? String(recentSevere.noticed) : 'an issue';
    risks.push({
      kind:    'recent_issue',
      level:   'medium',
      headline: `Watch closely: ${noticed} flagged ${ageDays} day${ageDays === 1 ? '' : 's'} ago.`,
      action:  'Re-check the affected plants today to track if it is spreading.',
      factors: ['recent_scan_id:' + (recentSevere.id || 'unknown')],
    });
  }

  return risks;
}

export default { computePredictiveRisks, RISK_THRESHOLDS };
