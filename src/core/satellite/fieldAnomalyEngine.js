/**
 * fieldAnomalyEngine.js — flags possible field-level anomalies
 * worth a closer look.
 *
 *   import { detectFieldAnomalies, ANOMALY_KIND }
 *     from 'src/core/satellite/fieldAnomalyEngine.js';
 *
 *   const a = detectFieldAnomalies({
 *     ndvi: 0.32,
 *     weather: { daysSinceRain: 12, temperatureC: 35 },
 *     scan: { issueCategory: 'water_stress' },
 *   });
 *   // a = [{ kind, severity, message, confidence }]
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small rules engine that returns 0+ field anomalies based
 *   on the signals it has. Each anomaly is hedged ("possible")
 *   and ranks low/medium/high severity.
 *
 *   It NEVER claims a confirmed pest outbreak, disease, or
 *   yield loss. It just flags "here's something a human should
 *   look at." If no signal is present, returns an empty array —
 *   honest silence.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

export const ANOMALY_KIND = Object.freeze({
  LOW_VEGETATION:   'low_vegetation',
  STRESS_PATTERN:   'stress_pattern',
  WATER_STRESS:     'water_stress',
  HEAT_STRESS:      'heat_stress',
  RAPID_CHANGE:     'rapid_change',
});

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

function _num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} ctx
 * @returns {Array<object>}
 */
export function detectFieldAnomalies(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const ndvi  = _num(c.ndvi);
    const w     = (c.weather && typeof c.weather === 'object') ? c.weather : null;
    const scan  = (c.scan    && typeof c.scan    === 'object') ? c.scan    : null;
    const prevNdvi = _num(c.prevNdvi);

    const out = [];

    // NDVI-driven anomalies (only when imagery is available)
    if (ndvi != null) {
      if (ndvi <= 0.2) {
        out.push({
          kind:       ANOMALY_KIND.LOW_VEGETATION,
          severity:   'medium',
          message:    _msg('satellite.anomaly.lowVeg',
                           'Vegetation looks sparse for this stage — worth a close look.'),
          confidence: 'low',
        });
      }
      if (prevNdvi != null && ndvi < prevNdvi - 0.15) {
        out.push({
          kind:       ANOMALY_KIND.RAPID_CHANGE,
          severity:   'high',
          message:    _msg('satellite.anomaly.rapidDrop',
                           'Vegetation index dropped quickly — check for water, pest, or disease stress.'),
          confidence: 'medium',
        });
      }
    }

    // Weather-driven stress patterns (don't need imagery)
    const days = w ? _num(w.daysSinceRain) : null;
    const temp = w ? _num(w.temperatureC) : null;
    if (days != null && days >= 10) {
      out.push({
        kind:       ANOMALY_KIND.WATER_STRESS,
        severity:   days >= 14 ? 'high' : 'medium',
        message:    _msg('satellite.anomaly.dry',
                         'Long dry spell — fields may be under water stress.'),
        confidence: 'low',
      });
    }
    if (temp != null && temp >= 36) {
      out.push({
        kind:       ANOMALY_KIND.HEAT_STRESS,
        severity:   'medium',
        message:    _msg('satellite.anomaly.heat',
                         'High temperatures — possible heat stress on sensitive crops.'),
        confidence: 'low',
      });
    }

    // Scan corroboration — when the user already saw water
    // stress on the ground, we promote the anomaly to higher
    // confidence so the surface treats it accordingly.
    if (scan && scan.issueCategory === 'water_stress') {
      const exists = out.find((x) => x.kind === ANOMALY_KIND.WATER_STRESS);
      if (exists) {
        exists.severity   = 'high';
        exists.confidence = 'medium';
      } else {
        out.push({
          kind:       ANOMALY_KIND.WATER_STRESS,
          severity:   'high',
          message:    _msg('satellite.anomaly.dry',
                           'Recent scan suggests water stress — confirm in the field.'),
          confidence: 'medium',
        });
      }
    }

    // Rank by severity (high → low)
    const _r = (a) => a.severity === 'high' ? 0 : a.severity === 'medium' ? 1 : 2;
    out.sort((a, b) => _r(a) - _r(b));

    return out;
  } catch { return []; }
}

const _module = { ANOMALY_KIND, detectFieldAnomalies };
export default _module;
