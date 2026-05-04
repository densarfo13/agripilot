/**
 * publicRoute.js — clean GET /api/weather endpoint for the pilot
 * Weather → Task pipeline (May 2026 spec).
 *
 *   GET /api/weather?lat=<num>&lng=<num>&region=<string>
 *
 * Contract
 *   • Always returns HTTP 200 (never 4xx/5xx for the frontend).
 *     Bad inputs OR provider failures both return the documented
 *     fallback shape so useWeatherSafe can render a sane UI.
 *   • No authentication. No rate-limit beyond the global Express
 *     rate-limit. Pilot home calls this on every dashboard mount;
 *     the underlying weatherProvider.js cache (30-min, in-memory,
 *     keyed by rounded lat/lon) keeps the upstream Open-Meteo
 *     traffic flat.
 *   • Normalized response shape:
 *
 *       {
 *         temp:          number | null,      // °C, integer-rounded
 *         condition:     string,
 *         rainChance:    number | null,      // %, 0-100
 *         windSpeed:     number | null,      // km/h, integer-rounded
 *         locationLabel: string,
 *         source:        'weather-api' | 'fallback',
 *       }
 *
 *     `condition` is a short human-friendly label derived from
 *     the temperature / rain probability / wind so the frontend
 *     never needs an icon-mapping table to render the headline.
 *
 * Strict-rule audit
 *   • Never throws. Provider failure → fallback shape.
 *   • Never logs PII (no IP, no user info, no full coords).
 *   • No DB access. Pure pass-through to the existing weather
 *     provider that uses Open-Meteo (no API key required).
 */

import { Router } from 'express';
import { getWeatherForFarm } from '../../services/weather/weatherProvider.js';

const router = Router();

const FALLBACK_RESPONSE = Object.freeze({
  temp:          null,
  condition:     'Weather unavailable',
  rainChance:    null,
  windSpeed:     null,
  locationLabel: 'Your area',
  source:        'fallback',
});

/**
 * Translate the weatherProvider's normalized payload into the
 * frontend-facing shape the pilot Home renders. Never throws.
 */
function _toPublicShape(provider, locationLabel) {
  if (!provider || typeof provider !== 'object') return null;
  const tempHigh = Number.isFinite(provider.tempHighC) ? provider.tempHighC : null;
  const rain = Number.isFinite(provider.rainChancePct) ? provider.rainChancePct : null;
  const wind = Number.isFinite(provider.windKph) ? provider.windKph : null;
  const condition = _summariseCondition({ tempHigh, rain, wind });
  return {
    temp:          tempHigh != null ? Math.round(tempHigh) : null,
    condition,
    rainChance:    rain != null ? Math.round(rain) : null,
    windSpeed:     wind != null ? Math.round(wind) : null,
    locationLabel,
    source:        'weather-api',
  };
}

function _summariseCondition({ tempHigh, rain, wind }) {
  if (rain != null && rain >= 60) return 'Rain likely';
  if (tempHigh != null && tempHigh >= 32) return 'Hot day';
  if (wind != null && wind >= 25) return 'Windy';
  if (tempHigh != null && tempHigh < 12) return 'Cold';
  if (rain != null && rain <= 20 && tempHigh != null) return 'Clear and dry';
  return 'Mild conditions';
}

function _coerceLat(raw) {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < -90 || n > 90) return null;
  return n;
}

function _coerceLng(raw) {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < -180 || n > 180) return null;
  return n;
}

function _coerceRegion(raw) {
  if (typeof raw !== 'string') return '';
  const v = raw.trim().slice(0, 80); // hard cap
  return v;
}

router.get('/', async (req, res) => {
  try {
    const lat    = _coerceLat(req.query.lat);
    const lng    = _coerceLng(req.query.lng);
    const region = _coerceRegion(req.query.region);
    const locationLabel = region || 'Your area';

    // No coordinates → fallback. Region label is preserved so
    // the frontend can still render "Weather in <region>".
    if (lat == null || lng == null) {
      return res.status(200).json({
        ...FALLBACK_RESPONSE,
        locationLabel,
      });
    }

    let provider = null;
    try {
      provider = await getWeatherForFarm({ latitude: lat, longitude: lng });
    } catch {
      provider = null;
    }

    const publicShape = _toPublicShape(provider, locationLabel);
    if (!publicShape) {
      return res.status(200).json({
        ...FALLBACK_RESPONSE,
        locationLabel,
      });
    }

    return res.status(200).json(publicShape);
  } catch {
    // Defence in depth — even a top-level throw resolves to 200
    // with the fallback shape so the frontend never sees 4xx/5xx
    // from this endpoint.
    return res.status(200).json(FALLBACK_RESPONSE);
  }
});

export default router;

// Test hooks.
export const _internal = Object.freeze({
  FALLBACK_RESPONSE,
  _toPublicShape,
  _summariseCondition,
  _coerceLat,
  _coerceLng,
  _coerceRegion,
});
