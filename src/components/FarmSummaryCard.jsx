/**
 * FarmSummaryCard — shows current farm context below the farm switcher.
 *
 * Displays: farm name, country/location, size + unit, main crop, crop stage, status.
 * Confirms which farm the user is currently viewing.
 * Edit button opens inline edit modal.
 */

import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { getCropIcon } from '../utils/crops.js';

const STAGE_KEYS = {
  planning: 'cropStage.planning',
  land_preparation: 'cropStage.landPreparation',
  planting: 'cropStage.planting',
  germination: 'cropStage.germination',
  vegetative: 'cropStage.vegetative',
  flowering: 'cropStage.flowering',
  fruiting: 'cropStage.fruiting',
  harvest: 'cropStage.harvest',
  post_harvest: 'cropStage.postHarvest',
  // Legacy
  growing: 'cropStage.vegetative',
};

const MONTH_SHORT = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatRange(start, end) {
  if (start == null || end == null) return null;
  return `${MONTH_SHORT[start]} – ${MONTH_SHORT[end]}`;
}

export default function FarmSummaryCard({ onEdit, onUpdateStage, onEditSeason }) {
  const { profile } = useProfile();
  const { t } = useTranslation();

  if (!profile) return null;

  const cropDisplay = profile.cropName || profile.cropType || '';
  const sizeDisplay = profile.size
    ? `${profile.size} ${(profile.sizeUnit || 'ACRE').toLowerCase()}${profile.size !== 1 ? 's' : ''}`
    : '';
  const locationDisplay = profile.location || profile.locationLabel || '';
  const countryDisplay = profile.country || '';
  const regionLine = [locationDisplay, countryDisplay].filter(Boolean).join(', ');

  const stageValue = profile.cropStage || 'planning';
  const stageLabel = t(STAGE_KEYS[stageValue] || STAGE_KEYS.planning);

  const seasonRange = formatRange(profile.seasonStartMonth, profile.seasonEndMonth);
  const plantingRange = formatRange(profile.plantingWindowStartMonth, profile.plantingWindowEndMonth);
  const hasSeasonalData = seasonRange || plantingRange || profile.currentSeasonLabel;

  return (
    <div style={S.card} data-testid="farm-summary-card">
      <div style={S.header}>
        <div style={S.farmName}>{profile.farmName || t('farm.unnamed')}</div>
        {profile.status === 'active' && (
          <span style={S.statusBadge}>{t('farm.statusActive')}</span>
        )}
      </div>

      <div style={S.details}>
        {regionLine && (
          <div style={S.detailRow}>
            <span style={S.detailIcon}>📍</span>
            <span style={S.detailText}>{regionLine}</span>
          </div>
        )}
        {sizeDisplay && (
          <div style={S.detailRow}>
            <span style={S.detailIcon}>📐</span>
            <span style={S.detailText}>{sizeDisplay}</span>
          </div>
        )}
        {cropDisplay && (
          <div style={S.detailRow}>
            <span style={S.detailIcon}>{getCropIcon(profile.cropType)}</span>
            <span style={S.detailText}>{cropDisplay}</span>
          </div>
        )}
        <div style={S.detailRow}>
          <span style={S.detailIcon}>📊</span>
          <span style={S.detailText} data-testid="crop-stage-display">{stageLabel}</span>
          {onUpdateStage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                safeTrackEvent('farm.update_stage_opened', { farmId: profile.id });
                onUpdateStage();
              }}
              style={S.stageBtn}
              data-testid="update-stage-btn"
            >
              {t('cropStage.update')}
            </button>
          )}
        </div>
      </div>

      {/* ─── Seasonal timing row ──── */}
      {hasSeasonalData && (
        <div style={S.seasonRow} data-testid="seasonal-timing-display">
          <span style={S.detailIcon}>🗓</span>
          <div style={S.seasonInfo}>
            {profile.currentSeasonLabel && (
              <span style={S.seasonLabel}>{profile.currentSeasonLabel}</span>
            )}
            {seasonRange && (
              <span style={S.seasonRange}>{t('seasonal.season')}: {seasonRange}</span>
            )}
            {plantingRange && (
              <span style={S.seasonRange}>{t('seasonal.plantingWindow')}: {plantingRange}</span>
            )}
          </div>
          {onEditSeason && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                safeTrackEvent('farm.edit_season_opened', { farmId: profile.id });
                onEditSeason();
              }}
              style={S.stageBtn}
              data-testid="edit-season-btn"
            >
              {t('seasonal.edit')}
            </button>
          )}
        </div>
      )}

      {!hasSeasonalData && onEditSeason && (
        <div
          style={S.seasonPrompt}
          onClick={() => {
            safeTrackEvent('farm.edit_season_opened', { farmId: profile.id });
            onEditSeason();
          }}
          data-testid="seasonal-timing-prompt"
        >
          <span style={S.detailIcon}>🗓</span>
          <span style={S.seasonPromptText}>{t('seasonal.setPrompt')}</span>
        </div>
      )}

      {onEdit && (
        <button
          onClick={() => {
            safeTrackEvent('farm.edit_opened', { farmId: profile.id });
            onEdit(profile);
          }}
          style={S.editBtn}
          data-testid="farm-edit-btn"
        >
          {t('farm.editFarm')}
        </button>
      )}
    </div>
  );
}

const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1rem 1.25rem',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '0.625rem',
  },
  farmName: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#fff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#86EFAC',
    background: 'rgba(134,239,172,0.1)',
    borderRadius: '6px',
    padding: '0.15rem 0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    flexShrink: 0,
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  detailIcon: {
    fontSize: '0.875rem',
    flexShrink: 0,
    width: '1.25rem',
    textAlign: 'center',
  },
  detailText: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stageBtn: {
    marginLeft: 'auto',
    background: 'rgba(34,197,94,0.15)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: '8px',
    padding: '0.2rem 0.6rem',
    color: '#86EFAC',
    fontSize: '0.6875rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  seasonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
    padding: '0.5rem 0.625rem',
    borderRadius: '10px',
    background: 'rgba(96,165,250,0.06)',
    border: '1px solid rgba(96,165,250,0.15)',
  },
  seasonInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    flex: 1,
    minWidth: 0,
  },
  seasonLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#93C5FD',
  },
  seasonRange: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.45)',
  },
  seasonPrompt: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
    padding: '0.5rem 0.625rem',
    borderRadius: '10px',
    background: 'rgba(96,165,250,0.06)',
    border: '1px dashed rgba(96,165,250,0.2)',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  seasonPromptText: {
    fontSize: '0.75rem',
    color: 'rgba(147,197,253,0.7)',
  },
  editBtn: {
    marginTop: '0.75rem',
    width: '100%',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    padding: '0.5rem',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
};
