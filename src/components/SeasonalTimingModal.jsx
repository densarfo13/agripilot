/**
 * SeasonalTimingModal — edit seasonal timing for a farm.
 *
 * Month dropdowns for season range and planting window.
 * Optional season label and date fields.
 * Saves via PATCH /api/v2/farm-profile/:id/seasonal-timing.
 * Dark theme, low-literacy friendly.
 */

import { useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { updateSeasonalTiming } from '../lib/api.js';

const MONTHS = [
  { value: '', label: '—' },
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
];

function toNum(val) {
  if (val === '' || val == null) return null;
  return Number(val);
}

export default function SeasonalTimingModal({ farm, onClose, onSaved }) {
  const { refreshProfile } = useProfile();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    seasonStartMonth: farm?.seasonStartMonth ?? '',
    seasonEndMonth: farm?.seasonEndMonth ?? '',
    plantingWindowStartMonth: farm?.plantingWindowStartMonth ?? '',
    plantingWindowEndMonth: farm?.plantingWindowEndMonth ?? '',
    currentSeasonLabel: farm?.currentSeasonLabel || '',
    lastRainySeasonStart: farm?.lastRainySeasonStart
      ? String(farm.lastRainySeasonStart).slice(0, 10) : '',
    lastDrySeasonStart: farm?.lastDrySeasonStart
      ? String(farm.lastDrySeasonStart).slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError('');

    try {
      const payload = {
        seasonStartMonth: toNum(form.seasonStartMonth),
        seasonEndMonth: toNum(form.seasonEndMonth),
        plantingWindowStartMonth: toNum(form.plantingWindowStartMonth),
        plantingWindowEndMonth: toNum(form.plantingWindowEndMonth),
        currentSeasonLabel: form.currentSeasonLabel.trim() || null,
        lastRainySeasonStart: form.lastRainySeasonStart
          ? new Date(form.lastRainySeasonStart).toISOString() : null,
        lastDrySeasonStart: form.lastDrySeasonStart
          ? new Date(form.lastDrySeasonStart).toISOString() : null,
      };

      await updateSeasonalTiming(farm.id, payload);
      await refreshProfile();
      safeTrackEvent('farm.seasonal_timing_updated', { farmId: farm.id });
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Seasonal timing update failed:', err);
      setError(err?.message || t('seasonal.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function MonthSelect({ value, onChange, testId }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={S.select}
        data-testid={testId}
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()} data-testid="seasonal-timing-modal">
        <h2 style={S.title}>{t('seasonal.title')}</h2>
        <p style={S.subtitle}>{t('seasonal.subtitle')}</p>

        {/* Season range */}
        <label style={S.label}>{t('seasonal.seasonRange')}</label>
        <div style={S.row}>
          <div style={S.half}>
            <span style={S.fieldHint}>{t('seasonal.start')}</span>
            <MonthSelect
              value={form.seasonStartMonth}
              onChange={(v) => update('seasonStartMonth', v)}
              testId="season-start"
            />
          </div>
          <div style={S.half}>
            <span style={S.fieldHint}>{t('seasonal.end')}</span>
            <MonthSelect
              value={form.seasonEndMonth}
              onChange={(v) => update('seasonEndMonth', v)}
              testId="season-end"
            />
          </div>
        </div>

        {/* Planting window */}
        <label style={S.label}>{t('seasonal.plantingWindow')}</label>
        <div style={S.row}>
          <div style={S.half}>
            <span style={S.fieldHint}>{t('seasonal.start')}</span>
            <MonthSelect
              value={form.plantingWindowStartMonth}
              onChange={(v) => update('plantingWindowStartMonth', v)}
              testId="planting-start"
            />
          </div>
          <div style={S.half}>
            <span style={S.fieldHint}>{t('seasonal.end')}</span>
            <MonthSelect
              value={form.plantingWindowEndMonth}
              onChange={(v) => update('plantingWindowEndMonth', v)}
              testId="planting-end"
            />
          </div>
        </div>

        {/* Season label */}
        <label style={S.label}>{t('seasonal.seasonLabel')}</label>
        <input
          type="text"
          value={form.currentSeasonLabel}
          onChange={(e) => update('currentSeasonLabel', e.target.value)}
          placeholder={t('seasonal.seasonLabelPlaceholder')}
          style={S.input}
          data-testid="season-label"
        />

        {/* Rainy/dry season dates */}
        <div style={S.row}>
          <div style={S.half}>
            <label style={S.label}>{t('seasonal.lastRainy')}</label>
            <input
              type="date"
              value={form.lastRainySeasonStart}
              onChange={(e) => update('lastRainySeasonStart', e.target.value)}
              style={S.input}
              data-testid="last-rainy"
            />
          </div>
          <div style={S.half}>
            <label style={S.label}>{t('seasonal.lastDry')}</label>
            <input
              type="date"
              value={form.lastDrySeasonStart}
              onChange={(e) => update('lastDrySeasonStart', e.target.value)}
              style={S.input}
              data-testid="last-dry"
            />
          </div>
        </div>

        {error && <p style={S.error}>{error}</p>}

        <div style={S.buttons}>
          <button onClick={onClose} style={S.cancelBtn} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} style={S.saveBtn} disabled={saving} data-testid="save-seasonal-btn">
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
    margin: '0 0 0.25rem 0',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.5)',
    margin: '0 0 1rem 0',
  },
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '0.25rem',
    marginTop: '0.75rem',
  },
  fieldHint: {
    display: 'block',
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: '0.15rem',
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
  select: {
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
