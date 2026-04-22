/**
 * LanguageSelectorI18n — react-i18next-driven variant of the
 * existing LanguageSelector.
 *
 * NOTE on filename: spec §12 asked for `LanguageSelector.tsx`. The
 * project already ships a `LanguageSelector.jsx` that uses the
 * legacy i18n engine via AppPrefsContext. This new component
 * carries the spec's react-i18next wiring without renaming the
 * legacy file (which would break every screen that already imports
 * it). Both components drive the SAME language state — AppPrefs
 * also calls the legacy engine, and our i18next bootstrap listens
 * to the legacy engine's `farroway:langchange` event, so either
 * picker keeps both systems in sync.
 */

import { useTranslation } from 'react-i18next';
import { setLanguage, SUPPORTED_LANGUAGES } from '../i18n/setLanguageI18n.js';

export default function LanguageSelectorI18n({ className = '', style = null } = {}) {
  const { i18n, t } = useTranslation();

  return (
    <label
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color: '#E2E8F0',
        ...(style || {}),
      }}
      data-testid="language-selector-i18n"
    >
      <span style={S.label}>{t('settings.language')}</span>
      <select
        value={i18n.language || 'en'}
        onChange={(e) => setLanguage(e.target.value)}
        style={S.select}
        data-testid="language-selector-i18n-select"
        aria-label={t('settings.language')}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} style={S.option}>
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const S = {
  label: { fontSize: '0.875rem', color: '#9FB3C8' },
  select: {
    background: '#111D2E',
    color: '#E2E8F0',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: '8px 12px',
    fontSize: '0.875rem',
    colorScheme: 'dark',
    minHeight: '40px',
  },
  option: { background: '#111D2E', color: '#E2E8F0' },
};
