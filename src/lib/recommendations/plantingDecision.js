/**
 * plantingDecision.js — combines the planting calendar and the
 * optional weather summary into ONE farmer-facing status per crop.
 *
 *   decidePlanting({ country, state, crop, weather?, now? })
 *     → {
 *         status:       'good_to_plant' | 'plant_soon'
 *                     | 'wait_monitor'  | 'not_recommended'
 *                     | 'unsupported',
 *         headlineKey:  i18n key
 *         nextStepKey:  i18n key
 *         calendar:     {status, windows, source, daysToNextWindow}
 *         weatherStatus:'ok' | 'low_rain' | 'dry_ahead' | 'excessive_heat'
 *                     | 'uncertain' | 'unavailable'
 *         cautions:     string[]         // stable codes, e.g. ['low_rain']
 *       }
 *
 * Rule ladder (spec §4):
 *
 *   1. If calendar says in_season:
 *        • weather ok / unavailable / uncertain → good_to_plant
 *        • weather has excessive_heat           → wait_monitor
 *        • weather has low_rain / dry_ahead     → wait_monitor
 *          (farmers with irrigation can still proceed — we just
 *           surface the caution; status stays "wait_monitor")
 *   2. If calendar says plant_soon:
 *        • weather ok / unavailable             → plant_soon
 *        • weather has cautions                 → wait_monitor
 *   3. If calendar says off_season                → not_recommended
 *   4. If calendar says unknown AND country has
 *      ANY calendar entries                     → not_recommended
 *   5. Country has no calendar entries at all   → unsupported
 *      (UI shows a safe generic message; nothing harmful
 *       gets persisted.)
 */

import { getPlantingStatus } from './plantingCalendar.js';
import { CALENDAR } from '../../config/plantingCalendar.js';
import { STATUS as WEATHER_STATUS } from '../weather/weatherService.js';

const STATUS = Object.freeze({
  GOOD_TO_PLANT:    'good_to_plant',
  PLANT_SOON:       'plant_soon',
  WAIT_MONITOR:     'wait_monitor',
  NOT_RECOMMENDED:  'not_recommended',
  UNSUPPORTED:      'unsupported',
});

const HEADLINE_KEY = Object.freeze({
  good_to_plant:   'planting.decision.good_to_plant',
  plant_soon:      'planting.decision.plant_soon',
  wait_monitor:    'planting.decision.wait_monitor',
  not_recommended: 'planting.decision.not_recommended',
  unsupported:     'planting.decision.unsupported',
});

const NEXT_STEP_KEY = Object.freeze({
  good_to_plant:   'planting.next_step.good_to_plant',
  plant_soon:      'planting.next_step.plant_soon',
  wait_monitor:    'planting.next_step.wait_monitor',
  not_recommended: 'planting.next_step.not_recommended',
  unsupported:     'planting.next_step.unsupported',
});

function countryHasAnyCalendar(country) {
  if (!country) return false;
  return !!CALENDAR[String(country).toUpperCase()];
}

function weatherIsOkish(ws) {
  return ws === WEATHER_STATUS.OK
      || ws === WEATHER_STATUS.UNAVAILABLE
      || ws === WEATHER_STATUS.UNCERTAIN;
}

function weatherIsCautious(ws) {
  return ws === WEATHER_STATUS.EXCESSIVE_HEAT
      || ws === WEATHER_STATUS.LOW_RAIN
      || ws === WEATHER_STATUS.DRY_AHEAD;
}

export function decidePlanting({
  country, state, crop, weather = null, now = undefined,
} = {}) {
  const cal = getPlantingStatus({ country, state, crop, now });
  const ws = (weather && typeof weather === 'object' && weather.status)
    ? weather.status
    : WEATHER_STATUS.UNAVAILABLE;
  const cautions = Array.isArray(weather?.cautions) ? weather.cautions : [];

  let status;
  if (cal.status === 'unknown') {
    status = countryHasAnyCalendar(country)
      ? STATUS.NOT_RECOMMENDED
      : STATUS.UNSUPPORTED;
  } else if (cal.status === 'off_season') {
    status = STATUS.NOT_RECOMMENDED;
  } else if (cal.status === 'plant_soon') {
    status = weatherIsCautious(ws) ? STATUS.WAIT_MONITOR : STATUS.PLANT_SOON;
  } else if (cal.status === 'in_season') {
    if (weatherIsOkish(ws))     status = STATUS.GOOD_TO_PLANT;
    else if (weatherIsCautious(ws)) status = STATUS.WAIT_MONITOR;
    else                        status = STATUS.GOOD_TO_PLANT;
  } else {
    status = STATUS.UNSUPPORTED;
  }

  return Object.freeze({
    status,
    headlineKey:   HEADLINE_KEY[status],
    nextStepKey:   NEXT_STEP_KEY[status],
    calendar:      cal,
    weatherStatus: ws,
    cautions:      Object.freeze(cautions.slice()),
    daysToNextWindow: cal.daysToNextWindow,
  });
}

/**
 * annotateRecommendations — helper that decorates a
 * recommendCropsForScreen result with `decision` fields so the
 * screen can render a single status badge + next-step line per
 * crop without knowing anything about the calendar or weather.
 *
 *   annotateRecommendations(items, { country, state, weather, now })
 *     → same array, each item augmented with:
 *        decisionStatus, decisionHeadlineKey, decisionNextStepKey,
 *        weatherStatus, cautions, daysToNextWindow
 */
export function annotateRecommendations(items, ctx = {}) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const d = decidePlanting({
      country: ctx.country,
      state:   ctx.state,
      crop:    item.crop,
      weather: ctx.weather || null,
      now:     ctx.now,
    });
    return Object.freeze({
      ...item,
      decisionStatus:       d.status,
      decisionHeadlineKey:  d.headlineKey,
      decisionNextStepKey:  d.nextStepKey,
      weatherStatus:        d.weatherStatus,
      cautions:             d.cautions,
      daysToNextWindow:     d.daysToNextWindow,
    });
  });
}

export { STATUS };
export const _internal = Object.freeze({
  HEADLINE_KEY, NEXT_STEP_KEY,
  countryHasAnyCalendar, weatherIsOkish, weatherIsCautious,
});
