/**
 * BuyerFiltersBar — compact, fast filters for the buyer browse
 * page. Controlled; the parent owns filter state and triggers
 * search on submit.
 *
 * Fields: crop, country, state/region, minimum quantity,
 * minimum quality, delivery mode. Kept lean on purpose — the
 * trust-first spec calls for "fewer, more relevant listings", so
 * we don't pile on advanced filters.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function BuyerFiltersBar({ filters, onChange, onSubmit, busy = false }) {
  const { t } = useAppSettings();
  const set = (k) => (e) => onChange?.({ ...filters, [k]: e.target.value });

  return (
    <form
      style={S.form}
      onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}
      data-testid="buyer-filters-bar"
    >
      <Field label={t('market.field.crop')}>
        <input
          value={filters.crop || ''}
          onChange={set('crop')}
          placeholder="tomato"
          style={S.input}
          data-testid="filter-crop"
        />
      </Field>

      <div style={S.row}>
        <Field label={t('market.field.country')} flex={1}>
          <input value={filters.country || ''} onChange={set('country')} placeholder="US" style={S.input} data-testid="filter-country" />
        </Field>
        <Field label={t('market.field.state')} flex={1}>
          <input value={filters.stateCode || ''} onChange={set('stateCode')} placeholder="MD" style={S.input} data-testid="filter-state" />
        </Field>
      </div>

      <div style={S.row}>
        <Field label={t('market.field.quantity')} flex={1}>
          <input type="number" min="0" value={filters.quantity || ''} onChange={set('quantity')} style={S.input} data-testid="filter-quantity" />
        </Field>
        <Field label={t('market.field.minQuality') || 'Min quality'} flex={1}>
          <select value={filters.minQuality || ''} onChange={set('minQuality')} style={S.select} data-testid="filter-min-quality">
            <option value="">—</option>
            <option value="low">{t('market.quality.low')}</option>
            <option value="medium">{t('market.quality.medium')}</option>
            <option value="high">{t('market.quality.high')}</option>
          </select>
        </Field>
      </div>

      <Field label={t('market.field.deliveryMode')}>
        <select value={filters.deliveryMode || ''} onChange={set('deliveryMode')} style={S.select} data-testid="filter-delivery">
          <option value="">—</option>
          <option value="pickup">{t('market.delivery.pickup')}</option>
          <option value="delivery">{t('market.delivery.delivery')}</option>
          <option value="either">{t('market.delivery.either')}</option>
        </select>
      </Field>

      <button type="submit" style={S.searchBtn} disabled={busy}>
        {busy ? t('common.loading') : (t('market.browse.search') || 'Search')}
      </button>
    </form>
  );
}

function Field({ label, children, flex }) {
  return (
    <label style={{ ...S.field, ...(flex ? { flex } : {}) }}>
      <span style={S.label}>{label}</span>
      {children}
    </label>
  );
}

const S = {
  form: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  row: { display: 'flex', gap: '0.5rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  label: { fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 600 },
  input: {
    padding: '0.625rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem',
  },
  select: {
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
