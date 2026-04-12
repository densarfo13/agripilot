import { useNavigate } from 'react-router-dom';
import { t } from '../lib/i18n.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { calculateFarmScore } from '../lib/farmScore.js';

export default function PrimaryFarmActionCard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { language } = useAppPrefs();

  const score = calculateFarmScore(profile || {});

  if (score.isReady) {
    return (
      <div style={S.card}>
        <div style={S.readyLabel}>🌱 Ready to begin your season</div>
        <p style={S.desc}>
          Your farm profile is ready. You can now begin season tracking and receive better guidance.
        </p>
        <button onClick={() => navigate('/season/start')} style={S.ctaBtn}>
          {t(language, 'startSeason')}
        </button>
      </div>
    );
  }

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
};
