import { useNavigate } from 'react-router-dom';
import { calculateFarmScore, getMissingProfileItems } from '../lib/farmScore.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';

export default function FarmReadinessCard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { t } = useTranslation();

  const score = calculateFarmScore(profile || {});
  const missingItems = getMissingProfileItems(profile || {});

  if (score.isReady) {
    return (
      <div style={S.card}>
        <div style={S.topRow}>
          <div>
            <h2 style={S.heading}>{t('readiness.good')}</h2>
            <p style={S.readyText}>
              {t('readiness.goodDesc')}
            </p>
          </div>
          <div style={{ ...S.scoreCircle, borderColor: '#4ADE80' }}>
            {score.score}
          </div>
        </div>
        <div style={S.barWrap}>
          <div style={S.barTrack}>
            <div style={{ ...S.barFill, width: `${score.score}%` }} />
          </div>
        </div>
      </div>
    );
  }

  // Calculate progress: total items vs completed items
  const totalItems = missingItems.length + score.completedCount;
  const doneItems = score.completedCount || (totalItems - missingItems.length);

  return (
    <div style={S.card}>
      <div style={S.topRow}>
        <div>
          <h2 style={S.heading}>{t('readiness.incomplete')}</h2>
          <p style={S.notReadyText}>
            {doneItems} / {totalItems} {t('readiness.progress')}
          </p>
        </div>
        <div style={S.progressCircle}>
          {doneItems}/{totalItems}
        </div>
      </div>
      <div style={S.barWrap}>
        <div style={S.barTrack}>
          <div style={{ ...S.barFill, width: totalItems > 0 ? `${Math.round((doneItems / totalItems) * 100)}%` : '0%' }} />
        </div>
      </div>
      {missingItems.length > 0 && (
        <div style={S.missingSection}>
          <div style={S.missingTitle}>{t('readiness.stillNeeded')}</div>
          <ul style={S.missingList}>
            {missingItems.map((item) => (
              <li key={item} style={S.missingItem}>{item}</li>
            ))}
          </ul>
          <button onClick={() => navigate('/profile/setup')} style={S.fixBtn}>
            {t('dashboard.completeSetup')}
          </button>
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
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  heading: {
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
  },
  readyText: {
    fontSize: '0.875rem',
    marginTop: '0.25rem',
    color: '#86EFAC',
  },
  notReadyText: {
    fontSize: '0.875rem',
    marginTop: '0.25rem',
    color: '#FCA5A5',
  },
  scoreCircle: {
    height: '4rem',
    width: '4rem',
    borderRadius: '50%',
    borderWidth: '4px',
    borderStyle: 'solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.125rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  barWrap: {
    marginTop: '1rem',
  },
  barTrack: {
    width: '100%',
    height: '0.75rem',
    borderRadius: '9999px',
    background: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: '#22C55E',
    borderRadius: '9999px',
    transition: 'width 0.3s ease',
  },
  missingSection: {
    marginTop: '1rem',
  },
  missingTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '0.5rem',
  },
  missingList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
  },
  missingItem: {
    paddingLeft: '0.5rem',
  },
  progressCircle: {
    height: '4rem',
    width: '4rem',
    borderRadius: '50%',
    borderWidth: '4px',
    borderStyle: 'solid',
    borderColor: '#FBBF24',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  fixBtn: {
    marginTop: '1rem',
    width: '100%',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '0.75rem 1rem',
    fontWeight: 600,
    color: '#fff',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
};
