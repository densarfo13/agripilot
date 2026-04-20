/**
 * weatherService.js — small, mockable weather abstraction used by
 * the planting-decision layer.
 *
 * Two layers:
 *
 *   summarizeWeather(raw) — pure mapper from a simple raw sample
 *     ({ tempC, precip7dMm, forecast7dMm, humidity? }) to a
 *     farmer-friendly summary with caution flags.
 *
 *   createWeatherService({ fetcher? }) — returns an object with a
 *     single async method `getSummary({ lat, lng, country, state,
 *     crop? })` that returns either a summary or a fallback
 *     "unavailable" object (never throws).
 *
 * Design goals:
 *   • v1 works with NO live provider — getSummary returns
 *     `{ status: 'unavailable' }` when no fetcher is injected.
 *   • Easy to wire a real provider later: pass an async `fetcher`
 *     to createWeatherService and return whatever shape its API
 *     uses; this module normalizes that raw sample via
 *     summarizeWeather.
 *   • Pure mapper is fully testable with hand-crafted inputs.
 */

// ─── Thresholds (rule-based, v1) ──────────────────────────────────
// Chosen as safe defaults for tropical + subtropical farming; tune
// later when we have real data.
const TEMP_HOT_C          = 35;     // excessive_heat above this
const TEMP_EXTREME_HOT_C  = 40;     // stronger caution
const PRECIP_LOW_7D_MM    = 10;     // past 7 days below → "low_rain"
const FORECAST_LOW_7D_MM  = 10;     // next 7 days below → "dry_ahead"

const STATUS = Object.freeze({
  OK:              'ok',
  LOW_RAIN:        'low_rain',
  DRY_AHEAD:       'dry_ahead',
  EXCESSIVE_HEAT:  'excessive_heat',
  UNCERTAIN:       'uncertain',
  UNAVAILABLE:     'unavailable',
});

/**
 * summarizeWeather — pure mapper. Accepts whatever subset of fields
 * is available and classifies the overall status + a cautions list.
 *
 *   input:
 *     tempC?            number     current or typical temp (°C)
 *     precip7dMm?       number     precipitation past 7 days (mm)
 *     forecast7dMm?     number     forecast precipitation next 7 days (mm)
 *     humidity?         number     0..100
 *     note?             string     pass-through diagnostic line
 *
 *   output:
 *     {
 *       status:      'ok' | 'low_rain' | 'dry_ahead' | 'excessive_heat'
 *                    | 'uncertain' | 'unavailable',
 *       cautions:    string[]            // stable codes the UI can map
 *       headlineKey: i18n key
 *       tempC:       pass-through
 *       precip7dMm:  pass-through
 *       forecast7dMm:pass-through
 *     }
 *
 * Returns `{ status: 'unavailable' }` when the caller doesn't
 * supply any numeric signal.
 */
export function summarizeWeather(raw = {}) {
  const tempC         = numOr(raw.tempC,         null);
  const precip7dMm    = numOr(raw.precip7dMm,    null);
  const forecast7dMm  = numOr(raw.forecast7dMm,  null);
  const humidity      = numOr(raw.humidity,      null);

  if (tempC == null && precip7dMm == null && forecast7dMm == null) {
    return Object.freeze({
      status: STATUS.UNAVAILABLE,
      cautions: Object.freeze([]),
      headlineKey: 'weather.summary.unavailable',
      tempC, precip7dMm, forecast7dMm, humidity,
    });
  }

  const cautions = [];
  if (tempC != null && tempC >= TEMP_EXTREME_HOT_C)  cautions.push('extreme_heat');
  if (tempC != null && tempC >= TEMP_HOT_C
      && !cautions.includes('extreme_heat'))          cautions.push('excessive_heat');
  if (precip7dMm != null && precip7dMm < PRECIP_LOW_7D_MM)  cautions.push('low_rain');
  if (forecast7dMm != null && forecast7dMm < FORECAST_LOW_7D_MM) cautions.push('dry_ahead');

  let status = STATUS.OK;
  if (cautions.includes('extreme_heat') || cautions.includes('excessive_heat')) {
    status = STATUS.EXCESSIVE_HEAT;
  } else if (cautions.includes('low_rain')) {
    status = STATUS.LOW_RAIN;
  } else if (cautions.includes('dry_ahead')) {
    status = STATUS.DRY_AHEAD;
  } else if (tempC == null && precip7dMm == null) {
    // We had one signal (forecast) but nothing solid — be honest.
    status = STATUS.UNCERTAIN;
  }

  const headlineKey = {
    ok:              'weather.summary.ok',
    low_rain:        'weather.summary.low_rain',
    dry_ahead:       'weather.summary.dry_ahead',
    excessive_heat:  'weather.summary.excessive_heat',
    uncertain:       'weather.summary.uncertain',
    unavailable:     'weather.summary.unavailable',
  }[status];

  return Object.freeze({
    status,
    cautions:   Object.freeze(cautions),
    headlineKey,
    tempC, precip7dMm, forecast7dMm, humidity,
  });
}

/**
 * createWeatherService — small factory that lets callers plug in a
 * real fetcher later without changing every consumer.
 *
 *   const ws = createWeatherService({ fetcher: async ({ lat, lng }) => {
 *     const r = await fetch(...);
 *     return await r.json();           // shape: { tempC, precip7dMm, forecast7dMm? }
 *   }});
 *   await ws.getSummary({ lat, lng, country, state });
 *
 * If no fetcher is provided, every call resolves to the safe
 * `{ status: 'unavailable' }` summary. Fetcher throws / returns null
 * are caught and collapse to the same fallback.
 */
export function createWeatherService({ fetcher } = {}) {
  async function getSummary(ctx = {}) {
    if (typeof fetcher !== 'function') return summarizeWeather({});
    try {
      const raw = await fetcher(ctx);
      if (!raw || typeof raw !== 'object') return summarizeWeather({});
      return summarizeWeather(raw);
    } catch {
      return summarizeWeather({});
    }
  }
  return Object.freeze({ getSummary });
}

function numOr(v, fallback) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export { STATUS };
export const _internal = Object.freeze({
  TEMP_HOT_C, TEMP_EXTREME_HOT_C, PRECIP_LOW_7D_MM, FORECAST_LOW_7D_MM,
});
