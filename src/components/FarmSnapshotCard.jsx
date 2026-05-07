/**
 * FarmSnapshotCard — compact snapshot of the farmer's active farm.
 *
 * Shows farm name, crop, size/location, and a quick edit link.
 *
 * Props:
 *   profile  — farmer farm profile
 *   onEdit   — callback to open farm edit form
 */
import React from 'react';
import { useTranslation } from '../i18n/index.js';
import { getCropLabel } from '../utils/crops.js';

export default function FarmSnapshotCard({ profile, onEdit }) {
  const { t, lang } = useTranslation();

  if (!profile) return null;

  const cropName = getCropLabel(profile.crop || profile.cropType || '', lang);

  // GPS presence flag — used for checkmark display
  const hasGps = !!(profile?.latitude && profile?.longitude);

  // Human-readable location: prefer reverse-geocoded label, then typed location, then country
  const locationDisplay = profile?.locationLabel || profile?.location || profile?.country;

  return (
    <div style={S.card} data-testid="farm-snapshot-card">
      <div style={S.header}>
        <span style={S.title}>{t('farm.myFarm') || 'My Farm'}</span>
        <button style={S.editBtn} onClick={onEdit} data-testid="farm-snapshot-edit">
          {t('farm.edit') || 'Edit'}
        </button>
      </div>

      <div style={S.body}>
        {profile.farmName || profile.name ? (
          <div style={S.farmName}>{profile.farmName || profile.name}</div>
        ) : null}

        {cropName && (
          <div style={S.row}>
            <span style={S.label}>{t('farm.crop') || 'Crop'}:</span>
            <span style={S.value}>{cropName}</span>
          </div>
        )}

        {(profile.farmSize || profile.size) ? (
          <div style={S.row}>
            <span style={S.label}>{t('farm.size') || 'Size'}:</span>
            <span style={S.value}>{profile.farmSize || profile.size} {profile.sizeUnit || ''}</span>
          </div>
        ) : null}

        {locationDisplay && (
          <div style={S.row}>
            <span style={S.label}>{t('farm.location') || 'Location'}:</span>
            <span style={S.value}>
              {hasGps && <span style={S.gpsCheck}>✅ </span>}
              {locationDisplay}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '16px',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  title: { fontSize: '1rem', fontWeight: 700, color: '#EAF2FF' },
  editBtn: {
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    background: 'transparent',
    color: '#22C55E',
    border: '1px solid #22C55E',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  body: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  farmName: { fontSize: '1.1rem', fontWeight: 700, color: '#EAF2FF', marginBottom: '0.25rem' },
  row: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  label: { fontSize: '0.8rem', color: '#6F8299', flexShrink: 0 },
  value: { fontSize: '0.875rem', color: '#9FB3C8' },
  gpsCheck: { fontSize: '0.75rem' },
};
