import { useMemo } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useWeather } from '../context/WeatherContext.jsx';
import { useTranslation } from '../i18n/index.js';

export default function ActionRecommendationsCard() {
  const { profile } = useProfile();
  const { weather } = useWeather();
  const { t } = useTranslation();

  const recommendationKeys = useMemo(() => {
    const keys = [];

    if (!profile?.gpsLat || !profile?.gpsLng) {
      keys.push('recommend.addGps');
    }
    if (!profile?.cropType) {
      keys.push('recommend.addCrop');
    }
    if (weather) {
      if ((weather.rain || 0) > 0 || (weather.showers || 0) > 0) {
        keys.push('recommend.reviewPlans');
      } else {
        keys.push('recommend.normalWork');
      }
      if ((weather.windSpeed || 0) >= 20) {
        keys.push('recommend.noSpray');
      }
    }
    if (!keys.length) {
      keys.push('recommend.allGood');
    }

    return keys.slice(0, 3);
  }, [profile, weather]);

  return (
    <div style={S.card}>
      <h3 style={S.title}>{t('recommend.title')}</h3>
      <ul style={S.list}>
        {recommendationKeys.map((key) => (
          <li key={key} style={S.item}>{t(key)}</li>
        ))}
      </ul>
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
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: '0 0 0.75rem 0',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  item: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.8)',
  },
};
