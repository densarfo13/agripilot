/**
 * FarmSummaryCard — shows farm overview including crop stage + update button.
 * Includes seasonal timing display, location, size, crop info, and edit button.
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';

// Stage keys mapping (canonical key → i18n key)
const STAGE_KEYS = {
  planning:         'cropStage.planning',
  land_preparation: 'cropStage.land_preparation',
  germination:      'cropStage.germination',
  vegetative:       'cropStage.vegetative',
  flowering:        'cropStage.flowering',
  fruiting:         'cropStage.fruiting',
  maturation:       'cropStage.maturation',
  harvest:          'cropStage.harvest',
  post_harvest:     'cropStage.post_harvest',
  // Legacy alias
  growing: 'cropStage.vegetative',
};

/**
 * Format a month range like "Mar – Jul".
 * Returns null if either value is missing.
 */
function formatRange(startMonth, endMonth) {
  const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!startMonth || !endMonth) return null;
  const s = MONTH_SHORT[startMonth];
  const e = MONTH_SHORT[endMonth];
  if (!s || !e) return null;
  return `${s} – ${e}`;
}

export default function FarmSummaryCard({ profile, onUpdateStage, onEditSeason, onEdit }) {
  const { t } = useTranslation();

  if (!profile) return null;

  const cropStage = profile.cropStage || 'planning';
  const stageKey = STAGE_KEYS[cropStage] || 'cropStage.planning';

  // Seasonal timing data
  const currentSeasonLabel = profile.currentSeasonLabel || null;
  const seasonRange = formatRange(profile.seasonStartMonth, profile.seasonEndMonth);
  const plantingRange = formatRange(profile.plantingWindowStartMonth, profile.plantingWindowEndMonth);
  const hasSeasonalData = !!(profile.seasonStartMonth || profile.seasonEndMonth || currentSeasonLabel);

  // Status badge
  const statusBadge = profile.status === 'active' || !profile.status ? 'active' : profile.status;

  function handleUpdateStage() {
    // Track analytics
    try {
      if (typeof window !== 'undefined' && window.analytics) {
        window.analytics.track('farm.update_stage_opened', { cropStage });
      }
    } catch { /* ignore */ }
    if (onUpdateStage) onUpdateStage();
  }

  return (
    <div
      data-testid="farm-summary-card"
      style={{
        background: '#1B2330',
        borderRadius: 16,
        padding: '1.25rem',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Farm name + status badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
          {profile.farmName || tSafe('farm.myFarm', {}, 'My Farm')}
        </h3>
        {statusBadge === 'active' && (
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4ADE80',
                         background: 'rgba(200,148,77,0.1)', border: '1px solid rgba(200,148,77,0.25)',
                         borderRadius: 999, padding: '2px 8px' }}>
            {t('farm.statusActive')}
          </span>
        )}
      </div>

      {/* Location & country */}
      {(profile.location || profile.country) && (
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>
          {[profile.location, profile.country].filter(Boolean).join(', ')}
        </p>
      )}

      {/* Size + unit */}
      {profile.size != null && (
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>
          {profile.size} {profile.sizeUnit || 'ACRE'}
        </p>
      )}

      {/* Crop */}
      {(profile.cropName || profile.cropType) && (
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8125rem', margin: '0 0 0.75rem' }}>
          {profile.cropName || profile.cropType}
        </p>
      )}

      {/* Crop stage display */}
      <div data-testid="crop-stage-display" style={{ marginBottom: '0.75rem' }}>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', margin: '0 0 0.25rem' }}>
          {tSafe('farm.cropStage', {}, 'Crop Stage')}
        </p>
        <p style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
          {tSafe(stageKey, {}, cropStage)}
        </p>
      </div>

      {/* Seasonal timing display */}
      {hasSeasonalData ? (
        <div data-testid="seasonal-timing-display" style={{ marginBottom: '0.75rem' }}>
          {currentSeasonLabel && (
            <p style={{ color: '#4ADE80', fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
              {currentSeasonLabel}
            </p>
          )}
          {seasonRange && (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', margin: '0 0 0.125rem' }}>
              {tSafe('seasonal.seasonRange', {}, 'Season')}: {seasonRange}
            </p>
          )}
          {plantingRange && (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', margin: 0 }}>
              {tSafe('seasonal.plantingWindow', {}, 'Planting')}: {plantingRange}
            </p>
          )}
          {onEditSeason && (
            <button
              onClick={onEditSeason}
              style={{ background: 'none', border: 'none', color: '#4ADE80',
                       fontSize: '0.75rem', cursor: 'pointer', padding: '0.25rem 0', marginTop: '0.25rem' }}
            >
              {tSafe('seasonal.edit', {}, 'Edit Season')}
            </button>
          )}
        </div>
      ) : (
        <div data-testid="seasonal-timing-prompt" style={{ marginBottom: '0.75rem' }}>
          <button
            onClick={onEditSeason}
            style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.2)',
                     color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem',
                     cursor: 'pointer', padding: '0.375rem 0.75rem', borderRadius: 8 }}
          >
            {tSafe('seasonal.setPrompt', {}, '+ Set planting season')}
          </button>
        </div>
      )}

      {/* Edit farm button */}
      {onEdit && (
        <button
          data-testid="farm-edit-btn"
          onClick={() => onEdit(profile)}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.12)',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            marginBottom: '0.5rem',
            marginRight: '0.5rem',
          }}
        >
          {t('farm.editFarm')}
        </button>
      )}

      <button
        data-testid="update-stage-btn"
        onClick={handleUpdateStage}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.08)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        {tSafe('farm.updateStage', {}, 'Update Stage')}
      </button>
    </div>
  );
}
