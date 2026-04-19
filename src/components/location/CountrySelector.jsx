/**
 * CountrySelector — searchable country picker.
 *
 * Shows popular countries first when the search is empty; filters
 * by substring once the user types. Selecting a country triggers
 * onChange({ country }) and the parent decides whether to advance
 * to the state step.
 */
import { useMemo, useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { searchCountries, POPULAR_COUNTRY_CODES } from '../../utils/locationData.js';

export default function CountrySelector({ value, onChange, autoFocus }) {
  const { t } = useAppSettings();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchCountries(query), [query]);

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
      <ul style={S.list} role="listbox">
        {results.length === 0 && (
          <li style={S.empty}>{t('location.noMatches')}</li>
        )}
        {results.map((c) => {
          const isPopular = !query && POPULAR_COUNTRY_CODES.includes(c.code);
          const isActive = value === c.code;
          return (
            <li key={c.code} style={S.item}>
              <button
                type="button"
                onClick={() => onChange?.(c.code)}
                style={{ ...S.button, ...(isActive ? S.active : null) }}
                data-testid={`country-option-${c.code}`}
              >
                <span>{c.name}</span>
                {isPopular && <span style={S.popTag}>{t('location.popular')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
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
    margin: 0, padding: 0, listStyle: 'none',
    maxHeight: '260px', overflowY: 'auto',
    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
  },
  item: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  button: {
    width: '100%', padding: '0.625rem 0.75rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    border: 'none', background: 'transparent', color: '#EAF2FF',
    fontSize: '0.9375rem', cursor: 'pointer', textAlign: 'left',
  },
  active: { background: 'rgba(34,197,94,0.12)', color: '#22C55E', fontWeight: 700 },
  popTag: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.6875rem', fontWeight: 700,
    background: 'rgba(14,165,233,0.14)', color: '#0EA5E9',
  },
  empty: { padding: '0.75rem', color: '#9FB3C8', fontSize: '0.875rem' },
};
