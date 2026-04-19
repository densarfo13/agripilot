/**
 * StateRegionSelector — dynamic state/region dropdown driven by the
 * country passed in as a prop. Renders an "Other / region not
 * listed" placeholder when the country has no seeded regions, so
 * the user isn't stuck on an unknown country.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { getRegions, requiresState } from '../../utils/locationData.js';

export default function StateRegionSelector({ country, value, onChange }) {
  const { t } = useAppSettings();
  const regions = getRegions(country);

  if (!country) return null;

  if (!requiresState(country)) {
    return (
      <div style={S.wrap} data-testid="state-selector-not-required">
        <label style={S.label}>{t('location.selectState')}</label>
        <p style={S.hint}>{t('location.noStateList')}</p>
      </div>
    );
  }

  return (
    <div style={S.wrap} data-testid="state-selector">
      <label style={S.label}>{t('location.selectState')}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        style={S.select}
        data-testid="state-select"
      >
        <option value="">—</option>
        {regions.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name}{r.code !== r.name ? ` (${r.code})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: {
    fontSize: '0.6875rem', color: '#9FB3C8', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  select: {
    padding: '0.625rem 0.75rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.9375rem', minHeight: '44px',
  },
  hint: { color: '#9FB3C8', fontSize: '0.8125rem', margin: 0 },
};
