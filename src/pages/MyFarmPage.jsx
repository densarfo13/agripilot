/**
 * MyFarmPage — standalone page at /my-farm showing farmer's farm details.
 *
 * Reads from profile context, displays farm name, crop, location, size,
 * stage, and country in a clean card layout. No internal IDs, no lat/lng,
 * no technical fields. Dark theme, inline styles, all text via useTranslation().
 */

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { getCropLabel, getCropIcon } from '../utils/crops.js';
import { STAGE_EMOJIS, STAGE_KEYS } from '../utils/cropStages.js';
import { getAvatar, saveAvatar, removeAvatar, compressAvatar } from '../utils/avatarStorage.js';
import { SECTION_ICONS } from '../lib/farmerIcons.js';
import FarmerAvatar from '../components/FarmerAvatar.jsx';
import FarmerIdCard from '../components/FarmerIdCard.jsx';
import SupportCard from '../components/SupportCard.jsx';

const CROP_EMOJIS = {
  maize: '🌽',
  corn: '🌽',
  wheat: '🌾',
  rice: '🍚',
  cassava: '🥔',
  potato: '🥔',
  tomato: '🍅',
  coffee: '☕',
  tea: '🍵',
  sugarcane: '🎋',
  banana: '🍌',
  bean: '🫘',
  beans: '🫘',
  soybean: '🫘',
  groundnut: '🥜',
  peanut: '🥜',
  cotton: '🧶',
  sunflower: '🌻',
  mango: '🥭',
  orange: '🍊',
  avocado: '🥑',
  onion: '🧅',
  pepper: '🌶️',
  cabbage: '🥬',
  carrot: '🥕',
};

// STAGE_EMOJIS and STAGE_KEYS imported from utils/cropStages.js

function getCropEmoji(crop) {
  if (!crop) return '🌱';
  const key = crop.toLowerCase().trim();
  return CROP_EMOJIS[key] || '🌱';
}

function formatSize(size, unit) {
  if (!size && size !== 0) return null;
  const u = unit || 'acres';
  return `${size} ${u}`;
}

