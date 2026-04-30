/**
 * StepCropSelection — Step 4 of Simple Onboarding.
 *
 * Big visual tap cards. Crop labels are routed through the
 * cropNames overlay so Twi/Hausa pickers see partner-supplied
 * names (Aburo / Masara / Mako / etc.) instead of English
 * defaults.
 *
 * "Other" reveals a free-text input — typed value persists as
 * cropName, with cropId stamped 'other'.
 */

import React from 'react';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';
import { getLocalizedCropName } from '../i18n/cropNames.js';
import { getRegionCrops } from '../config/regionConfig.js';

// Emoji catalogue. Falls back to a generic seedling for any
// crop the region config surfaces that we don't have an icon
// for (e.g. avocado, coffee, soybean) — keeps new countries
// shippable without a code change here.
const CROP_EMOJI = Object.freeze({
  maize:    '\uD83C\uDF3D',
  corn:     '\uD83C\uDF3D',
  tomato:   '\uD83C\uDF45',
  pepper:   '\uD83C\uDF36',
  chili:    '\uD83C\uDF36',
  onion:    '\uD83E\uDDC5',
  ginger:   '\uD83E\uDED8',
  okra:     '\uD83D\uDFE2',
  cassava:  '\uD83C\uDF31',
  yam:      '\uD83C\uDF60',
  rice:     '\uD83C\uDF5A',
  wheat:    '\uD83C\uDF3E',
  beans:    '\uD83E\uDED8',
  potato:   '\uD83E\uDD54',
  kale:     '\uD83E\uDD6C',
  lettuce:  '\uD83E\uDD6C',
  herbs:    '\uD83C\uDF3F',
  cucumber: '\uD83E\uDD52',
  coconut:  '\uD83E\uDD65',
  banana:   '\uD83C\uDF4C',
  soybean:  '\uD83E\uDED8',
  coffee:   '\u2615',
  avocado:  '\uD83E\uDD51',
});

const FALLBACK_EMOJI = '\uD83C\uDF31';

function emojiFor(cropId) {
  return CROP_EMOJI[String(cropId || '').toLowerCase()] || FALLBACK_EMOJI;
}

export default function StepCropSelection({ value, onChange }) {
  const { lang } = useTranslation();
  const isOther = value.cropId === 'other';
  const [otherName, setOtherName] = React.useState(
    isOther ? (value.cropName || '') : '',
  );

  // Region-aware crop list (spec §6). Falls back to the
  // DEFAULT_REGION_CONFIG list when the country isn't known.
  const regionCrops = React.useMemo(
    () => (getRegionCrops(value.country) || []).map((id) => ({
      id, emoji: emojiFor(id),
    })),
    [value.country],
  );

  function pickCrop(cropId) {
    if (cropId === 'other') {
      onChange({ cropId: 'other', cropName: otherName || '' });
      return;
    }
    onChange({
      cropId,
      cropName: getLocalizedCropName(cropId, 'en'), // canonical en for the
                                                    // server contract; the
                                                    // UI renders via lang
    });
  }

  function commitOther(next) {
    setOtherName(next);
    onChange({ cropId: 'other', cropName: next });
  }

  return (
    <section style={S.wrap} data-testid="onboarding-step-crop">
      <h1 style={S.title}>
        {tSafe('onboarding.cropTitle', 'Pick your crop')}
      </h1>
      <p style={S.helper}>
        {tSafe('onboarding.cropHelper',
          'You can grow more crops later — pick the one you want guidance for first.')}
      </p>

      <div style={S.grid}>
        {regionCrops.map((c) => {
          const active = value.cropId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => pickCrop(c.id)}
              style={{ ...S.tile, ...(active ? S.tileActive : null) }}
              data-testid={`onboarding-crop-${c.id}`}
            >
              <span style={S.tileEmoji} aria-hidden="true">{c.emoji}</span>
              <span style={S.tileLabel}>
                {getLocalizedCropName(c.id, lang)}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => pickCrop('other')}
          style={{ ...S.tile, ...(isOther ? S.tileActive : null) }}
          data-testid="onboarding-crop-other"
        >
          <span style={S.tileEmoji} aria-hidden="true">{'\u2795'}</span>
          <span style={S.tileLabel}>
            {tSafe('onboarding.cropOther', 'Other')}
          </span>
        </button>
      </div>

      {isOther && (
        <label style={S.otherLabel}>
          {tSafe('onboarding.cropOtherPlaceholder', 'Name your crop')}
          <input
            type="text"
            value={otherName}
            onChange={(e) => commitOther(e.target.value)}
            placeholder={tSafe('onboarding.cropOtherExample',
              'e.g. cassava, plantain')}
            style={S.input}
            data-testid="onboarding-crop-other-input"
          />
        </label>
      )}
    </section>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  title: { margin: 0, fontSize: '1.375rem', fontWeight: 700, color: '#EAF2FF' },
  helper: { margin: 0, color: '#9FB3C8', fontSize: '0.9375rem', lineHeight: 1.45 },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.625rem',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '1rem 0.75rem',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    cursor: 'pointer',
    minHeight: 92,
  },
  tileActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.12)',
    color: '#86EFAC',
  },
  tileEmoji: { fontSize: '1.75rem', lineHeight: 1 },
  tileLabel: { fontSize: '0.875rem', fontWeight: 700 },
  otherLabel: {
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
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
};
