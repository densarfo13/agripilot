import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';

export default function FarmSnapshotCard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { t } = useTranslation();

  const hasGps =
    profile?.gpsLat !== null &&
    profile?.gpsLat !== undefined &&
    profile?.gpsLng !== null &&
    profile?.gpsLng !== undefined;

  // Build a display location: locationLabel > location > country > fallback
  const displayLocation = profile?.locationLabel
    || profile?.location
    || profile?.country
    || null;

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <h3 style={S.title}>{t('farm.myFarm')}</h3>
        <button onClick={() => navigate('/profile/setup')} style={S.editBtn}>
          {t('farm.edit')}
        </button>
      </div>

      <div style={S.grid}>
        <div style={S.label}>{t('farm.crop')}</div>
        <div>{profile?.cropType || '-'}</div>

        <div style={S.label}>{t('farm.size')}</div>
        <div>{profile?.size ? `${profile.size} ${t('farm.acres')}` : '-'}</div>

        <div style={S.label}>{t('farm.location')}</div>
        <div>
          {displayLocation || '-'}
          {hasGps && <span style={{ color: '#22C55E', marginLeft: '0.35rem', fontSize: '0.75rem' }}>✅</span>}
        </div>

        <div style={S.label}>{t('farm.country')}</div>
        <div>{profile?.country || '-'}</div>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
  },
  editBtn: {
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#fff',
    background: 'transparent',
    cursor: 'pointer',
  },
  grid: {
    marginTop: '1rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    rowGap: '0.75rem',
    fontSize: '0.875rem',
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
  },
};
