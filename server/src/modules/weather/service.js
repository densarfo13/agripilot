/**
 * Weather Service
 *
 * Handles fetching, caching, and fallback logic for weather data.
 * Stores lightweight snapshots per farm profile.
 */

import prisma from '../../config/database.js';
import { config } from '../../config/index.js';
import { fetchWeather, FALLBACK_WEATHER } from './provider.js';

const CACHE_TTL_MS = (config.weather.cacheTtlMinutes || 30) * 60 * 1000;

// ─── Get weather for coordinates (with caching) ────────

/**
 * Get weather for a farm profile. Uses cache if fresh, otherwise fetches live.
 * @param {string} farmProfileId
 * @returns {Promise<{weather: Object, source: string}>}
 */
export async function getWeatherForFarm(farmProfileId) {
  const profile = await prisma.farmProfile.findUnique({
    where: { id: farmProfileId },
    select: { id: true, latitude: true, longitude: true, locationName: true },
  });
  if (!profile) {
    const err = new Error('Farm profile not found');
    err.statusCode = 404;
    throw err;
  }

  if (profile.latitude == null || profile.longitude == null) {
    return { weather: { ...FALLBACK_WEATHER, fetchedAt: new Date().toISOString() }, source: 'fallback' };
  }

  return getWeatherByCoords(profile.latitude, profile.longitude, farmProfileId);
}

/**
 * Get weather by lat/lng. Checks cache for farmProfileId if provided.
 * @param {number} lat
 * @param {number} lng
 * @param {string|null} farmProfileId - optional, for caching
 * @returns {Promise<{weather: Object, source: string}>}
 */
export async function getWeatherByCoords(lat, lng, farmProfileId = null) {
  // Check cache first
  if (farmProfileId) {
    const cached = await getCachedWeather(farmProfileId);
    if (cached) return { weather: cached, source: 'cached' };
  }

  // Fetch live
  try {
    const weather = await fetchWeather(lat, lng);

    // Store snapshot if we have a farm profile
    if (farmProfileId) {
      await storeSnapshot(farmProfileId, lat, lng, weather).catch(() => {});
    }

    return { weather, source: 'live' };
  } catch (err) {
    console.error(`[weather] Failed to fetch live weather: ${err.message}`);

    // Try stale cache
    if (farmProfileId) {
      const stale = await getLatestSnapshot(farmProfileId);
      if (stale) {
        return {
          weather: snapshotToWeather(stale),
          source: 'cached',
        };
      }
    }

    // Final fallback
    return { weather: { ...FALLBACK_WEATHER, fetchedAt: new Date().toISOString() }, source: 'fallback' };
  }
}

// ─── Cache helpers ─────────────────────────────────────

async function getCachedWeather(farmProfileId) {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  const snapshot = await prisma.weatherSnapshot.findFirst({
    where: { farmProfileId, fetchedAt: { gte: cutoff } },
    orderBy: { fetchedAt: 'desc' },
  });
  return snapshot ? snapshotToWeather(snapshot) : null;
}

async function getLatestSnapshot(farmProfileId) {
  return prisma.weatherSnapshot.findFirst({
    where: { farmProfileId },
    orderBy: { fetchedAt: 'desc' },
  });
}

async function storeSnapshot(farmProfileId, lat, lng, weather) {
  return prisma.weatherSnapshot.create({
    data: {
      farmProfileId,
      latitude: lat,
      longitude: lng,
      temperatureC: weather.temperatureC ?? 0,
      rainForecastMm: weather.rainForecastMm ?? 0,
      humidityPct: weather.humidityPct,
      windSpeedKmh: weather.windSpeedKmh,
      condition: weather.condition,
      forecastDays: weather.forecastDays || 3,
      source: weather.source || 'open-meteo',
    },
  });
}

function snapshotToWeather(snapshot) {
  return {
    temperatureC: snapshot.temperatureC,
    rainForecastMm: snapshot.rainForecastMm,
    humidityPct: snapshot.humidityPct,
    windSpeedKmh: snapshot.windSpeedKmh,
    condition: snapshot.condition,
    forecastDays: snapshot.forecastDays,
    source: snapshot.source,
    fetchedAt: snapshot.fetchedAt.toISOString(),
  };
}

// ─── Weather-enriched recommendation logic ─────────────

/**
 * Generate weather-aware recommendations for a farm.
 * @param {Object} params
 * @param {string} params.farmProfileId
 * @param {string} params.crop
 * @param {string} params.stage
 * @param {Object} [params.weather] - explicit weather override
 * @returns {Promise<{recommendations: Array, weatherContext: Object}>}
 */
