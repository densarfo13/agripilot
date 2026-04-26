import { useWeather } from '../context/WeatherContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import VoicePromptButton from './VoicePromptButton.jsx';

function getWeatherDecisionKey(weather) {
  if (!weather) return 'weather.addGps';
  if ((weather.rain || 0) > 0 || (weather.showers || 0) > 0 || (weather.precipitation || 0) > 0) return 'weather.rainLikely';
  if ((weather.windSpeed || 0) >= 20) return 'weather.noSpray';
  return 'weather.safeActivity';
}

function getWeatherActionKeys(weather) {
  if (!weather) return ['weather.addGpsDetail'];
  const keys = [];
  if ((weather.rain || 0) > 0 || (weather.showers || 0) > 0) {
    keys.push('weather.delayWork');
  } else {
    keys.push('weather.noRain');
  }
  if ((weather.windSpeed || 0) >= 20) {
    keys.push('weather.noSprayWind');
  } else {
    keys.push('weather.windOk');
  }
  if ((weather.temperature || 0) >= 32) {
    keys.push('weather.heatHigh');
  }
  return keys;
}

export default function WeatherDecisionCard() {
  const { weather, weatherLoading, resolvedLocation } = useWeather();
  const { t } = useTranslation();

  const decisionKey = getWeatherDecisionKey(weather);
  const actionKeys = getWeatherActionKeys(weather);

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <div>
          <h3 style={S.title}>{t('weather.title')}</h3>
          <p style={S.subtitle}>
            {weatherLoading
              ? t('weather.loading')
              : weather
                ? `${weather.temperature ?? '-'}\u00B0C \u2022 Wind ${weather.windSpeed ?? '-'} km/h \u2022 Humidity ${weather.humidity ?? '-'}%`
                : t('weather.unavailable')}
          </p>
          {resolvedLocation && (
            <p style={S.locationNote}>{t('weather.usingLocation')} {resolvedLocation}</p>
          )}
        </div>
        <VoicePromptButton text={t(decisionKey)} label={t('common.listen')} />
      </div>

      <div style={S.decisionBox}>
        <div style={S.decisionText}>{t(decisionKey)}</div>
        <ul style={S.actionList}>
          {actionKeys.map((key) => (
            <li key={key} style={S.actionItem}>{t(key)}</li>
          ))}
        </ul>
      </div>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  title: {
    fontWeight: 600,
    fontSize: '1.125rem',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '0.25rem',
  },
  locationNote: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
    marginTop: '0.5rem',
  },
  decisionBox: {
    marginTop: '1rem',
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1rem',
  },
  decisionText: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#86EFAC',
  },
  actionList: {
    marginTop: '0.75rem',
    listStyle: 'none',
    padding: 0,
    margin: '0.75rem 0 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  actionItem: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.75)',
  },
};
