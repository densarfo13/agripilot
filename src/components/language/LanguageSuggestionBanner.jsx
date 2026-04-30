/**
 * LanguageSuggestionBanner (spec §7) — country-aware banner.
 *
 * This file lives at the path the localization rollout spec
 * asks for (/src/components/language/...). The richer existing
 * banner under /src/components/locale/ stays in place and is
 * still wired into the FastFlow onboarding screen; this is the
 * spec-shaped variant for surfaces that want the simpler copy:
 *
 *   "We detected your farm is in {country}. Choose the best
 *    language for this farm."
 *
 * Buttons (per spec):
 *   • Use English
 *   • Choose Twi
 *   • Choose Hausa
 *   • Keep current language
 *
 * Visibility is gated by shouldShowLanguageSuggestion — we
 * never block onboarding, and we hide ourselves once the
 * farmer makes a choice (or dismisses).
 */

import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import {
  saveUserLanguage,
  saveFarmLanguage,
  getLanguageOptionsForCountry,
  shouldShowLanguageSuggestion,
  markSuggestionDismissed,
} from '../../utils/localeEngine.js';
import {
  SUPPORTED_LANGUAGES,
  getLanguageNativeLabel,
} from '../../i18n/languageConfig.js';
import { isFeatureEnabled } from '../../utils/featureFlags.js';

const BUTTON_BY_CODE = {
  en: { fallback: 'Use English', key: 'language.banner.useEnglish' },
  tw: { fallback: 'Choose Twi',  key: 'language.banner.chooseTwi' },
  ha: { fallback: 'Choose Hausa', key: 'language.banner.chooseHausa' },
};

export default function LanguageSuggestionBanner({
  user = null,
  farm = null,
  onDismiss,
  style,
}) {
  const { lang } = useTranslation();
  const [hidden, setHidden] = React.useState(false);

  if (!isFeatureEnabled('FEATURE_LOCALIZATION')) return null;
  if (hidden) return null;
  if (!shouldShowLanguageSuggestion(user, farm)) return null;

  const country = (farm && (farm.detectedCountry || farm.country))
    || (user && user.detectedCountry)
    || null;
  if (!country) return null;

  // Country-scoped options ordered by the spec; if the country
  // is outside the spec's narrow map, fall back to the full
  // SUPPORTED_LANGUAGES set.
  const options = (() => {
    const opts = getLanguageOptionsForCountry(country);
    if (opts && opts.length > 1) return opts;
    return Object.keys(SUPPORTED_LANGUAGES);
  })();

  function applyChoice(nextLang) {
    if (farm && farm.id) {
      saveFarmLanguage(farm.id, nextLang, 'manual', country, farm.detectedRegion || null);
    } else {
      saveUserLanguage(nextLang, 'manual');
    }
    setHidden(true);
    if (typeof onDismiss === 'function') onDismiss({ chosenLang: nextLang });
  }

  function keepCurrent() {
    if (farm && farm.id) markSuggestionDismissed(farm.id);
    setHidden(true);
    if (typeof onDismiss === 'function') onDismiss({ chosenLang: lang, dismissed: true });
  }

  const titleTemplate = tSafe(
    'language.banner.title',
    'We detected your farm is in {country}. Choose the best language for this farm.',
  );
  const title = String(titleTemplate).replace('{country}', country);

  return (
    <section
      role="region"
      aria-label={tSafe('language.banner.aria', 'Language suggestion')}
      style={{ ...S.wrap, ...(style || {}) }}
      data-testid="language-suggestion-banner"
    >
      <p style={S.title}>{title}</p>

      <div style={S.actions}>
        {options.map((code) => {
          const meta = BUTTON_BY_CODE[code]
            || { key: 'language.banner.choose', fallback: `Choose ${getLanguageNativeLabel(code)}` };
          const labelTemplate = tSafe(meta.key, meta.fallback);
          const label = String(labelTemplate).replace(
            '{language}', getLanguageNativeLabel(code),
          );
          return (
            <button
              key={code}
              type="button"
              onClick={() => applyChoice(code)}
              style={{ ...S.btn, ...(code === 'en' ? S.btnPrimary : S.btnGhost) }}
              data-testid={`language-banner-${code}`}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={keepCurrent}
          style={{ ...S.btn, ...S.btnGhost }}
          data-testid="language-banner-keep"
        >
          {tSafe('language.banner.keepCurrent', 'Keep current language')}
        </button>
      </div>
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
  btnPrimary: {
    background: '#22C55E',
    color: '#062714',
    borderColor: '#22C55E',
  },
  btnGhost: {
    background: 'transparent',
    color: '#EAF2FF',
  },
};
