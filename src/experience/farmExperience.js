/**
 * farmExperience.js — adapters for the smallholder-farm
 * experience used across Ghana / Nigeria / Kenya / India /
 * Philippines / Indonesia / Brazil / Mexico (mixed) (spec §4).
 *
 * Pure / no I/O. The daily intelligence engine and the daily
 * plan card both call into this file when the active region
 * config has experience === 'farm' (or 'mixed' falling back
 * to farm-style copy for non-backyard farm types).
 */

/**
 * Spec §4 — three safe daily actions for a smallholder farm.
 * Used as a fallback when the stage engine can't fill three
 * slots, AND as the canonical copy for the daily card's
 * "no manual override" case.
 */
export function getFarmDailyPlan(_context = {}) {
  return Object.freeze({
    summary: 'Here is what your farm needs today.',
    actions: Object.freeze([
      Object.freeze({
        id: 'farm.checkCrop',
        title: 'Check your crop today',
        reason: 'Early inspection helps catch pest or disease issues before they spread.',
        urgency: 'medium',
        actionType: 'inspect',
      }),
      Object.freeze({
        id: 'farm.water',
        title: 'Water only if soil is dry',
        reason: 'Avoid overwatering, especially if rain is expected.',
        urgency: 'medium',
        actionType: 'water',
      }),
      Object.freeze({
        id: 'farm.scan',
        title: 'Scan crop if you see damage',
        reason: 'A photo can help identify possible issues early.',
        urgency: 'low',
        actionType: 'scan_crop',
      }),
    ]),
  });
}

/**
 * Region-aware weather alert helper. Honors weatherFocus from
 * regionConfig so a Philippine typhoon warning is louder than
 * the same wind speed in Ghana.
 *
 * Caller passes the weather snapshot AND the focus list (e.g.
 * regionConfig.weatherFocus). Returns extra alerts to merge
 * on top of the base weatherTaskRules output.
 */
export function getFarmWeatherFocusAlerts(weather, weatherFocus = []) {
  const out = [];
  if (!weather || !Array.isArray(weatherFocus)) return out;
  const focus = new Set(weatherFocus);

  // Typhoon focus (Philippines) — escalate any heavy-rain or
  // high-wind signal to critical.
  if (focus.has('typhoon')
      && (weather.heavyRainRisk
          || (typeof weather.windSpeedKph === 'number' && weather.windSpeedKph >= 40))) {
    out.push({
      id: 'farm.typhoonRisk',
      title: 'Typhoon-level conditions',
      message: 'Stake young plants, drain low-lying beds, and stay indoors until winds drop.',
      severity: 'critical',
    });
  }

  // Monsoon focus (India) — surface a multi-day rain heads-up
  // when the forecast shows persistent rain.
  if (focus.has('monsoon') && weather.rainExpected) {
    out.push({
      id: 'farm.monsoon',
      title: 'Monsoon active',
      message: 'Plan field work around dry windows; check drainage every few days.',
      severity: 'info',
    });
  }

  // Drought focus (Kenya) — escalate dry-spell when the
  // region cares about it.
  if (focus.has('drought') && weather.drySpellRisk) {
    out.push({
      id: 'farm.drought',
      title: 'Drought watch',
      message: 'Mulch beds, water at root level, and prioritise the most stressed plants.',
      severity: 'warning',
    });
  }

  // Flood focus (Indonesia) — like typhoon but emphasises
  // standing water rather than wind.
  if (focus.has('flood') && weather.heavyRainRisk) {
    out.push({
      id: 'farm.flood',
      title: 'Flood risk',
      message: 'Open drainage channels and move stored produce above ground level.',
      severity: 'critical',
    });
  }

  return out;
}

/**
 * enableSellFlow — defers to the region config. Callers
 * should pass `regionConfig.enableSellFlow` rather than
 * computing it themselves.
 */
export function enableSellFlow(regionConfig) {
  return !!(regionConfig && regionConfig.enableSellFlow);
}

/**
 * enableNgoReporting — reads through the region config too.
 */
export function enableNgoReporting(regionConfig) {
  return !!(regionConfig && regionConfig.enableNgoReporting);
}
