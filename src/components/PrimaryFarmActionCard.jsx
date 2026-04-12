import { useNavigate } from 'react-router-dom';
import { t } from '../lib/i18n.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { calculateFarmScore } from '../lib/farmScore.js';
import { useSeason } from '../context/SeasonContext.jsx';

export default function PrimaryFarmActionCard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { language } = useAppPrefs();
  const { season, beginSeason, seasonLoading } = useSeason();

  const score = calculateFarmScore(profile || {});

  async function handleStartSeason() {
    const cropType = profile?.cropType || '';
    if (!cropType) {
      navigate('/profile/setup');
      return;
    }

    try {
      await beginSeason({ cropType, stage: 'planting' });
      navigate('/season/start');
    } catch (error) {
      console.error('Failed to start season:', error);
    }
  }

  // State 1: Profile not ready
  if (!score.isReady) {
    return (
      <div style={S.cardWarning}>
        <div style={S.warningLabel}>⚠️ Your farm is not ready yet</div>
        <p style={S.desc}>
          Complete your profile to unlock accurate weather, farm scoring, and smart recommendations.
        </p>
        <div style={S.benefitsList}>
          <div>• Accurate weather</div>
          <div>• Better farm scoring</div>
          <div>• Smarter recommendations</div>
        </div>
        <button onClick={() => navigate('/profile/setup')} style={S.ctaBtn}>
          {t(language, 'completeProfile')}
        </button>
      </div>
    );
  }

  // State 2: Season already active
  if (season) {
    return (
      <div style={S.card}>
        <div style={S.readyLabel}>🌱 Season already active</div>
        <p style={S.desc}>
          Continue today's farming tasks and keep your season progress updated.
        </p>
        <button onClick={() => navigate('/season/start')} style={S.ctaBtn}>
          Continue Season
        </button>
      </div>
    );
  }

  // State 3: Ready to start season
  return (
    <div style={S.card}>
      <div style={S.readyLabel}>🌱 Ready to begin your season</div>
      <p style={S.desc}>
        Your farm profile is ready. Start your season to unlock daily tasks and better guidance.
      </p>
      <button
        onClick={handleStartSeason}
        disabled={seasonLoading}
        style={{ ...S.ctaBtn, ...(seasonLoading ? S.ctaBtnDisabled : {}) }}
      >
        {seasonLoading ? 'Starting...' : t(language, 'startSeason')}
      </button>
    </div>
  );
}

const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  cardWarning: {
    borderRadius: '16px',
    background: '#1B2330',
    border: '1px solid rgba(250,204,21,0.2)',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  readyLabel: {
    fontSize: '0.875rem',
    color: '#86EFAC',
    fontWeight: 600,
  },
  warningLabel: {
    fontSize: '0.875rem',
    color: '#FDE68A',
    fontWeight: 600,
  },
  desc: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '0.5rem',
  },
  benefitsList: {
    marginTop: '0.75rem',
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.8)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  ctaBtn: {
    marginTop: '1rem',
    width: '100%',
    borderRadius: '16px',
    background: '#22C55E',
    padding: '1rem',
    fontWeight: 700,
    color: '#000',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  ctaBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};