export async function getWeatherRecommendations({ farmProfileId, crop, stage, weather: explicitWeather, extra = {} }) {
  let weatherData, weatherSource;

  if (explicitWeather && explicitWeather.temperatureC != null) {
    weatherData = explicitWeather;
    weatherSource = 'request';
  } else if (farmProfileId) {
    const result = await getWeatherForFarm(farmProfileId);
    weatherData = result.weather;
    weatherSource = result.source;
  } else {
    weatherData = { ...FALLBACK_WEATHER, fetchedAt: new Date().toISOString() };
    weatherSource = 'fallback';
  }

  const recommendations = buildWeatherRecommendations(crop, stage, weatherData, extra);

  return {
    recommendations,
    weatherContext: {
      source: weatherSource,
      temperatureC: weatherData.temperatureC,
      rainForecastMm: weatherData.rainForecastMm,
      humidityPct: weatherData.humidityPct,
      condition: weatherData.condition,
      fetchedAt: weatherData.fetchedAt,
    },
  };
}

// ─── Recommendation rules engine ───────────────────────

function buildWeatherRecommendations(crop, stage, weather, extra = {}) {
  const recs = [];
  const temp = weather.temperatureC;
  const rain = weather.rainForecastMm;
  const humidity = weather.humidityPct;
  const { soilMoisture, pestRisk, daysSinceLastFertilizer, marketPriceTrend } = extra;

  // Rain preparation
  if (rain > 20) {
    recs.push({
      title: 'Heavy rain expected',
      action: 'Delay fertilizer and pesticide application until after rain passes to prevent runoff and waste.',
      urgency: 'high',
      confidence: 0.85,
      reason: `${rain}mm of rain forecast in the next 3 days. Applying chemicals before heavy rain leads to significant losses.`,
      nextReviewDays: 2,
      score: 0.9,
    });
  } else if (rain > 5) {
    recs.push({
      title: 'Moderate rain expected',
      action: 'Monitor soil moisture before irrigating. Rain may provide adequate water.',
      urgency: 'medium',
      confidence: 0.75,
      reason: `${rain}mm of rain forecast. Natural rainfall may reduce irrigation needs.`,
      nextReviewDays: 3,
      score: 0.7,
    });
  }

  // Temperature stress
  if (temp != null && temp > 35) {
    recs.push({
      title: 'High temperature alert',
      action: 'Increase irrigation frequency and consider mulching to retain soil moisture.',
      urgency: 'high',
      confidence: 0.8,
      reason: `Current temperature is ${temp}°C. ${crop || 'Crops'} experience heat stress above 35°C, which can reduce yields.`,
      nextReviewDays: 1,
      score: 0.85,
    });
  } else if (temp != null && temp < 10) {
    recs.push({
      title: 'Low temperature warning',
      action: 'Protect seedlings with covers if possible. Delay transplanting until temperatures rise.',
      urgency: 'medium',
      confidence: 0.7,
      reason: `Current temperature is ${temp}°C. Cold stress slows growth and can damage young plants.`,
      nextReviewDays: 2,
      score: 0.7,
    });
  }

  // Irrigation guidance (dry + hot)
  if (temp != null && temp > 28 && rain < 5 && humidity != null && humidity < 40) {
    recs.push({
      title: 'Irrigation recommended',
      action: 'Water crops in early morning or late evening to minimize evaporation loss.',
      urgency: 'high',
      confidence: 0.8,
      reason: `Hot (${temp}°C), dry (${humidity}% humidity), and no significant rain expected. Soil moisture is likely low.`,
      nextReviewDays: 2,
      score: 0.8,
    });
  }

  // Fertilizer timing
  if (stage === 'growing' && rain >= 2 && rain <= 10) {
    recs.push({
      title: 'Good time to fertilize',
      action: 'Apply fertilizer now — light rain helps absorption without runoff.',
      urgency: 'medium',
      confidence: 0.7,
      reason: `Light rain (${rain}mm) expected during growing stage. Moisture aids nutrient uptake.`,
      nextReviewDays: 7,
      score: 0.65,
    });
  }

  // Flowering stage + rain risk
  if (stage === 'flowering' && rain > 15) {
    recs.push({
      title: 'Flowering period rain risk',
      action: 'Monitor for fungal diseases. Consider preventive fungicide if rain persists.',
      urgency: 'medium',
      confidence: 0.7,
      reason: `Heavy moisture during flowering increases disease risk for ${crop || 'crops'}.`,
      nextReviewDays: 3,
      score: 0.7,
    });
  }

  // Harvest window
  if (stage === 'harvest' && rain > 10) {
    recs.push({
      title: 'Harvest timing alert',
      action: 'Harvest before heavy rain if crops are ready. Wet conditions can damage stored produce.',
      urgency: 'high',
      confidence: 0.8,
      reason: `${rain}mm rain forecast. Harvesting before rain prevents crop spoilage and storage losses.`,
      nextReviewDays: 1,
      score: 0.85,
    });
  }

  // Soil moisture guidance
  if (soilMoisture != null) {
    if (soilMoisture < 20) {
      recs.push({
        title: 'Soil moisture critically low',
        action: 'Irrigate immediately. Consider drip irrigation to conserve water.',
        urgency: 'high',
        confidence: 0.85,
        reason: `Soil moisture at ${soilMoisture}%. Crops need at least 20% for healthy root uptake.`,
        nextReviewDays: 1,
        score: 0.9,
      });
    } else if (soilMoisture > 80 && rain > 5) {
      recs.push({
        title: 'Waterlogging risk',
        action: 'Ensure drainage channels are clear. Avoid additional irrigation.',
        urgency: 'medium',
        confidence: 0.75,
        reason: `Soil moisture at ${soilMoisture}% with ${rain}mm rain expected. Excess water damages roots.`,
        nextReviewDays: 2,
        score: 0.75,
      });
    }
  }

  // Pest risk alert
  if (pestRisk != null && pestRisk > 0.6) {
    const urgency = pestRisk > 0.8 ? 'high' : 'medium';
    recs.push({
      title: 'Elevated pest risk',
      action: 'Scout fields for pest damage. Apply targeted pest control if infestation is confirmed.',
      urgency,
      confidence: 0.7,
      reason: `Pest risk index is ${Math.round(pestRisk * 100)}%${humidity > 60 ? `. High humidity (${humidity}%) favours pest activity.` : '.'}`,
      nextReviewDays: 3,
      score: pestRisk > 0.8 ? 0.85 : 0.7,
    });
  }

  // Fertilizer timing based on days since last application
  if (daysSinceLastFertilizer != null) {
    if (daysSinceLastFertilizer > 30 && stage === 'growing') {
      recs.push({
        title: 'Fertilizer application overdue',
        action: 'Apply top-dressing fertilizer to support continued growth.',
        urgency: 'medium',
        confidence: 0.7,
        reason: `Last fertilizer was ${daysSinceLastFertilizer} days ago during growing stage. Nutrient depletion slows development.`,
        nextReviewDays: 5,
        score: 0.7,
      });
    } else if (daysSinceLastFertilizer < 7 && rain > 15) {
      recs.push({
        title: 'Recent fertilizer at risk',
        action: 'Monitor for nutrient runoff. Reapply lighter dose after rain if needed.',
        urgency: 'medium',
        confidence: 0.65,
        reason: `Fertilizer applied ${daysSinceLastFertilizer} days ago and ${rain}mm rain forecast. Heavy rain can wash away nutrients.`,
        nextReviewDays: 3,
        score: 0.65,
      });
    }
  }

  // Market price trend
  if (marketPriceTrend === 'rising' && stage === 'harvest') {
    recs.push({
      title: 'Market prices rising',
      action: 'Consider holding harvest briefly if storage conditions allow — prices trending upward.',
      urgency: 'low',
      confidence: 0.6,
      reason: `Market prices for ${crop || 'your crop'} are trending upward. Timing your sale can improve returns.`,
      nextReviewDays: 5,
      score: 0.6,
    });
  } else if (marketPriceTrend === 'falling' && stage === 'harvest') {
    recs.push({
      title: 'Market prices declining',
      action: 'Sell harvested produce soon to avoid further price drops.',
      urgency: 'high',
      confidence: 0.65,
      reason: `Market prices for ${crop || 'your crop'} are falling. Early sale minimises losses.`,
      nextReviewDays: 2,
      score: 0.8,
    });
  }

  // Default recommendation if nothing else triggered
  if (recs.length === 0) {
    recs.push({
      title: 'Conditions look good',
      action: 'Continue normal farm activities. No weather concerns for the next few days.',
      urgency: 'low',
      confidence: 0.6,
      reason: weather.condition
        ? `Current conditions: ${weather.condition}, ${temp}°C.`
        : 'No significant weather events expected.',
      nextReviewDays: 5,
      score: 0.5,
    });
  }

  return recs;
}
