/**
 * CountrySelector — searchable country picker with support-tier
 * groups. Without a query: groups by FULL_SUPPORT → BASIC_SUPPORT →
 * LIMITED_SUPPORT → COMING_SOON so the farmer sees at a glance
 * which countries are really wired up.
 */
import { useMemo, useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { searchCountries, POPULAR_COUNTRY_CODES } from '../../utils/locationData.js';
import {
  getCountrySupportTier, groupCountriesByTier,
  TIER_I18N_KEY, TIER_GROUP_KEY, SUPPORT_TIER,
} from '../../utils/countrySupport.js';

const TIER_COLOR = {
  FULL_SUPPORT:    '#22C55E',
  BASIC_SUPPORT:   '#0EA5E9',
  LIMITED_SUPPORT: '#F59E0B',
  COMING_SOON:     '#9FB3C8',
};

const GROUP_ORDER = [
  SUPPORT_TIER.FULL_SUPPORT,
  SUPPORT_TIER.BASIC_SUPPORT,
  SUPPORT_TIER.LIMITED_SUPPORT,
  SUPPORT_TIER.COMING_SOON,
];

export default function CountrySelector({ value, onChange, autoFocus }) {
  const { t } = useAppSettings();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchCountries(query), [query]);
  const grouped = useMemo(() => groupCountriesByTier(results), [results]);
  const usingGroups = !query.trim();

  return (
    <div style={S.wrap} data-testid="country-selector">
      <label style={S.label}>{t('location.selectCountry')}</label>
      <input
        type="search"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('location.searchCountries')}
        style={S.search}
        data-testid="country-search"
      />

      <div style={S.list} role="listbox">
        {usingGroups ? (
          GROUP_ORDER.map((tier) => {
            const countries = grouped[tier] || [];
            if (countries.length === 0) return null;
            return (
              <section key={tier} style={S.group}>
                <h4 style={{ ...S.groupHeader, color: TIER_COLOR[tier] }}>
                  {t(TIER_GROUP_KEY[tier])}
                </h4>
                {countries.map((c) => (
                  <CountryRow key={c.code} country={c} value={value} onChange={onChange} t={t} />
                ))}
              </section>
            );
          })
        ) : results.length === 0 ? (
          <p style={S.empty}>{t('location.noMatches')}</p>
        ) : (
          results.map((c) => (
            <CountryRow key={c.code} country={c} value={value} onChange={onChange} t={t} />
          ))
        )}
      </div>
    </div>
  );
}

function CountryRow({ country, value, onChange, t }) {
  const tier = getCountrySupportTier(country.code);
  const isPopular = POPULAR_COUNTRY_CODES.includes(country.code);
  const isComingSoon = tier === SUPPORT_TIER.COMING_SOON;
  const isActive = value === country.code;
  return (
    <button
      type="button"
      onClick={() => !isComingSoon && onChange?.(country.code)}
      disabled={isComingSoon}
      style={{
        ...S.button,
        ...(isActive ? S.active : null),
        ...(isComingSoon ? S.disabled : null),
      }}
      data-testid={`country-option-${country.code}`}
    >
      <span style={S.name}>{country.name}</span>
      <span style={S.tagRow}>
        {isPopular && !isComingSoon && (
          <span style={S.popTag}>{t('location.popular')}</span>
        )}
        <span style={{ ...S.tierTag, color: TIER_COLOR[tier], borderColor: TIER_COLOR[tier] }}>
          {t(TIER_I18N_KEY[tier])}
        </span>
      </span>
    </button>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: {
    fontSize: '0.6875rem', color: '#9FB3C8', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  search: {
    padding: '0.625rem 0.75rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.9375rem', minHeight: '44px',
  },
  list: {
    maxHeight: '320px', overflowY: 'auto',
    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
  },
  group: { display: 'flex', flexDirection: 'column' },
  groupHeader: {
    fontSize: '0.6875rem', fontWeight: 700, padding: '0.5rem 0.75rem',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    margin: 0, background: 'rgba(255,255,255,0.02)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  button: {
    width: '100%', padding: '0.625rem 0.75rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem',
    border: 'none', background: 'transparent', color: '#EAF2FF',
    fontSize: '0.9375rem', cursor: 'pointer', textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  active: { background: 'rgba(34,197,94,0.12)', color: '#22C55E', fontWeight: 700 },
  disabled: { cursor: 'not-allowed', opacity: 0.55 },
  name: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tagRow: { display: 'flex', gap: '0.375rem', alignItems: 'center' },
  popTag: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.6875rem', fontWeight: 700,
    background: 'rgba(14,165,233,0.14)', color: '#0EA5E9',
  },
  tierTag: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.625rem', fontWeight: 700,
    border: '1px solid',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  empty: { padding: '0.75rem', color: '#9FB3C8', fontSize: '0.875rem' },
};
