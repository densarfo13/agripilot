/**
 * StepFarmSetup — Step 5 of Simple Onboarding.
 *
 * Three optional fields:
 *   A. Farm name        (defaulted by crop)
 *   B. Farm size        (radio chips, optional)
 *   C. Planting date    (chip groups, "I don't know" allowed)
 *
 * Spec §6: nothing here is required. The flow can complete
 * with just a farm name (auto-filled from the crop).
 */

import React from 'react';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';
import { getLocalizedCropName } from '../i18n/cropNames.js';

const FARM_SIZE_CHOICES = Object.freeze([
  { id: 'backyard',  labelKey: 'onboarding.size.backyard',  fallback: 'Small backyard' },
  { id: 'lt1acre',   labelKey: 'onboarding.size.lt1Acre',   fallback: 'Less than 1 acre' },
  { id: '1to5acres', labelKey: 'onboarding.size.1to5Acres', fallback: '1\u20135 acres' },
  { id: 'gt5acres',  labelKey: 'onboarding.size.gt5Acres',  fallback: '5+ acres' },
  { id: 'unknown',   labelKey: 'onboarding.size.unknown',   fallback: 'I don\u2019t know' },
]);

const PLANTING_CHOICES = Object.freeze([
  { id: 'today',     labelKey: 'onboarding.planted.today',     fallback: 'Today' },
  { id: 'thisweek',  labelKey: 'onboarding.planted.thisWeek',  fallback: 'This week' },
  { id: 'thismonth', labelKey: 'onboarding.planted.thisMonth', fallback: 'This month' },
  { id: 'unknown',   labelKey: 'onboarding.planted.unknown',   fallback: 'I don\u2019t know' },
]);

function defaultFarmName(cropId, lang) {
  if (!cropId || cropId === 'other') return 'My Farm';
  const localised = getLocalizedCropName(cropId, lang);
  return `My ${localised} Farm`;
}

function isoDayFromChoice(choice) {
  const now = new Date();
  if (choice === 'today') return now.toISOString().slice(0, 10);
  if (choice === 'thisweek') {
    now.setDate(now.getDate() - 3);
    return now.toISOString().slice(0, 10);
  }
  if (choice === 'thismonth') {
    now.setDate(now.getDate() - 14);
    return now.toISOString().slice(0, 10);
  }
  return null;
}

export default function StepFarmSetup({ value, onChange }) {
  const { lang } = useTranslation();

  // Auto-fill the farm name on first paint when blank.
  React.useEffect(() => {
    if (!value.farmName) {
      onChange({ farmName: defaultFarmName(value.cropId, lang) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickPlanting(choice) {
    onChange({
      plantingDate:      isoDayFromChoice(choice),
      plantingDateKnown: choice !== 'unknown',
      plantingChoice:    choice,
    });
  }

  return (
    <section style={S.wrap} data-testid="onboarding-step-setup">
      <h1 style={S.title}>
        {tSafe('onboarding.farmSetupTitle', 'Tell us a little about your farm')}
      </h1>
      <p style={S.helper}>
        {tSafe('onboarding.farmSetupHelper',
          'You can leave any of these blank — we only need enough to plan today.')}
      </p>

      {/* A. Farm name */}
      <label style={S.field}>
        <span style={S.label}>
          {tSafe('onboarding.farmName', 'Farm name')}
        </span>
        <input
          type="text"
          value={value.farmName || ''}
          onChange={(e) => onChange({ farmName: e.target.value })}
          placeholder={defaultFarmName(value.cropId, lang)}
          style={S.input}
          data-testid="onboarding-farm-name"
        />
      </label>

      {/* B. Farm size */}
      <div style={S.field}>
        <span style={S.label}>
          {tSafe('onboarding.farmSize', 'Farm size')}
        </span>
        <div style={S.chipRow}>
          {FARM_SIZE_CHOICES.map((c) => {
            const active = value.farmSize === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange({ farmSize: c.id })}
                style={{ ...S.chip, ...(active ? S.chipActive : null) }}
                data-testid={`onboarding-size-${c.id}`}
              >
                {tSafe(c.labelKey, c.fallback)}
              </button>
            );
          })}
        </div>
      </div>

      {/* C. Planting date */}
      <div style={S.field}>
        <span style={S.label}>
          {tSafe('onboarding.plantingDate', 'When did you plant?')}
        </span>
        <div style={S.chipRow}>
          {PLANTING_CHOICES.map((c) => {
            const active = value.plantingChoice === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pickPlanting(c.id)}
                style={{ ...S.chip, ...(active ? S.chipActive : null) }}
                data-testid={`onboarding-planted-${c.id}`}
              >
                {tSafe(c.labelKey, c.fallback)}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  title: { margin: 0, fontSize: '1.375rem', fontWeight: 700, color: '#EAF2FF' },
  helper: { margin: 0, color: '#9FB3C8', fontSize: '0.9375rem', lineHeight: 1.45 },
  field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: {
    fontSize: '0.8125rem', color: '#9FB3C8', fontWeight: 600,
  },
  input: {
    minHeight: 48,
    padding: '0 0.875rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: '#0F1F3A',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    outline: 'none',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem' },
  chip: {
    padding: '0.5rem 0.75rem',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 36,
  },
  chipActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.14)',
    color: '#86EFAC',
    fontWeight: 700,
  },
};
