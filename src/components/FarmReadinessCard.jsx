import { useNavigate } from 'react-router-dom';
import { calculateFarmScore, getMissingProfileItems } from '../lib/farmScore.js';
import { useProfile } from '../context/ProfileContext.jsx';

export default function FarmReadinessCard() {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const score = calculateFarmScore(profile || {});
  const missingItems = getMissingProfileItems(profile || {});

  const circleColor = score.isReady ? '#4ADE80' : '#F87171';

  return (
    <div style={S.card}>
      <div style={S.topRow}>
        <div>
          <h2 style={S.title}>Farm Readiness</h2>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: score.isReady ? '#86EFAC' : '#FCA5A5' }}>
            {score.score}% complete
          </p>
        </div>
        <div style={{ ...S.circle, borderColor: circleColor }}>
          {score.score}
        </div>
      </div>

      <div style={S.progressWrap}>
        <div style={S.progressTrack}>
          <div style={{ ...S.progressBar, width: `${score.score}%` }} />
        </div>
      </div>

      {missingItems.length > 0 && (
        <div style={S.missingSection}>
          <div style={S.missingLabel}>Missing:</div>
          <ul style={S.missingList}>
            {missingItems.map((item) => (
              <li key={item} style={S.missingItem}>• {item}</li>
            ))}
          </ul>
          <button onClick={() => navigate('/profile/setup')} style={S.fixBtn}>
            Fix Missing Items
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
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
  },
  circle: {
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
  progressWrap: {
    marginTop: '1rem',
  },
  progressTrack: {
    width: '100%',
    height: '0.75rem',
    borderRadius: '9999px',
    background: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: '#22C55E',
    borderRadius: '9999px',
    transition: 'width 0.3s ease',
  },
  missingSection: {
    marginTop: '1rem',
  },
  missingLabel: {
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
  },
  missingItem: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
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
