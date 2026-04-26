/**
 * FarmWeatherCard — compact weather display for a specific farm.
 *
 * Fetches weather from GET /api/v2/farm-weather/:farmId.
 * Shows condition, temperature, rain outlook, risk flags, forecast date.
 * Farm-scoped: clears and re-fetches when currentFarmId changes.
 * Dark theme, low-literacy friendly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { getFarmWeather } from '../lib/api.js';
import { useNetwork } from '../context/NetworkContext.jsx';

export default function FarmWeatherCard() {
  const { currentFarmId, profile } = useProfile();
  const { isOnline } = useNetwork();
  const { t } = useTranslation();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [noLocation, setNoLocation] = useState(false);
  const prevFarmIdRef = useRef(null);

  const fetchWeather = useCallback(async (farmId) => {
    if (!farmId || !isOnline) return;
    setLoading(true);
    setError(null);
    setNoLocation(false);
    try {
      const data = await getFarmWeather(farmId);
      if (data.weather) {
        setWeather(data.weather);
      } else {
        setWeather(null);
        setNoLocation(true);
      }
    } catch (err) {
      console.error('Failed to fetch farm weather:', err);
      setError(err.message || 'Failed to load weather');
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (currentFarmId && currentFarmId !== prevFarmIdRef.current) {
      setWeather(null);
      prevFarmIdRef.current = currentFarmId;
      fetchWeather(currentFarmId);
    } else if (currentFarmId && !prevFarmIdRef.current) {
      prevFarmIdRef.current = currentFarmId;
      fetchWeather(currentFarmId);
    }
  }, [currentFarmId, fetchWeather]);

  if (!profile) return null;

  if (loading) {
    return (
      <div style={S.card} data-testid="farm-weather-card">
        <h3 style={S.title}>{t('farmWeather.title')}</h3>
        <div style={S.loadingText}>{t('farmWeather.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.card} data-testid="farm-weather-card">
        <h3 style={S.title}>{t('farmWeather.title')}</h3>
        <div style={S.errorText}>{error}</div>
      </div>
    );
  }

  if (noLocation) {
    return (
      <div style={S.card} data-testid="farm-weather-card">
        <h3 style={S.title}>{t('farmWeather.title')}</h3>
        <div style={S.emptyText}>{t('farmWeather.noLocation')}</div>
      </div>
    );
  }

  if (!weather) return null;

  const tempDisplay = weather.temperatureC != null ? `${Math.round(weather.temperatureC)}` : '--';
  const humidityDisplay = weather.humidityPct != null ? `${Math.round(weather.humidityPct)}%` : '--';
  const rainDisplay = weather.rainForecastMm != null ? `${weather.rainForecastMm} mm` : '--';

  return (
    <div style={S.card} data-testid="farm-weather-card">
      <div style={S.headerRow}>
        <h3 style={S.title}>{t('farmWeather.title')}</h3>
        {weather.forecastDate && (
          <span style={S.forecastDate}>{weather.forecastDate}</span>
        )}
      </div>

      <div style={S.metricsRow}>
        <div style={S.metric}>
          <span style={S.metricIcon}>🌡</span>
          <span style={S.metricValue}>{tempDisplay}°C</span>
          <span style={S.metricLabel}>{t('farmWeather.temp')}</span>
        </div>
        <div style={S.metric}>
          <span style={S.metricIcon}>💧</span>
          <span style={S.metricValue}>{humidityDisplay}</span>
          <span style={S.metricLabel}>{t('farmWeather.humidity')}</span>
        </div>
        <div style={S.metric}>
          <span style={S.metricIcon}>🌧</span>
          <span style={S.metricValue}>{rainDisplay}</span>
          <span style={S.metricLabel}>{t('farmWeather.rain3d')}</span>
        </div>
      </div>

      {weather.condition && (
        <div style={S.conditionRow}>
          <span style={S.conditionText}>{weather.condition}</span>
        </div>
      )}

      {(weather.rainExpected || weather.heavyRainRisk || weather.drySpellRisk) && (
        <div style={S.alertsRow}>
          {weather.rainExpected && (
            <div style={S.alertBadge} data-testid="rain-expected-badge">
              <span style={S.alertIcon}>🌧</span>
              <span>{t('farmWeather.rainExpected')}</span>
            </div>
          )}
          {weather.heavyRainRisk && (
            <div style={{ ...S.alertBadge, ...S.alertDanger }} data-testid="heavy-rain-badge">
              <span style={S.alertIcon}>⚠</span>
              <span>{t('farmWeather.heavyRainRisk')}</span>
            </div>
          )}
          {weather.drySpellRisk && (
            <div style={{ ...S.alertBadge, ...S.alertWarning }} data-testid="dry-spell-badge">
              <span style={S.alertIcon}>☀</span>
              <span>{t('farmWeather.drySpellRisk')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
    color: '#fff',
  },
  forecastDate: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.4)',
  },
  loadingText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.75rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#FCA5A5',
    marginTop: '0.75rem',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '0.75rem',
  },
  metricsRow: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
    justifyContent: 'space-around',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  metricIcon: {
    fontSize: '1.25rem',
  },
  metricValue: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#fff',
  },
  metricLabel: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  conditionRow: {
    marginTop: '0.75rem',
    textAlign: 'center',
  },
  conditionText: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
  alertsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.75rem',
  },
  alertBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '8px',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'rgba(96,165,250,0.12)',
    color: '#93C5FD',
    border: '1px solid rgba(96,165,250,0.25)',
  },
  alertDanger: {
    background: 'rgba(239,68,68,0.12)',
    color: '#FCA5A5',
    border: '1px solid rgba(239,68,68,0.25)',
  },
  alertWarning: {
    background: 'rgba(245,158,11,0.12)',
    color: '#FDE68A',
    border: '1px solid rgba(245,158,11,0.25)',
  },
  alertIcon: {
    fontSize: '0.875rem',
    flexShrink: 0,
  },
};
