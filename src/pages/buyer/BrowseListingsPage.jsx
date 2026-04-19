/**
 * BrowseListingsPage — buyer-side search + match ranking. Uses
 * /api/listings/search which returns only status='active' rows
 * already scored by matchScore.
 *
 * Route: /market/browse
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { searchListings } from '../../hooks/useMarket.js';
import ListingCard from '../../components/market/ListingCard.jsx';

export default function BrowseListingsPage() {
  const { t } = useAppSettings();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    crop: '', country: '', stateCode: '',
    quantity: '', minQuality: '', deliveryMode: '',
  });
  const [state, setState] = useState({ loading: false, listings: [], error: null });

  async function runSearch() {
    setState({ loading: true, listings: [], error: null });
    try {
      const r = await searchListings({
        crop: filters.crop || undefined,
        country: filters.country || undefined,
        stateCode: filters.stateCode || undefined,
        quantity: Number(filters.quantity) || undefined,
        minQuality: filters.minQuality || undefined,
        deliveryMode: filters.deliveryMode || undefined,
      });
      setState({ loading: false, listings: r?.listings || [], error: null });
    } catch (err) {
      setState({ loading: false, listings: [], error: err?.code || 'error' });
    }
  }

  useEffect(() => { runSearch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setFilters((s) => ({ ...s, [k]: e.target.value }));
  const resultCount = state.listings.length;

  const resultHeader = useMemo(() => {
    if (state.loading) return t('common.loading');
    if (state.error) return t('market.browse.error') || 'Could not search.';
    return t('market.browse.results', { count: resultCount })
      || `${resultCount} listings`;
  }, [state.loading, state.error, resultCount, t]);

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.title}>{t('market.browse.title') || 'Browse listings'}</h1>

        <form
          style={S.filters}
          onSubmit={(e) => { e.preventDefault(); runSearch(); }}
          data-testid="browse-filters"
        >
          <Field label={t('market.field.crop')}>
            <input value={filters.crop} onChange={set('crop')} placeholder="tomato" style={S.input} />
          </Field>
          <div style={S.row}>
            <Field label={t('market.field.country')} flex={1}>
              <input value={filters.country} onChange={set('country')} placeholder="US" style={S.input} />
            </Field>
            <Field label={t('market.field.state')} flex={1}>
              <input value={filters.stateCode} onChange={set('stateCode')} placeholder="MD" style={S.input} />
            </Field>
          </div>
          <div style={S.row}>
            <Field label={t('market.field.quantity')} flex={1}>
              <input type="number" min="0" value={filters.quantity} onChange={set('quantity')} style={S.input} />
            </Field>
            <Field label={t('market.field.minQuality') || 'Min quality'} flex={1}>
              <select value={filters.minQuality} onChange={set('minQuality')} style={S.select}>
                <option value="">—</option>
                <option value="low">{t('market.quality.low') || 'Low'}</option>
                <option value="medium">{t('market.quality.medium') || 'Medium'}</option>
                <option value="high">{t('market.quality.high') || 'High'}</option>
              </select>
            </Field>
          </div>
          <button type="submit" style={S.searchBtn} disabled={state.loading}>
            {t('market.browse.search') || 'Search'}
          </button>
        </form>

        <p style={S.resultHeader}>{resultHeader}</p>

        <div style={S.list}>
          {state.listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              trustBadges={l.trustBadges}
              onClick={() => navigate(`/market/listings/${l.id}`)}
              actions={
                <button type="button" style={S.interestBtn}>
                  {t('market.action.viewDetail') || 'View details'}
                </button>
              }
            />
          ))}
        </div>
      </div>
    </div>
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
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '42rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: 0 },
  filters: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
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
  resultHeader: { color: '#9FB3C8', fontSize: '0.8125rem', margin: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  interestBtn: {
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
};
