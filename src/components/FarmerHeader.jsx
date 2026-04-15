/**
 * FarmerHeader — compact welcome card with name, location, crop
 */
import { getCropLabel } from '../utils/crops.js';

export default function FarmerHeader({ user, profile, t }) {
  const name = user?.fullName || t('dashboard.welcome') || 'Welcome';

  // Use profile.cropType (V2 API shape), fall back to profile.crop (legacy)
  const rawCrop = profile?.cropType || profile?.crop || '';
  const cropDisplay = getCropLabel(rawCrop);

  const locationName = profile?.location || profile?.locationLabel || profile?.locationName || '';
  const subtitle = [locationName, cropDisplay].filter(Boolean).join(' \u2022 ');

  return (
    <div style={S.welcomeRow}>
      <div style={{ flex: 1 }}>
        <h1 style={S.welcomeTitle}>
          {t('dashboard.hello', { name })}
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
