/**
 * StepLanguage — Step 3 of Simple Onboarding.
 *
 * Country-aware: when the prior step detected Ghana the
 * picker offers en/tw/ha. Other countries fall through to
 * the LOCATION_LANGUAGE_MAP options.
 *
 * Selecting a language ALSO flips the live UI immediately
 * via setLanguage, so the rest of onboarding renders in the
 * farmer's choice from this step forward.
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { setLanguage } from '../i18n/index.js';
import {
  SUPPORTED_LANGUAGES,
  LOCATION_LANGUAGE_MAP,
  getLanguageNativeLabel,
} from '../i18n/languageConfig.js';

export default function StepLanguage({ value, onChange }) {
  const country = value.country || null;

  const options = React.useMemo(() => {
    if (country && LOCATION_LANGUAGE_MAP[country]) {
      const codes = LOCATION_LANGUAGE_MAP[country].options;
      if (codes && codes.length) return codes;
    }
    // Country not in the narrow spec map → fall through to
    // the full supported list so the farmer can still pick.
    return Object.keys(SUPPORTED_LANGUAGES);
  }, [country]);

  function pick(code) {
    onChange({ language: code });
    try { setLanguage(code); } catch { /* ignore */ }
  }

  return (
    <section style={S.wrap} data-testid="onboarding-step-language">
      <h1 style={S.title}>
        {tSafe('onboarding.languageTitle', 'Choose your preferred language')}
      </h1>
      <p style={S.helper}>
        {country
          ? `${tSafe('onboarding.languageHelperWithCountry',
              'Best matches for')} ${country}`
          : tSafe('onboarding.languageHelper',
              'You can change this anytime from settings.')}
      </p>

      <div style={S.choices}>
        {options.map((code) => {
          const row = SUPPORTED_LANGUAGES[code];
          if (!row) return null;
          const active = value.language === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => pick(code)}
              style={{
                ...S.choice,
                ...(active ? S.choiceActive : null),
              }}
              data-testid={`onboarding-language-${code}`}
            >
              <span style={S.choiceText}>{row.nativeLabel}</span>
              {row.label !== row.nativeLabel && (
                <span style={S.choiceSub}>{row.label}</span>
              )}
              {active && <span style={S.check} aria-hidden="true">{'\u2713'}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  title: { margin: 0, fontSize: '1.375rem', fontWeight: 700, color: '#EAF2FF' },
  helper: { margin: 0, color: '#9FB3C8', fontSize: '0.9375rem', lineHeight: 1.45 },
  choices: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  choice: {
    display: 'flex', alignItems: 'center', gap: '0.625rem',
    padding: '0.875rem 1rem',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 52,
    textAlign: 'left',
  },
  choiceActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
    fontWeight: 700,
  },
  choiceText: { flex: 0 },
  choiceSub: { flex: 1, color: '#9FB3C8', fontSize: '0.75rem' },
  check: { color: '#22C55E', fontWeight: 700 },
};
