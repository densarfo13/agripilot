/**
 * weatherFusionEngine.js — fuses on-ground weather with any
 * satellite-derived weather signals available.
 *
 *   import { fuseWeather } from 'src/core/satellite/weatherFusionEngine.js';
 *
 *   const w = fuseWeather({
 *     weather:   { temperatureC: 30, rainProbability24hPct: 60 },
 *     satellite: { surfaceTempC: 33, cloudCoverPct: 70 },
 *   });
 *   // w.temperatureC, w.rainProbability24hPct, w.fusedConfidence
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small, defensive fusion layer that prefers the on-ground
 *   weather (from the OpenWeather / region-config feed) and
 *   only blends in satellite-derived signals when they are
 *   present AND look sane.
 *
 *   When no satellite payload is supplied (the normal case
 *   today, since no real provider is wired), it simply returns
 *   the on-ground weather unchanged. When BOTH are present it
 *   takes a weighted average (ground 70 %, satellite 30 %) for
 *   temperature, and the MAX of the two rain-probability
 *   numbers (rain pessimism — better to over-prepare).
 *
 *   It NEVER manufactures values. If `weather` is null AND
 *   `satellite` is null it returns null.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

function _num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} ctx
 * @returns {object|null}
 */
export function fuseWeather(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const g = (c.weather   && typeof c.weather   === 'object') ? c.weather   : null;
    const s = (c.satellite && typeof c.satellite === 'object') ? c.satellite : null;
    if (!g && !s) return null;

    const gTemp = g ? _num(g.temperatureC) : null;
    const sTemp = s ? _num(s.surfaceTempC) : null;
    const temperatureC = (() => {
      if (gTemp != null && sTemp != null) {
        // Reject outlier satellite reads (> 10 °C off ground) —
        // imagery is often skewed by clouds / time-of-day.
        if (Math.abs(gTemp - sTemp) > 10) return gTemp;
        return Math.round((gTemp * 0.7 + sTemp * 0.3) * 10) / 10;
      }
      return gTemp != null ? gTemp : sTemp;
    })();

    const gRain = g ? _num(g.rainProbability24hPct) : null;
    const sRain = s ? _num(s.rainProbability24hPct) : null;
    const rainProbability24hPct = (() => {
      if (gRain != null && sRain != null) return Math.max(gRain, sRain);
      return gRain != null ? gRain : sRain;
    })();

    const daysSinceRain = g ? _num(g.daysSinceRain) : null;
    const humidityPct   = g ? _num(g.humidityPct)   : null;
    const windKmh       = g ? _num(g.windKmh)       : null;
    const cloudCoverPct = s ? _num(s.cloudCoverPct) : (g ? _num(g.cloudCoverPct) : null);

    return {
      temperatureC,
      rainProbability24hPct,
      daysSinceRain,
      humidityPct,
      windKmh,
      cloudCoverPct,
      fusedConfidence: (g && s) ? 'medium' : 'low',
      sources: {
        ground:    !!g,
        satellite: !!s,
      },
    };
  } catch { return null; }
}

const _module = { fuseWeather };
export default _module;
