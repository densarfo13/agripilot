/**
 * LanguageSuggestionBanner — UX surface for the
 * locale-detection feature.
 *
 * Renders when:
 *   • detection has finished (status === 'ready')
 *   • the suggested language differs from the active language
 *
 * Hides when:
 *   • status is 'detecting' (no flicker on first paint)
 *   • status is 'applied' or 'dismissed' (farmer already chose)
 *
 * The banner is intentionally lightweight — three buttons,
 * no modal, dismissable. Suitable for the top of onboarding,
 * the My Farm page, or anywhere we want to surface the
 * suggestion without blocking interaction.
 */

import React from 'react';
import { LANGUAGES, useTranslation } from '../../i18n/index.js';
import { useFarmLocale } from '../../i18n/localeDetection/useFarmLocale.js';
import { tSafe } from '../../i18n/tSafe.js';

const LANG_LABEL = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l.label]),
);

function languageLabel(code) {
  return LANG_LABEL[code] || code?.toUpperCase() || '';
}

function regionDescriptor(country, region) {
  if (country && region) return `${region}, ${country}`;
  if (country) return country;
  if (region) return region;
  return '';
}

export default function LanguageSuggestionBanner({
  farm = null,
  autoDetect = true,
  style,
}) {
  const { lang } = useTranslation();
  const {
    suggestion, status, accept, choose, keepEnglish,
  } = useFarmLocale({ farm, autoDetect });

  const [showPicker, setShowPicker] = React.useState(false);

  // Only render when there's something to suggest AND the
  // suggestion isn't already the active language.
  const shouldRender =
    status === 'ready'
    && !!suggestion
    && suggestion.lang
    && suggestion.lang !== lang;

  if (!shouldRender) return null;

  const where = regionDescriptor(suggestion.country, suggestion.region);
  const targetLabel = languageLabel(suggestion.lang);

  return (
    <section
      style={{ ...S.wrap, ...(style || {}) }}
      role="region"
      aria-label={tSafe('locale.banner.aria', 'Language suggestion')}
      data-testid="lang-suggestion-banner"
    >
      <div style={S.headerRow}>
        <span style={S.eyebrow}>
          {tSafe('locale.banner.eyebrow',
            'Language suggestion based on your farm location')}
        </span>
      </div>

      <p style={S.title}>
        {tSafe('locale.banner.title',
          `We detected your location${where ? ` (${where})` : ''}. Use ${targetLabel} for this farm?`)
          .replace('{where}', where)
          .replace('{language}', targetLabel)}
      </p>

      <div style={S.actions}>
        <button
          type="button"
          onClick={accept}
          style={{ ...S.btn, ...S.primary }}
          data-testid="lang-suggestion-accept"
        >
          {tSafe('locale.banner.accept', `Yes, use ${targetLabel}`)
            .replace('{language}', targetLabel)}
        </button>
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          style={{ ...S.btn, ...S.ghost }}
          data-testid="lang-suggestion-choose"
        >
          {tSafe('locale.banner.choose', 'Choose another language')}
        </button>
        <button
          type="button"
          onClick={keepEnglish}
          style={{ ...S.btn, ...S.ghost }}
          data-testid="lang-suggestion-english"
        >
          {tSafe('locale.banner.keepEnglish', 'Keep English')}
        </button>
      </div>

      {showPicker && (
        <div style={S.picker} data-testid="lang-suggestion-picker">
          {LANGUAGES.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => { choose(opt.code); setShowPicker(false); }}
              style={{
                ...S.btn, ...S.ghost,
                ...(opt.code === lang ? S.activeChip : null),
              }}
              data-testid={`lang-suggestion-pick-${opt.code}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const S = {
  wrap: {
    margin: '1rem 0',
    padding: '0.875rem 1rem',
    borderRadius: 14,
    border: '1px solid rgba(34,197,94,0.28)',
    background: 'rgba(34,197,94,0.08)',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  eyebrow: {
    fontSize: '0.6875rem',
    color: '#86EFAC',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  title: {
    margin: 0,
    fontSize: '0.9375rem',
    lineHeight: 1.45,
    color: '#F1F5F9',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  btn: {
    padding: '0.5rem 0.875rem',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.16)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 36,
  },
  primary: {
    background: '#22C55E',
    color: '#062714',
    borderColor: '#22C55E',
  },
  ghost: {
    background: 'transparent',
    color: '#EAF2FF',
  },
  activeChip: {
    borderColor: '#22C55E',
    color: '#86EFAC',
  },
  picker: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
    paddingTop: '0.25rem',
    borderTop: '1px dashed rgba(255,255,255,0.08)',
  },
};
