/**
 * CropStageModal — select crop stage + planted date, then save.
 *
 * Tap a stage to select it. Edit planted date if needed.
 * Tap Save to commit via updateCropStage API.
 * Shows inline success/error feedback.
 * Dark theme, large touch targets, low-literacy friendly.
 */

import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { updateCropStage } from '../runtime/auth.js';
import { safeTrackEvent } from '../lib/analytics.js';

// Stages defined inline with value + icon for visual clarity
const STAGES = [
  { value: 'planning',         icon: '📋' },
  { value: 'land_preparation', icon: '🚜' },
  { value: 'planting',         icon: '🌱' },
  { value: 'germination',      icon: '🌿' },
  { value: 'vegetative',       icon: '🌾' },
  { value: 'flowering',        icon: '🌸' },
  { value: 'fruiting',         icon: '🍅' },
  { value: 'harvest',          icon: '🧺' },
  { value: 'post_harvest',     icon: '📦' },
];

const STAGE_LABEL_KEYS = {
  planning:         'cropStage.planning',
  land_preparation: 'cropStage.land_preparation',
  planting:         'cropStage.planting',
  germination:      'cropStage.germination',
  vegetative:       'cropStage.vegetative',
  flowering:        'cropStage.flowering',
  fruiting:         'cropStage.fruiting',
  harvest:          'cropStage.harvest',
  post_harvest:     'cropStage.post_harvest',
};

export default function CropStageModal({ farm, onClose, onSaved }) {
  const { refreshProfile } = useProfile();
  const { isOnline } = useNetwork();
  const { t } = useTranslation();

  const currentStage = farm?.cropStage || 'planning';
  const currentPlantedAt = farm?.plantedAt || '';

  const [selected, setSelected] = useState(currentStage);
  const [plantedAt, setPlantedAt] = useState(currentPlantedAt);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const feedbackTimer = useRef(null);

  // Track whether the farmer made any changes
  const hasChanges = selected !== currentStage || plantedAt !== currentPlantedAt;

  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

  async function handleSave() {
    if (!hasChanges || saving) return;
    setSaving(true);
    setFeedback(null);

    // Track the stage update event
    try {
      safeTrackEvent('farm.crop_stage_updated', {
        farmId: farm.id,
        stage: selected,
        plantedAt,
      });
    } catch { /* never block UI */ }

    try {
      const payload = { cropStage: selected };
      if (plantedAt) payload.plantedAt = plantedAt;

      await updateCropStage(farm.id, selected, {
        plantedAt,
        isOnline,
        refreshProfile,
      });

      setFeedback({ type: 'success', message: t('cropStage.saved') });
      feedbackTimer.current = setTimeout(() => {
        if (onSaved) onSaved(selected);
        onClose();
      }, 1200);
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || t('cropStage.saveFailed') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div
        style={S.modal}
        onClick={(e) => e.stopPropagation()}
        data-testid="crop-stage-modal"
      >
        <h2 style={S.title}>{t('cropStage.title')}</h2>
        <p style={S.subtitle}>{t('cropStage.subtitle')}</p>

        {feedback && (
          <div style={feedback.type === 'success' ? S.successBanner : S.errorBanner}>
            <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Stage grid */}
        <div style={S.stageGrid}>
          {STAGES.map((s) => {
            const isActive = selected === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setSelected(s.value)}
                disabled={saving}
                aria-label={t(STAGE_LABEL_KEYS[s.value]) || s.value}
                style={{
                  ...S.stageBtn,
                  ...(isActive ? S.stageBtnActive : {}),
                }}
                data-testid={`stage-${s.value}`}
              >
                <span style={S.stageIcon}>{s.icon}</span>
                <span style={{
                  ...S.stageLabel,
                  ...(isActive ? S.stageLabelActive : {}),
                }}>
                  {t(STAGE_LABEL_KEYS[s.value])}
                </span>
              </button>
            );
          })}
        </div>

        {/* Planted date input */}
        <label style={S.dateLabel}>{t('cropStage.plantedAt')}</label>
        <input
          type="date"
          value={plantedAt}
          onChange={(e) => setPlantedAt(e.target.value)}
          style={S.dateInput}
          data-testid="planted-at-input"
        />

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          style={{
            ...S.saveBtn,
            ...(!hasChanges || saving ? S.saveBtnDisabled : {}),
          }}
          data-testid="save-stage-btn"
        >
          {saving ? t('common.saving') : t('cropStage.save')}
        </button>

        <button
          type="button"
          onClick={onClose}
          style={S.cancelBtn}
          disabled={saving}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '0',
  },
  modal: {
    width: '100%',
    maxWidth: '30rem',
    background: '#1B2330',
    borderRadius: '20px 20px 0 0',
    padding: '1.5rem',
    maxHeight: '90vh',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 0.25rem 0',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.55)',
    margin: '0 0 1rem 0',
    textAlign: 'center',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: 12,
    background: 'rgba(200,148,77,0.08)',
    color: '#4ADE80',
    fontSize: '0.875rem',
    marginBottom: '0.75rem',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: 12,
    background: 'rgba(239,68,68,0.08)',
    color: '#EF4444',
    fontSize: '0.875rem',
    marginBottom: '0.75rem',
  },
  stageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  stageBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
    padding: '0.75rem 0.5rem',
    minHeight: '70px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.05)',
    border: '1.5px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.65)',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  stageBtnActive: {
    background: 'rgba(200,148,77,0.12)',
    border: '1.5px solid rgba(200,148,77,0.4)',
    color: '#4ADE80',
  },
  stageIcon: {
    fontSize: '1.25rem',
  },
  stageLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.2,
  },
  stageLabelActive: {
    color: '#4ADE80',
  },
  dateLabel: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.35rem',
  },
  dateInput: {
    width: '100%',
    padding: '0.625rem 0.75rem',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    fontSize: '0.9rem',
    marginBottom: '1rem',
    boxSizing: 'border-box',
  },
  saveBtn: {
    width: '100%',
    padding: '0.875rem',
    minHeight: '52px',
    borderRadius: 12,
    background: '#C8944D',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9375rem',
    border: 'none',
    cursor: 'pointer',
    marginBottom: '0.5rem',
    WebkitTapHighlightColor: 'transparent',
  },
  saveBtnDisabled: {
    background: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'not-allowed',
  },
  cancelBtn: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: 12,
    background: 'transparent',
    color: 'rgba(255,255,255,0.55)',
    fontWeight: 600,
    fontSize: '0.875rem',
    border: '1px solid rgba(255,255,255,0.12)',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
};
