import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useWeather } from '../context/WeatherContext.jsx';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { calculateFarmScore, getMissingProfileItems } from '../lib/farmScore';
import { t } from '../lib/i18n.js';
import { speakText, languageToVoiceCode } from '../lib/voice.js';
import VoicePromptButton from '../components/VoicePromptButton.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const { weather, weatherLoading } = useWeather();
  const { language, autoVoice } = useAppPrefs();

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Auto-voice on load
  useEffect(() => {
    if (autoVoice && !loading) {
      const voiceCode = languageToVoiceCode(language);
      speakText(t(language, 'voiceDashboard'), voiceCode);
    }
  }, [autoVoice, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const { score, status, isReady } = calculateFarmScore(profile || {});
  const missing = getMissingProfileItems(profile || {});

  const scoreColor = score >= 85 ? '#86EFAC' : score >= 60 ? '#FDE68A' : '#FCA5A5';

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <h1 style={S.title}>{profile?.farmName || 'My Farm'}</h1>
            {profile?.farmerUuid && (
              <span style={S.uuid}>ID: {profile.farmerUuid}</span>
            )}
          </div>
          <VoicePromptButton text={t(language, 'voiceDashboard')} />
        </div>

        {/* Score Card */}
        <div style={S.card}>
          <div style={S.scoreRow}>
            <div style={S.scoreCircleOuter}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#111827" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 264} 264`}
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="46" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700">{score}</text>
                <text x="50" y="62" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10">/ 100</text>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={S.scoreTitle}>Farm Score</h2>
              <p style={{ ...S.scoreStatus, color: scoreColor }}>{status}</p>
              <div style={S.progressTrack}>
                <div style={{ ...S.progressBar, width: `${score}%`, background: scoreColor }} />
              </div>
              <p style={S.progressLabel}>{score}% complete</p>
            </div>
          </div>
        </div>

        {/* Weather Card */}
        {(weather || weatherLoading) && (
          <div style={S.card}>
            <div style={S.weatherHeader}>
              <h3 style={S.sectionTitle}>Weather</h3>
              <VoicePromptButton text={t(language, 'voiceWeather')} />
            </div>
            {weatherLoading ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>Loading weather...</p>
            ) : weather ? (
              <div style={S.weatherGrid}>
                <div style={S.weatherItem}>
                  <span style={S.weatherLabel}>Temp</span>
                  <span style={S.weatherValue}>{weather.temperature != null ? `${weather.temperature}°C` : '-'}</span>
                </div>
                <div style={S.weatherItem}>
                  <span style={S.weatherLabel}>Humidity</span>
                  <span style={S.weatherValue}>{weather.humidity != null ? `${weather.humidity}%` : '-'}</span>
                </div>
                <div style={S.weatherItem}>
                  <span style={S.weatherLabel}>Wind</span>
                  <span style={S.weatherValue}>{weather.windSpeed != null ? `${weather.windSpeed} km/h` : '-'}</span>
                </div>
                <div style={S.weatherItem}>
                  <span style={S.weatherLabel}>Rain</span>
                  <span style={S.weatherValue}>{weather.precipitation != null ? `${weather.precipitation} mm` : '-'}</span>
                </div>
              </div>
            ) : null}
            {weather && (
              <p style={S.weatherSummary}>
                {weather.precipitation > 0
                  ? t(language, 'weatherSummaryRain')
                  : weather.windSpeed > 20
                    ? t(language, 'weatherSummaryWind')
                    : t(language, 'weatherSummaryGood')}
              </p>
            )}
          </div>
        )}

        {/* Missing Items */}
        {missing.length > 0 && (
          <div style={S.card}>
            <h3 style={S.sectionTitle}>Missing Profile Items</h3>
            <ul style={S.missingList}>
              {missing.map((item) => (
                <li key={item} style={S.missingItem}>
                  <span style={S.missingDot} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Farm Details */}
        {profile && (
          <div style={S.card}>
            <h3 style={S.sectionTitle}>Farm Details</h3>
            <div style={S.detailsGrid}>
              <DetailItem label="Farmer" value={profile.farmerName} />
              <DetailItem label="Country" value={profile.country} />
              <DetailItem label="Location" value={profile.location} />
              <DetailItem label="Farm Size" value={profile.size ? `${profile.size} acres` : null} />
              <DetailItem label="Crop" value={profile.cropType ? profile.cropType.charAt(0).toUpperCase() + profile.cropType.slice(1) : null} />
              <DetailItem label="GPS" value={
                profile.gpsLat != null && profile.gpsLng != null
                  ? `${Number(profile.gpsLat).toFixed(4)}, ${Number(profile.gpsLng).toFixed(4)}`
                  : null
              } />
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          style={S.ctaButton}
          onClick={() => navigate(isReady ? '/season/start' : '/profile/setup')}
        >
          {isReady ? t(language, 'startSeason') : t(language, 'completeProfile')}
        </button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={S.detailItem}>
      <span style={S.detailLabel}>{label}</span>
      <span style={S.detailValue}>{value || '-'}</span>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', padding: '1.5rem' },
  container: { maxWidth: '40rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  uuid: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' },
  card: { borderRadius: '16px', background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)' },
  scoreRow: { display: 'flex', alignItems: 'center', gap: '1.5rem' },
  scoreCircleOuter: { flexShrink: 0 },
  scoreTitle: { fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0' },
  scoreStatus: { fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.75rem 0' },
  progressTrack: { height: '8px', background: '#111827', borderRadius: '4px', overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: '4px', transition: 'width 0.3s ease' },
  progressLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.35rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' },
  missingList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  missingItem: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#FDE68A' },
  missingDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#FDE68A', flexShrink: 0 },
  detailsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  detailItem: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  detailLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' },
  detailValue: { fontSize: '0.875rem' },
  weatherHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  weatherGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  weatherItem: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  weatherLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' },
  weatherValue: { fontSize: '1rem', fontWeight: 600 },
  weatherSummary: { marginTop: '0.75rem', fontSize: '0.85rem', color: '#FDE68A', fontStyle: 'italic' },
  ctaButton: { background: '#22C55E', color: '#000', border: 'none', borderRadius: '12px', padding: '0.85rem 1rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', width: '100%' },
};
