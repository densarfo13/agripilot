import { useEffect } from 'react';
import { t } from '../lib/i18n.js';
import { languageToVoiceCode, speakText } from '../lib/voice.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import FarmerIdCard from '../components/FarmerIdCard.jsx';
import PrimaryFarmActionCard from '../components/PrimaryFarmActionCard.jsx';
import FarmReadinessCard from '../components/FarmReadinessCard.jsx';
import WeatherDecisionCard from '../components/WeatherDecisionCard.jsx';
import ActionRecommendationsCard from '../components/ActionRecommendationsCard.jsx';
import FarmSnapshotCard from '../components/FarmSnapshotCard.jsx';
import VoicePromptButton from '../components/VoicePromptButton.jsx';

export default function Dashboard() {
  const { language, autoVoice } = useAppPrefs();
  const { user } = useAuth();

  useEffect(() => {
    if (autoVoice) {
      speakText(t(language, 'voiceDashboard'), languageToVoiceCode(language));
    }
  }, [autoVoice, language]);

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Welcome Header */}
        <div style={S.card}>
          <div style={S.headerRow}>
            <div>
              <h1 style={S.welcomeTitle}>
                Welcome{user?.fullName ? `, ${user.fullName}` : ''}
              </h1>
              <p style={S.email}>{user?.email || ''}</p>
            </div>
            <VoicePromptButton text={t(language, 'voiceDashboard')} label="Play Guidance" />
          </div>
        </div>

        <FarmerIdCard />

        <PrimaryFarmActionCard />

        <FarmReadinessCard />

        <WeatherDecisionCard />

        <ActionRecommendationsCard />

        <FarmSnapshotCard />
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '48rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
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
  welcomeTitle: {
    fontSize: '1.75rem',
    fontWeight: 700,
    margin: 0,
  },
  email: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.25rem',
  },
};
