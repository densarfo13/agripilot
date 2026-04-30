/**
 * backyardExperience.js — copy + behaviour adapters for the
 * U.S. backyard / home-garden experience (spec §3).
 *
 * Strict-rule audit
 *   • Pure functions; no I/O.
 *   • No country checks here — the caller decides whether to
 *     switch to backyard via shouldUseBackyardExperience()
 *     from regionConfig.
 *   • Sell flow disabled by returning a flat false from
 *     `enableSellFlow` and `actions.actionType !== 'sell'`.
 */

/**
 * Per-key copy overrides. UI surfaces resolve a label by
 * passing the canonical farm-experience key through
 * `getBackyardLabel` — when the experience is 'farm', no
 * override is applied so the existing copy renders.
 */
const BACKYARD_LABELS = Object.freeze({
  // Navigation
  'nav.myFarm':        'My Garden',
  'nav.tasks':         'Tasks',
  // Daily plan
  'daily.farmFallback':'Your garden',
  // Photo
  'photo.scanCrop':    'Scan plant',
  // Voice / generic
  'voice.askFarroway': 'Ask Farroway',
});

/**
 * getBackyardLabel — small lookup with an English fallback.
 * Returns null when the key has no backyard override so
 * callers can fall through to their default.
 */
export function getBackyardLabel(key) {
  if (!key) return null;
  return BACKYARD_LABELS[key] || null;
}

/**
 * Spec §3 — three safe daily actions for a U.S. backyard
 * gardener. Used as a fallback when the farm-stage engine
 * can't supply a relevant plan (no planting date, unfamiliar
 * crop, etc).
 */
export function getBackyardDailyPlan(_context = {}) {
  return Object.freeze({
    summary: 'Here is what your garden needs today.',
    actions: Object.freeze([
      Object.freeze({
        id: 'backyard.checkPlants',
        title: 'Check your plants',
        reason: 'Look for dry soil, yellow leaves, or pests.',
        urgency: 'medium',
        actionType: 'inspect',
      }),
      Object.freeze({
        id: 'backyard.water',
        title: 'Water if soil feels dry',
        reason: 'Most home plants need water when the top soil feels dry.',
        urgency: 'medium',
        actionType: 'water',
      }),
      Object.freeze({
        id: 'backyard.scan',
        title: 'Take a photo if something looks wrong',
        reason: 'Farroway can help you understand possible plant issues.',
        urgency: 'low',
        actionType: 'scan_crop',
      }),
    ]),
  });
}

/**
 * Frost / heat watering nudge for backyard users (spec §8).
 * Pure rule — caller passes the weather snapshot; we return
 * an extra alert when the temperature crosses a backyard-
 * relevant threshold.
 */
export function getBackyardWeatherAlerts(weather) {
  const out = [];
  if (!weather) return out;

  if (typeof weather.temperatureC === 'number' && weather.temperatureC <= 4) {
    out.push({
      id: 'backyard.frost',
      title: 'Frost watch',
      message: 'Cover sensitive plants tonight or move pots indoors.',
      severity: 'critical',
    });
  }
  if (typeof weather.temperatureC === 'number' && weather.temperatureC >= 32) {
    out.push({
      id: 'backyard.heatWatering',
      title: 'Hot day in the garden',
      message: 'Water early in the morning so leaves dry before dusk.',
      severity: 'warning',
    });
  }
  return out;
}

/**
 * enableSellFlow — backyard users do not see Sell as a
 * primary action. Surfaces that need a single answer can
 * read this directly.
 */
export function enableSellFlow() { return false; }

export const _internal = Object.freeze({ BACKYARD_LABELS });
