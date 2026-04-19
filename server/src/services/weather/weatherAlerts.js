/**
 * weatherAlerts.js — turn a weather-risk payload into a short list
 * of farmer-facing alert strings that the Today screen renders
 * above the task card.
 *
 * Keep the output compact (max 3) and actionable — each alert is
 * already a short imperative sentence in WEATHER_CONFIG.reasons.
 * Duplicate trimming + cap happens here so the UI can just render.
 */

const MAX_ALERTS = 3;

export function getWeatherAlerts(risks) {
  if (!risks || !Array.isArray(risks.reasons)) return [];
  const seen = new Set();
  const out = [];
  for (const line of risks.reasons) {
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= MAX_ALERTS) break;
  }
  return out;
}

/** Helper the UI can use to render a simple weather risk badge. */
export function getWeatherBadge(risks) {
  if (!risks) return null;
  const level = risks.overallWeatherRisk || 'low';
  return {
    level,
    labelKey:
      level === 'high' ? 'weather.badge.high' :
      level === 'medium' ? 'weather.badge.medium' :
      'weather.badge.low',
    color: level === 'high' ? '#EF4444' : level === 'medium' ? '#F59E0B' : '#22C55E',
  };
}
