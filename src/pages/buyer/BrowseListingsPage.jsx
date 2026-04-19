/**
 * BrowseListingsPage — buyer browse + filter view.
 *
 * Renders BuyerFiltersBar + a list of ListingCard rows. The server
 * applies `status = active` already; this page never shows sold /
 * reserved / closed listings, matching the trust-first spec.
 *
 * Route: /market/browse
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { searchListings } from '../../hooks/useMarket.js';
import ListingCard from '../../components/market/ListingCard.jsx';
import BuyerFiltersBar from '../../components/market/BuyerFiltersBar.jsx';

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

  const resultCount = state.listings.length;
  const resultHeader = useMemo(() => {
    if (state.loading) return t('common.loading');
    if (state.error) return t('market.browse.error') || 'Could not search.';
    if (resultCount === 0) return t('market.browse.noResults') || 'No matching listings yet';
    return t('market.browse.results', { count: resultCount })
      || `${resultCount} listings`;
  }, [state.loading, state.error, resultCount, t]);

  return (
    <div style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <h1 style={S.title}>{t('market.browse.title') || 'Browse listings'}</h1>
          <button
            type="button"
            onClick={() => navigate('/buyer/interests')}
            style={S.linkBtn}
            data-testid="go-my-interests"
          >
            {t('market.myInterests.link') || 'My interests'}
          </button>
        </header>

        <BuyerFiltersBar
          filters={filters}
          onChange={setFilters}
          onSubmit={runSearch}
          busy={state.loading}
        />

        <p style={S.resultHeader}>{resultHeader}</p>

        <div style={S.list}>
          {state.listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              trustBadges={l.trustBadges}
              onClick={() => navigate(`/market/listings/${l.id}`)}
              actions={
                <button type="button" style={S.detailBtn}>
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

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '42rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: 0 },
  linkBtn: {
    padding: '0.375rem 0.75rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
    color: '#EAF2FF', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
  resultHeader: { color: '#9FB3C8', fontSize: '0.8125rem', margin: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  detailBtn: {
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
};
