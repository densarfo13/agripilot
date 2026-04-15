/**
 * FarmerHeader — compact welcome with avatar, name, location, crop
 */
import { getCropLabel } from '../utils/crops.js';
import { getAvatar } from '../utils/avatarStorage.js';
import FarmerAvatar from './FarmerAvatar.jsx';

export default function FarmerHeader({ user, profile, t }) {
  const name = user?.fullName || profile?.farmerName || '';
  const displayName = name || t('dashboard.welcome') || 'Welcome';

  const rawCrop = profile?.cropType || profile?.crop || '';
  const cropDisplay = getCropLabel(rawCrop);
  const locationName = profile?.location || profile?.locationLabel || profile?.locationName || '';
  const subtitle = [locationName, cropDisplay].filter(Boolean).join(' \u2022 ');

  return (
    <div style={S.welcomeRow}>
      <FarmerAvatar fullName={name} profileImageUrl={getAvatar()} size={40} />
      <div style={{ flex: 1 }}>
        <h1 style={S.welcomeTitle}>
          {t('dashboard.hello', { name: displayName })}
        </h1>
        {subtitle && (
          <p style={S.subtitle}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}

const S = {
  welcomeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.25rem 0',
  },
  welcomeTitle: {
    fontSize: '1.375rem',
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.45)',
    margin: 0,
    marginTop: '0.2rem',
  },
};
