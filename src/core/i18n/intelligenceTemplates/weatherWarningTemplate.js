/**
 * weatherWarningTemplate.js — hedged weather-warning envelope.
 */

const _KIND = new Set(['rain', 'heat', 'frost', 'wind', 'drought']);

function _kind(k) {
  const v = String(k || '').toLowerCase();
  return _KIND.has(v) ? v : 'rain';
}

export function weatherWarningTemplate(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const kind = _kind(c.kind);
    const FALLBACK = {
      rain:    'Rain likely in the next 24 hours — consider skipping watering today.',
      heat:    'High temperatures expected — water early to ease stress.',
      frost:   'Frost possible tonight — protect sensitive crops.',
      wind:    'Strong winds expected — delay spraying.',
      drought: 'Dry spell continuing — consider mulch to hold soil moisture.',
    };
    return {
      key: 'intelligence.weather.' + kind,
      fallback: FALLBACK[kind],
      params: { kind, hoursAhead: Number.isFinite(Number(c.hoursAhead)) ? Number(c.hoursAhead) : 24 },
    };
  } catch {
    return {
      key: 'intelligence.weather.rain',
      fallback: 'Weather may affect your plan today.',
      params: {},
    };
  }
}

const _module = { weatherWarningTemplate };
export default _module;
