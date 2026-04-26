/**
 * BuyerFiltersBar — compact 3-field filter row:
 *   crop  ·  location  ·  quantity
 *
 * Location is driven by the LocationSelector (searchable, preferred
 * regions first). Changes are reported up through onChange; the
 * parent debounces and triggers a search. A user who wants to
 * refresh manually can still tap Search.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import LocationSelector from './LocationSelector.jsx';
import { tSafe } from '../../i18n/tSafe.js';

export default function BuyerFiltersBar({
  filters,
  preferredRegions = [],
  onChange,
  onSubmit,
  onResetLocation,
  onExpandLocation,
  busy = false,
}) {
  const { t } = useAppSettings();
  const set = (k) => (e) => onChange?.({ ...filters, [k]: e.target.value });

  const selectedLocation = filters.country
    ? { country: filters.country, stateCode: filters.stateCode || null }
    : null;

  return (
    <form
      style={S.form}
      onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}
      data-testid="buyer-filters-bar"
    >
      <label style={S.field}>
        <span style={S.label}>{t('market.field.crop')}</span>
        <input
          value={filters.crop || ''}
          onChange={set('crop')}
          placeholder={tSafe('market.field.cropPlaceholder', '')}
          style={S.input}
          data-testid="filter-crop"
        />
      </label>

      <label style={S.field}>
        <span style={S.label}>{tSafe('market.field.location', '')}</span>
        <LocationSelector
          value={selectedLocation}
          preferredRegions={preferredRegions}
          onChange={(r) => onChange?.({
            ...filters,
            country: r?.country || '',
            stateCode: r?.stateCode || '',
          })}
          onReset={onResetLocation}
          onExpand={onExpandLocation}
        />
      </label>

      <label style={S.field}>
        <span style={S.label}>{t('market.field.quantity')}</span>
        <input
          type="number" min="0" step="0.1"
          value={filters.quantity || ''}
          onChange={set('quantity')}
          style={S.input}
          data-testid="filter-quantity"
        />
      </label>

      <button type="submit" style={S.searchBtn} disabled={busy}>
        {busy ? t('common.loading') : (tSafe('market.browse.search', ''))}
      </button>
    </form>
  );
}

const S = {
  form: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  label: { fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 600 },
  input: {
    padding: '0.625rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem',
  },
  searchBtn: {
    padding: '0.625rem', borderRadius: '10px',
    border: 'none', background: '#0EA5E9', color: '#fff',
    fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
  },
};
