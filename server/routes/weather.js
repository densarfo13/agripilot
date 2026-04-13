import express from 'express';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

async function geocodeLocation(locationText) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationText)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;
  return { lat: result.latitude, lng: result.longitude, name: result.name };
}

router.get('/current', authenticate, async (req, res) => {
  try {
    let lat = Number(req.query.lat);
    let lng = Number(req.query.lng);
    let resolvedLocation = null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const locationText = req.query.location;
      if (!locationText) {
        return res.status(400).json({
          success: false,
          error: 'Valid lat/lng or location text is required',
        });
      }

      const geo = await geocodeLocation(locationText);
      if (!geo) {
        return res.status(404).json({
          success: false,
          error: `Could not geocode location: ${locationText}`,
        });
      }

      lat = geo.lat;
      lng = geo.lng;
      resolvedLocation = geo.name;
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lng)}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m` +
      `&timezone=auto`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather upstream failed: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current || {};

    return res.json({
      success: true,
      resolvedLocation,
      weather: {
        temperature: current.temperature_2m ?? null,
        humidity: current.relative_humidity_2m ?? null,
        precipitation: current.precipitation ?? null,
        rain: current.rain ?? null,
        showers: current.showers ?? null,
        weatherCode: current.weather_code ?? null,
        cloudCover: current.cloud_cover ?? null,
        windSpeed: current.wind_speed_10m ?? null,
        time: current.time ?? null,
      },
    });
  } catch (error) {
    console.error('GET /api/v2/weather/current failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load weather',
    });
  }
});

export default router;
