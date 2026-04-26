/**
 * FarmEditModal — inline modal to edit farm details.
 *
 * Editable fields: farm name, location, country, size, sizeUnit, crop, cropStage, plantedAt.
 * Uses the PATCH /api/v2/farm-profile/:id endpoint.
 * Ownership verified server-side.
 */

import { useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { safeTrackEvent } from '../lib/analytics.js';

const CROP_STAGES = [
  'planning', 'land_preparation', 'planting', 'germination',
  'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
];

const STAGE_ICONS = {
  planning: '\uD83D\uDCDD',
  land_preparation: '\uD83D\uDE9C',
  planting: '\uD83C\uDF31',
  germination: '\uD83C\uDF3F',
  vegetative: '\uD83C\uDF3E',
  flowering: '\uD83C\uDF3C',
  fruiting: '\uD83C\uDF4E',
  harvest: '\uD83C\uDF3D',
  post_harvest: '\uD83D\uDCE6',
};

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
};

export default function FarmEditModal({ farm, onClose, onSaved }) {
  const { editFarm } = useProfile();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    farmName: farm.farmName || '',
    location: farm.location || '',
    country: farm.country || '',
    size: farm.size != null ? String(farm.size) : '',
    sizeUnit: farm.sizeUnit || 'ACRE',
    cropType: farm.cropType || '',
    cropStage: farm.cropStage || 'planning',
    plantedAt: farm.plantedAt ? String(farm.plantedAt).slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (saving) return;

    // Basic validation
    if (!form.farmName.trim()) {
      setError(t('setup.farmNameRequired'));
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        farmName: form.farmName.trim(),
        location: form.location.trim(),
        country: form.country.trim(),
        size: form.size ? Number(form.size) : undefined,
        sizeUnit: form.sizeUnit,
        cropType: form.cropType.trim() || undefined,
        cropStage: form.cropStage,
        plantedAt: form.plantedAt ? new Date(form.plantedAt).toISOString() : null,
      };

      const updated = await editFarm(farm.id, payload);
      safeTrackEvent('farm.edit_saved', { farmId: farm.id });
      if (onSaved) onSaved(updated);
      onClose();
    } catch (err) {
      console.error('Farm edit failed:', err);
      setError(err?.message || t('farm.editFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()} data-testid="farm-edit-modal">
        <h2 style={S.title}>{t('farm.editFarm')}</h2>

        <label style={S.label}>{t('setup.farmName')}</label>
        <input
          type="text"
          value={form.farmName}
          onChange={(e) => update('farmName', e.target.value)}
          style={S.input}
          data-testid="edit-farm-name"
        />

        <label style={S.label}>{t('setup.location')}</label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => update('location', e.target.value)}
          style={S.input}
        />

        <label style={S.label}>{t('setup.country')}</label>
        <input
          type="text"
          value={form.country}
          onChange={(e) => update('country', e.target.value)}
          style={S.input}
        />

        <div style={S.row}>
          <div style={S.half}>
            <label style={S.label}>{t('setup.farmSize')}</label>
            <input
              type="number"
              value={form.size}
              onChange={(e) => update('size', e.target.value)}
              style={S.input}
              min="0"
              step="0.01"
            />
          </div>
          <div style={S.half}>
            <label style={S.label}>{t('setup.sizeUnit')}</label>
            <div style={S.segRow}>
              <button
                type="button"
                onClick={() => update('sizeUnit', 'ACRE')}
                style={{ ...S.segBtn, ...(form.sizeUnit === 'ACRE' ? S.segBtnActive : {}) }}
              >
                {t('setup.acres')}
              </button>
              <button
                type="button"
                onClick={() => update('sizeUnit', 'HECTARE')}
                style={{ ...S.segBtn, ...(form.sizeUnit === 'HECTARE' ? S.segBtnActive : {}) }}
              >
                {t('setup.hectares')}
              </button>
            </div>
          </div>
        </div>

        <label style={S.label}>{t('setup.mainCrop')}</label>
        <input
          type="text"
          value={form.cropType}
          onChange={(e) => update('cropType', e.target.value)}
          style={S.input}
        />

        <label style={S.label}>{t('cropStage.label')}</label>
        <div style={S.stageGrid} data-testid="edit-crop-stage">
          {CROP_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => update('cropStage', s)}
              style={{
                ...S.stageChip,
                ...(form.cropStage === s ? S.stageChipActive : {}),
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{STAGE_ICONS[s]}</span>
              <span style={S.stageLabel}>{t(STAGE_KEYS[s])}</span>
            </button>
          ))}
        </div>

        <label style={S.label}>{t('cropStage.plantedDate')}</label>
        <input
          type="date"
          value={form.plantedAt}
          onChange={(e) => update('plantedAt', e.target.value)}
          style={S.input}
          data-testid="edit-planted-at"
        />

        {error && <p style={S.error}>{error}</p>}

        <div style={S.buttons}>
          <button onClick={onClose} style={S.cancelBtn} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} style={S.saveBtn} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    width: '100%',
    maxWidth: '28rem',
    background: '#1B2330',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.15)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 1rem 0',
  },
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '0.25rem',
    marginTop: '0.75rem',
  },
  input: {
    width: '100%',
    padding: '0.625rem 0.75rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: '0.9375rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  segRow: {
    display: 'flex',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.15)',
  },
  segBtn: {
    flex: 1,
    padding: '0.625rem 0.5rem',
    background: 'rgba(255,255,255,0.05)',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '40px',
    transition: 'background 0.15s, color 0.15s',
    WebkitTapHighlightColor: 'transparent',
  },
  segBtnActive: {
    background: '#22C55E',
    color: '#fff',
  },
  stageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.375rem',
  },
  stageChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.15rem',
    padding: '0.5rem 0.25rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    border: '2px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    minHeight: '48px',
    fontSize: '0.6875rem',
    fontWeight: 600,
    transition: 'border-color 0.15s, background 0.15s',
    WebkitTapHighlightColor: 'transparent',
  },
  stageChipActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.12)',
    color: '#fff',
  },
  stageLabel: {
    fontSize: '0.6rem',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  row: {
    display: 'flex',
    gap: '0.75rem',
  },
  half: {
    flex: 1,
  },
  error: {
    marginTop: '0.75rem',
    padding: '0.625rem 0.75rem',
    borderRadius: '10px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5',
    fontSize: '0.8125rem',
  },
  buttons: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1.25rem',
  },
  cancelBtn: {
    flex: 1,
    padding: '0.75rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  saveBtn: {
    flex: 1,
    padding: '0.75rem',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
