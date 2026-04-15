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
        setAvatarError(t('avatar.compressFailed') || 'Could not process image');
      }
    } catch {
      setAvatarError(t('avatar.uploadFailed') || 'Upload failed');
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
          <button type="button" onClick={() => navigate('/dashboard')} style={S.backBtn}>
            <span style={S.backArrow}>&larr;</span>
          </button>
          <h1 style={S.pageTitle}>{t('myFarm.title') || 'My Farm'}</h1>
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
        <button type="button" onClick={() => navigate('/dashboard')} style={S.backBtn}>
          <span style={S.backArrow}>&larr;</span>
        </button>
        <h1 style={S.pageTitle}>{t('myFarm.title') || 'My Farm'}</h1>
      </div>

      {/* Farm card */}
      {farm ? (
        <div style={S.cardWrap}>
          <div style={S.card}>
            {/* Avatar + farm name */}
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

            <div style={S.farmNameRow}>
              <span style={S.farmEmoji}>{'\uD83C\uDFE1'}</span>
              <h2 style={S.farmName}>{farm.farmName || farm.name || t('myFarm.unnamedFarm') || 'My Farm'}</h2>
            </div>

            <div style={S.detailsList}>
              {/* Crop */}
              {(farm.cropType || farm.crop) && (
                <div style={S.detailRow}>
                  <span style={S.detailIcon}>{getCropIcon(farm.cropType || farm.crop) || getCropEmoji(farm.cropType || farm.crop)}</span>
                  <div>
                    <span style={S.detailLabel}>{t('myFarm.crop')}</span>
                    <span style={S.detailValue}>{getCropLabel(farm.cropType || farm.crop)}</span>
                  </div>
                </div>
              )}

              {/* Location */}
              {(farm.location || farm.locationLabel) && (
                <div style={S.detailRow}>
                  <span style={S.detailIcon}>📍</span>
                  <div>
                    <span style={S.detailLabel}>{t('myFarm.location')}</span>
                    <span style={S.detailValue}>{farm.location || farm.locationLabel}</span>
                  </div>
                </div>
              )}

              {/* Farm size */}
              {farm.size && (
                <div style={S.detailRow}>
                  <span style={S.detailIcon}>📐</span>
                  <div>
                    <span style={S.detailLabel}>{t('myFarm.size')}</span>
                    <span style={S.detailValue}>
                      {formatSize(farm.size, farm.sizeUnit)}
                    </span>
                  </div>
                </div>
              )}

              {/* Stage */}
              {farm.cropStage && (
                <div style={S.detailRow}>
                  <span style={S.detailIcon}>{STAGE_EMOJIS[farm.cropStage] || '📊'}</span>
                  <div>
                    <span style={S.detailLabel}>{t('myFarm.stage')}</span>
                    <span style={S.stageBadge}>
                      {t(STAGE_KEYS[farm.cropStage]) || farm.cropStage.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Country */}
              {(farm.country || farm.countryCode) && (
                <div style={S.detailRow}>
                  <span style={S.detailIcon}>🌍</span>
                  <div>
                    <span style={S.detailLabel}>{t('myFarm.country') || 'Country'}</span>
                    <span style={S.detailValue}>{farm.country || farm.countryCode}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Edit button */}
            <button
              type="button"
              onClick={() => navigate('/profile/setup')}
              style={S.editBtn}
            >
              {t('myFarm.edit') || 'Edit Farm'}
            </button>

            {/* Multi-farm switcher */}
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
          <p style={S.emptyText}>{t('myFarm.noFarm') || 'No farm found. Set up your farm to get started.'}</p>
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
    background: '#0F172A',
    padding: '0 0 2rem 0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    position: 'sticky',
    top: 0,
    background: '#0F172A',
    zIndex: 50,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    padding: 0,
  },
  backArrow: {
    color: '#fff',
    fontSize: '1.125rem',
  },
  pageTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },
  cardWrap: {
    padding: '1.25rem',
  },
  card: {
    background: '#1B2330',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  avatarSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  avatarActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  avatarBtn: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#86EFAC',
    background: 'none',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: '8px',
    padding: '0.375rem 0.75rem',
    cursor: 'pointer',
    minHeight: '32px',
    WebkitTapHighlightColor: 'transparent',
  },
  avatarRemoveBtn: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
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
  farmNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    marginBottom: '1.25rem',
  },
  farmEmoji: {
    fontSize: '1.5rem',
    flexShrink: 0,
  },
  farmName: {
    fontSize: '1.375rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    lineHeight: 1.3,
  },
  detailsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  detailIcon: {
    fontSize: '1.125rem',
    flexShrink: 0,
    marginTop: '1px',
  },
  detailLabel: {
    display: 'block',
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
    marginBottom: '0.125rem',
  },
  detailValue: {
    display: 'block',
    fontSize: '0.9375rem',
    color: '#fff',
    fontWeight: 500,
  },
  stageBadge: {
    display: 'inline-block',
    fontSize: '0.8125rem',
    color: '#86EFAC',
    fontWeight: 600,
    padding: '0.125rem 0.625rem',
    borderRadius: '999px',
    background: 'rgba(34,197,94,0.12)',
    textTransform: 'capitalize',
  },
  editBtn: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    marginBottom: '0.5rem',
  },
  switchBtn: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
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
    color: 'rgba(255,255,255,0.5)',
    margin: '0 0 1.25rem 0',
    lineHeight: 1.5,
  },
  skeletonWrap: {
    padding: '1.25rem',
  },
  skeletonCard: {
    background: '#1B2330',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  skeletonLine: {
    height: '1rem',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.08)',
    width: '100%',
  },
};