export default function MyFarmPage() {
  const navigate = useNavigate();
  const { profile, farms, currentFarmId, loading: profileLoading } = useProfile();
  const { user } = useAuth();
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(getAvatar);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const dataUrl = await compressAvatar(file);
      if (dataUrl) {
        saveAvatar(dataUrl);
        setAvatarUrl(dataUrl);
      } else {
        setAvatarError(t('avatar.compressFailed'));
      }
    } catch {
      setAvatarError(t('avatar.uploadFailed'));
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleRemoveAvatar() {
    removeAvatar();
    setAvatarUrl(null);
  }

  const farmerName = user?.fullName || profile?.farmerName || '';

  if (profileLoading) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <span style={S.pageIcon}>{SECTION_ICONS.crop}</span>
          <h1 style={S.pageTitle}>{t('myFarm.title')}</h1>
        </div>
        <div style={S.skeletonWrap}>
          <div style={S.skeletonCard}>
            <div style={S.skeletonLine} />
            <div style={{ ...S.skeletonLine, width: '60%' }} />
            <div style={{ ...S.skeletonLine, width: '80%' }} />
            <div style={{ ...S.skeletonLine, width: '50%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  // Use active profile as primary source (always has the current farm data),
  // fall back to farms array lookup
  const farm = profile || farms?.find((f) => f.id === currentFarmId) || farms?.[0] || null;
  const isMultiFarm = farms && farms.length > 1;

  return (
    <div style={S.page} data-testid="my-farm-page">
      {/* Header */}
      <div style={S.header}>
        <span style={S.pageIcon}>{SECTION_ICONS.crop}</span>
        <h1 style={S.pageTitle}>{t('myFarm.title')}</h1>
      </div>

      {/* Farm details */}
      {farm ? (
        <div style={S.tilesWrap}>
          {/* Identity card — avatar + farm name */}
          <div style={S.identityCard}>
            <div style={S.avatarSection}>
              <FarmerAvatar
                fullName={farmerName}
                profileImageUrl={avatarUrl}
                size={64}
                onClick={() => fileInputRef.current?.click()}
                editable
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleAvatarFile}
                style={{ display: 'none' }}
              />
              <div>
                <h2 style={S.farmName}>{farm.farmName || farm.name || t('myFarm.unnamedFarm')}</h2>
                {(farm.country || farm.countryCode) && (
                  <span style={S.farmSubline}>{SECTION_ICONS.country} {farm.country || farm.countryCode}</span>
                )}
              </div>
            </div>
            <div style={S.avatarActions}>
              <button onClick={() => fileInputRef.current?.click()} style={S.avatarBtn} disabled={avatarUploading}>
                {avatarUploading ? (t('avatar.uploading') || 'Uploading...') : avatarUrl ? (t('avatar.change') || 'Change photo') : (t('avatar.add') || 'Add photo')}
              </button>
              {avatarUrl && (
                <button onClick={handleRemoveAvatar} style={S.avatarRemoveBtn}>
                  {t('avatar.remove') || 'Remove'}
                </button>
              )}
            </div>
            {avatarError && <div style={S.avatarError}>{avatarError}</div>}
          </div>

          {/* Detail tiles — 2-column grid */}
          <div style={S.tileGrid}>
            {/* Crop tile */}
            {(farm.cropType || farm.crop) && (
              <div style={S.tile}>
                <span style={S.tileIcon}>{getCropIcon(farm.cropType || farm.crop) || getCropEmoji(farm.cropType || farm.crop)}</span>
                <span style={S.tileLabel}>{t('myFarm.crop')}</span>
                <span style={S.tileValue}>{getCropLabel(farm.cropType || farm.crop)}</span>
              </div>
            )}

            {/* Size tile */}
            {farm.size && (
              <div style={S.tile}>
                <span style={S.tileIcon}>{SECTION_ICONS.size}</span>
                <span style={S.tileLabel}>{t('myFarm.size')}</span>
                <span style={S.tileValue}>{formatSize(farm.size, farm.sizeUnit)}</span>
              </div>
            )}

            {/* Location tile */}
            {(farm.location || farm.locationLabel) && (
              <div style={S.tile}>
                <span style={S.tileIcon}>{SECTION_ICONS.location}</span>
                <span style={S.tileLabel}>{t('myFarm.location')}</span>
                <span style={S.tileValue}>{farm.location || farm.locationLabel}</span>
              </div>
            )}

            {/* Stage tile */}
            {farm.cropStage && (
              <div style={S.tile}>
                <span style={S.tileIcon}>{STAGE_EMOJIS[farm.cropStage] || '📊'}</span>
                <span style={S.tileLabel}>{t('myFarm.stage')}</span>
                <span style={S.stageBadge}>
                  {t(STAGE_KEYS[farm.cropStage]) || farm.cropStage.replace(/_/g, ' ')}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={S.actionsRow}>
            <button
              type="button"
              onClick={() => navigate('/crop-fit')}
              style={S.cropFitBtn}
            >
              {'\uD83C\uDF3E'} {t('myFarm.findBestCrop') || 'Find My Best Crop'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile/setup')}
              style={S.editBtn}
            >
              {t('myFarm.edit') || 'Edit Farm'}
            </button>
            {isMultiFarm && (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                style={S.switchBtn}
              >
                {t('myFarm.switchFarm') || 'Switch Farm'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={S.emptyWrap}>
          <p style={S.emptyText}>{t('myFarm.noFarm')}</p>
          <button
            type="button"
            onClick={() => navigate('/profile/setup')}
            style={S.editBtn}
          >
            {t('myFarm.setupFarm') || 'Set Up Farm'}
          </button>
        </div>
      )}

      {/* Farmer ID + Support — moved here from dashboard */}
      <div style={S.cardWrap}>
        <FarmerIdCard />
      </div>
      <div style={S.cardWrap}>
        <SupportCard />
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    padding: '0 0 1rem 0',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1.125rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  pageIcon: {
    fontSize: '1.25rem',
  },
  pageTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    margin: 0,
  },
  tilesWrap: {
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  cardWrap: {
    padding: '0 1.25rem 0.75rem',
  },
  identityCard: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '20px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
  },
  avatarActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  avatarBtn: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#9FB3C8',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '0.375rem 0.75rem',
    cursor: 'pointer',
    minHeight: '32px',
    WebkitTapHighlightColor: 'transparent',
  },
  avatarRemoveBtn: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6F8299',
    background: 'none',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '0.375rem 0.75rem',
    cursor: 'pointer',
    minHeight: '32px',
    WebkitTapHighlightColor: 'transparent',
  },
  avatarError: {
    fontSize: '0.75rem',
    color: '#FCA5A5',
    marginTop: '0.25rem',
  },
  farmName: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    margin: 0,
    lineHeight: 1.3,
  },
  farmSubline: {
    fontSize: '0.75rem',
    color: '#6F8299',
    fontWeight: 500,
    marginTop: '0.125rem',
    display: 'block',
  },
  // ─── Tile grid ──────────
  tileGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.625rem',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '1.125rem 0.75rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
    textAlign: 'center',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  tileIcon: {
    fontSize: '1.5rem',
    marginBottom: '0.125rem',
  },
  tileLabel: {
    fontSize: '0.625rem',
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
  },
  tileValue: {
    fontSize: '0.9375rem',
    color: '#EAF2FF',
    fontWeight: 600,
  },
  stageBadge: {
    display: 'inline-block',
    fontSize: '0.8125rem',
    color: '#EAF2FF',
    fontWeight: 600,
    padding: '0.125rem 0.625rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    textTransform: 'capitalize',
  },
  actionsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  cropFitBtn: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '14px',
    border: '1px solid rgba(34,197,94,0.2)',
    background: 'rgba(34,197,94,0.06)',
    color: '#22C55E',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  editBtn: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
    transition: 'transform 0.1s ease, box-shadow 0.15s ease',
  },
  switchBtn: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)',
    color: '#9FB3C8',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1.5rem',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '0.9375rem',
    color: '#9FB3C8',
    margin: '0 0 1.25rem 0',
    lineHeight: 1.5,
  },
  skeletonWrap: {
    padding: '1.25rem',
  },
  skeletonCard: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '20px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  skeletonLine: {
    height: '1rem',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.06)',
    width: '100%',
  },
};
