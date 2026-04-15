import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { resolveFarmCoordinates, deriveWeatherContext } from '../lib/weatherProvider.js';

const router = express.Router();

/**
 * GET /api/v2/weather/current
 *
 * Returns real weather + derived risk flags for a farm location.
 * Uses Open-Meteo with 7-day forecast for risk derivation.
 * Accepts lat/lng or location text (geocodes via Open-Meteo).
 */
router.get('/current', authenticate, async (req, res) => {
  try {
    let lat = Number(req.query.lat);
    let lng = Number(req.query.lng);
    let resolvedLocation = null;

    // Resolve coordinates from lat/lng or location text
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const locationText = req.query.location;
      if (!locationText) {
        return res.status(400).json({ success: false, error: 'Provide lat/lng or location text' });
      }

      const coords = await resolveFarmCoordinates({
        latitude: null,
        longitude: null,
        locationName: locationText,
        country: locationText,
      });

      if (!coords) {
        return res.status(404).json({ success: false, error: `Could not find location: ${locationText}` });
      }

      lat = coords.lat;
      lng = coords.lng;
      resolvedLocation = locationText;
    }

    // Fetch current + 7-day forecast from Open-Meteo
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m` +
      `&daily=precipitation_sum,rain_sum,weather_code` +
      `&forecast_days=7&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
    const raw = await response.json();

    // Derive normalized weather context with risk flags
    const context = deriveWeatherContext(raw);
    const current = raw.current || {};

    return res.json({
      success: true,
      resolvedLocation,
      weather: {
        // Core current conditions (backward-compatible field names)
        temperature: current.temperature_2m ?? null,
        temperatureC: context.temperatureC,
        humidity: current.relative_humidity_2m ?? null,
        humidityPct: context.humidityPct,
        precipitation: current.precipitation ?? null,
        rain: current.rain ?? null,
        showers: current.showers ?? null,
        windSpeed: context.windSpeedKmh ?? current.wind_speed_10m ?? null,
        weatherCode: current.weather_code ?? null,
        cloudCover: current.cloud_cover ?? null,
        condition: context.condition,
        time: current.time ?? null,
        // Derived risk flags from 7-day forecast
        rainForecastMm: context.rainForecastMm,
        rainExpected: context.rainExpected,
        heavyRainRisk: context.heavyRainRisk,
        drySpellRisk: context.drySpellRisk,
        forecastDate: context.forecastDate,
      },
    });
  } catch (error) {
    console.error('GET /api/v2/weather/current failed:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to load weather' });
  }
});

export default router;
