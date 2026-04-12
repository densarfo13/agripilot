import { t } from '../lib/i18n.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useWeather } from '../context/WeatherContext.jsx';
import VoicePromptButton from './VoicePromptButton.jsx';

function getWeatherSummary(weather, language) {
  if (!weather) return 'Weather will appear when GPS coordinates are available.';

  if ((weather.rain || 0) > 0 || (weather.showers || 0) > 0 || (weather.precipitation || 0) > 0) {
    return t(language, 'weatherSummaryRain');
  }
  if ((weather.windSpeed || 0) >= 20) {
    return t(language, 'weatherSummaryWind');
  }
  return t(language, 'weatherSummaryGood');
}

function getWeatherActions(weather) {
  if (!weather) {
    return ['Add GPS coordinates to unlock local weather intelligence.'];
  }

  const actions = [];

  if ((weather.rain || 0) > 0 || (weather.showers || 0) > 0) {
    actions.push('Rain is likely. Protect seeds, inputs, and field activity plans.');
  } else {
    actions.push('No rain detected right now. Field movement looks safe.');
  }

  if ((weather.windSpeed || 0) >= 20) {
    actions.push('Avoid spraying in strong wind.');
  } else {
    actions.push('Wind conditions look acceptable for normal activity.');
  }

  if ((weather.temperature || 0) >= 32) {
    actions.push('Heat is elevated. Water and labor planning should be adjusted.');
  }

  return actions;
}

export default function WeatherDecisionCard() {
  const { weather, weatherLoading } = useWeather();
  const { language } = useAppPrefs();

  const summary = getWeatherSummary(weather, language);
  const actions = getWeatherActions(weather);

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <div>
          <h3 style={S.title}>🌤 Weather Today</h3>
          <p style={S.subtitle}>
            {weatherLoading
              ? 'Loading local weather...'
              : weather
                ? `${weather.temperature ?? '-'}°C \u2022 Wind ${weather.windSpeed ?? '-'} km/h \u2022 Humidity ${weather.humidity ?? '-'}%`
                : 'Weather data is unavailable until GPS is added.'}
          </p>
        </div>
        <VoicePromptButton text={summary} label="Weather Voice" />
      </div>

      <div style={S.decisionBox}>
        <div style={S.summaryText}>{summary}</div>
        <ul style={S.actionList}>
          {actions.map((item) => (
            <li key={item} style={S.actionItem}>• {item}</li>
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
  decisionBox: {
    marginTop: '1rem',
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1rem',
  },
  summaryText: {
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
