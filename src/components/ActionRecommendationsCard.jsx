import { useMemo } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useWeather } from '../context/WeatherContext.jsx';

export default function ActionRecommendationsCard() {
  const { profile } = useProfile();
  const { weather } = useWeather();

  const recommendations = useMemo(() => {
    const items = [];

    if (!profile?.gpsLat || !profile?.gpsLng) {
      items.push('Add GPS coordinates to unlock local weather and risk alerts.');
    }

    if (!profile?.cropType) {
      items.push('Add crop type to receive crop-specific recommendations.');
    }

    if (weather) {
      if ((weather.rain || 0) > 0 || (weather.showers || 0) > 0) {
        items.push('Rain may affect field work. Review today\'s farm plans.');
      } else {
        items.push('No immediate rainfall detected. Normal field work can continue.');
      }

      if ((weather.windSpeed || 0) >= 20) {
        items.push('Avoid spraying until wind reduces.');
      }
    }

    if (!items.length) {
      items.push('Your farm setup looks good. Start the season and keep records updated.');
    }

    return items.slice(0, 3);
  }, [profile, weather]);

  return (
    <div style={S.card}>
      <h3 style={S.title}>💡 Today's Recommendations</h3>
      <ul style={S.list}>
        {recommendations.map((item) => (
          <li key={item} style={S.item}>• {item}</li>
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
