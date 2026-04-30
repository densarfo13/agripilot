/**
 * LanguageSwitcher — globe-icon dropdown for swapping the
 * active UI language.
 *
 * Mountable from:
 *   • top app header
 *   • onboarding flows
 *   • farm settings
 *   • profile settings
 *
 * Behaviour:
 *   • Reads the active language via useTranslation()
 *   • Saves the selection to user-level storage AND the active
 *     farm-level storage (when `farmId` is provided)
 *   • Live-updates the visible UI by routing through
 *     applyFarmLanguage → setLanguage (existing infrastructure)
 *   • Hides itself when FEATURE_LOCALIZATION is off
 *
 * Props:
 *   farmId   optional — when present, the choice is also
 *            persisted at farm scope
 *   country  optional — narrows the dropdown to the spec's
 *            LOCATION_LANGUAGE_MAP for that country
 *   compact  optional — render as icon-only (no text)
 */

import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import {
  SUPPORTED_LANGUAGES,
  getLanguageNativeLabel,
} from '../../i18n/languageConfig.js';
import {
  saveUserLanguage,
  saveFarmLanguage,
  getLanguageOptionsForCountry,
} from '../../utils/localeEngine.js';
import { isFeatureEnabled } from '../../utils/featureFlags.js';

export default function LanguageSwitcher({
  farmId = null,
  country = null,
  compact = false,
  style,
}) {
  const { lang } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef(null);

  // Feature flag — quietly hide when off (spec §16).
  if (!isFeatureEnabled('FEATURE_LOCALIZATION')) return null;

  // Close on outside click / escape.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Country-aware option list — Ghana shows en/tw/ha; Nigeria
  // shows en/ha; United States shows en. Everywhere else, fall
  // back to the full SUPPORTED_LANGUAGES set so the farmer can
  // still switch.
  const options = React.useMemo(() => {
    if (country) {
      const codes = getLanguageOptionsForCountry(country);
      if (Array.isArray(codes) && codes.length) return codes;
    }
    return Object.keys(SUPPORTED_LANGUAGES);
  }, [country]);

  const activeLabel = getLanguageNativeLabel(lang);

  function pick(nextLang) {
    if (!nextLang || nextLang === lang) { setOpen(false); return; }
    if (farmId) {
      saveFarmLanguage(farmId, nextLang, 'manual', country, null);
    } else {
      saveUserLanguage(nextLang, 'manual');
    }
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ ...S.wrap, ...(style || {}) }} data-testid="lang-switcher">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...S.trigger, ...(compact ? S.triggerCompact : null) }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={tSafe('language.switcher.aria', 'Change language')}
        data-testid="lang-switcher-trigger"
      >
        <span style={S.globe} aria-hidden="true">{'\uD83C\uDF10'}</span>
        {!compact && (
          <>
            <span style={S.activeText}>{activeLabel}</span>
            <span style={S.caret} aria-hidden="true">{'\u25BE'}</span>
          </>
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          style={S.menu}
          data-testid="lang-switcher-menu"
        >
          {options.map((code) => {
            const row = SUPPORTED_LANGUAGES[code];
            if (!row) return null;
            const active = code === lang;
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(code)}
                  style={{ ...S.row, ...(active ? S.rowActive : null) }}
                  data-testid={`lang-switcher-row-${code}`}
                >
                  <span style={S.rowLabel}>{row.nativeLabel}</span>
                  {row.label !== row.nativeLabel && (
                    <span style={S.rowSub}>{row.label}</span>
                  )}
                  {active && <span style={S.rowCheck} aria-hidden="true">{'\u2713'}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const S = {
  wrap: {
    position: 'relative',
    display: 'inline-block',
  },
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.625rem',
    minHeight: 36,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  triggerCompact: {
    padding: '0.4rem 0.5rem',
    gap: 0,
  },
  globe: { fontSize: '0.95rem', lineHeight: 1 },
  activeText: { lineHeight: 1 },
  caret: { fontSize: '0.625rem', color: '#9FB3C8' },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: '11rem',
    listStyle: 'none',
    padding: '0.375rem',
    margin: 0,
    background: '#0B1D34',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem 0.625rem',
    borderRadius: 8,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#EAF2FF',
    fontSize: '0.875rem',
    textAlign: 'left',
    cursor: 'pointer',
    minHeight: 36,
  },
  rowActive: {
    background: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.28)',
    color: '#86EFAC',
    fontWeight: 700,
  },
  rowLabel: { flex: 0 },
  rowSub: { flex: 1, color: '#9FB3C8', fontSize: '0.75rem' },
  rowCheck: { color: '#22C55E', fontWeight: 700 },
};
