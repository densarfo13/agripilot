/**
 * StepFarmerType — Step 1 of the Simple Onboarding flow.
 *
 *   "Are you new to farming?"
 *      🌱 Yes, I'm new
 *      🌾 I already farm
 *
 * Choice persists straight into the onboarding profile so a
 * mid-flow refresh restores the same selection.
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';

export default function StepFarmerType({ value, onChange, onContinue }) {
  function pick(next) {
    onChange({ farmerType: next });
    // Auto-advance — feels snappy on mobile and avoids a
    // dead Continue tap.
    setTimeout(() => onContinue && onContinue(), 120);
  }

  return (
    <section style={S.wrap} data-testid="onboarding-step-farmer-type">
      <h1 style={S.title}>
        {tSafe('onboarding.farmerTypeTitle', 'Are you new to farming?')}
      </h1>
      <p style={S.helper}>
        {tSafe('onboarding.farmerTypeHelper',
          'We\u2019ll keep guidance simple if you are starting out.')}
      </p>

      <div style={S.choices}>
        <button
          type="button"
          onClick={() => pick('new')}
          style={{
            ...S.choice,
            ...(value === 'new' ? S.choiceActive : null),
          }}
          data-testid="onboarding-farmer-new"
        >
          <span style={S.choiceIcon} aria-hidden="true">{'\uD83C\uDF31'}</span>
          <span style={S.choiceText}>
            {tSafe('onboarding.newFarmer', 'Yes, I\u2019m new')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => pick('experienced')}
          style={{
            ...S.choice,
            ...(value === 'experienced' ? S.choiceActive : null),
          }}
          data-testid="onboarding-farmer-experienced"
        >
          <span style={S.choiceIcon} aria-hidden="true">{'\uD83C\uDF3E'}</span>
          <span style={S.choiceText}>
            {tSafe('onboarding.experiencedFarmer', 'I already farm')}
          </span>
        </button>
      </div>
    </section>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  title: { margin: 0, fontSize: '1.375rem', fontWeight: 700, color: '#EAF2FF' },
  helper: { margin: 0, color: '#9FB3C8', fontSize: '0.9375rem', lineHeight: 1.45 },
  choices: { display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  choice: {
    display: 'flex', alignItems: 'center', gap: '0.875rem',
    padding: '1rem 1.25rem',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 64,
    textAlign: 'left',
  },
  choiceActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
  },
  choiceIcon: { fontSize: '1.6rem', lineHeight: 1 },
  choiceText: { flex: 1 },
};
