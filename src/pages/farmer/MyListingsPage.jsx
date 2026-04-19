/**
 * MyListingsPage — the farmer's view of their own CropListing rows,
 * with per-row actions (mark sold / close) and a count of pending
 * buyer interests so they can jump straight into responding.
 *
 * Route: /farmer/listings
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import {
  listMyListings, markListingSold, closeListing, listMyInterests,
  acceptInterest, declineInterest,
} from '../../hooks/useMarket.js';
import ListingCard from '../../components/market/ListingCard.jsx';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';

export default function MyListingsPage() {
  const { t, language } = useAppSettings();
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true, listings: [], interests: [], error: null,
  });
  const [busyId, setBusyId] = useState(null);

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [l, i] = await Promise.all([listMyListings(), listMyInterests()]);
      setState({
        loading: false,
        listings: l?.listings || [],
        interests: i?.interests || [],
        error: null,
      });
    } catch (err) {
      setState({ loading: false, listings: [], interests: [], error: err?.code || 'error' });
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleSold(id) {
    setBusyId(id); try { await markListingSold(id); } catch { /* noop */ }
    finally { setBusyId(null); await reload(); }
  }
  async function handleClose(id) {
    setBusyId(id); try { await closeListing(id); } catch { /* noop */ }
    finally { setBusyId(null); await reload(); }
  }
  async function handleAccept(interestId) {
    setBusyId(interestId); try { await acceptInterest(interestId); } catch { /* noop */ }
    finally { setBusyId(null); await reload(); }
  }
  async function handleDecline(interestId) {
    setBusyId(interestId); try { await declineInterest(interestId); } catch { /* noop */ }
    finally { setBusyId(null); await reload(); }
  }

  const pendingByListing = state.interests.reduce((m, i) => {
    if (i.status === 'pending') m[i.listingId] = (m[i.listingId] || 0) + 1;
    return m;
  }, {});
  const pendingInterests = state.interests.filter((i) => i.status === 'pending');

  return (
    <div style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <h1 style={S.title}>{t('market.myListings.title') || 'My listings'}</h1>
          <button
            type="button"
            onClick={() => navigate('/farmer/listings/new')}
            style={S.createBtn}
            data-testid="create-listing"
          >
            {t('market.myListings.create') || 'New listing'}
          </button>
        </header>

        {state.loading && <p style={S.muted}>{t('common.loading')}</p>}
        {state.error && <p style={S.err}>{t('market.myListings.error') || 'Could not load.'}</p>}

        {!state.loading && state.listings.length === 0 && (
          <div style={S.empty} data-testid="my-listings-empty">
            <div style={S.emptyIcon}>{'\uD83D\uDED2'}</div>
            <h2 style={S.emptyTitle}>{t('market.myListings.empty') || 'No listings yet'}</h2>
            <p style={S.emptyBody}>{t('market.myListings.emptyHint') || 'Post your next harvest to reach buyers.'}</p>
          </div>
        )}

        {pendingInterests.length > 0 && (
          <section style={S.section} data-testid="pending-interests-section">
            <h2 style={S.sectionTitle}>
              {t('market.pending.title') || 'Waiting for your response'}
            </h2>
            <ul style={S.pendingList}>
              {pendingInterests.map((i) => {
                const cropLabel = i.listing?.cropKey
                  ? getCropDisplayName(i.listing.cropKey, language, { bilingual: 'auto' })
                  : i.listing?.cropKey;
                return (
                  <li key={i.id} style={S.pendingCard}>
                    <div>
                      <div style={S.pendingCrop}>
                        {t('market.pending.lead', { crop: cropLabel })
                          || `Buyer interested in ${cropLabel}`}
                      </div>
                      {i.quantityRequested && (
                        <div style={S.pendingMeta}>
                          {t('market.pending.quantity', { qty: i.quantityRequested })
                            || `Wants ${i.quantityRequested}`}
                        </div>
                      )}
                      {i.offeredPrice && (
                        <div style={S.pendingMeta}>
                          {t('market.pending.offer', { price: i.offeredPrice })
                            || `Offered ${i.offeredPrice}`}
                        </div>
                      )}
                      {i.note && <div style={S.pendingNote}>{i.note}</div>}
                    </div>
                    <div style={S.pendingActions}>
                      <button
                        type="button" disabled={busyId === i.id}
                        onClick={() => handleAccept(i.id)}
                        style={S.accept}
                        data-testid={`accept-${i.id}`}
                      >
                        {t('market.action.accept') || 'Accept'}
                      </button>
                      <button
                        type="button" disabled={busyId === i.id}
                        onClick={() => handleDecline(i.id)}
                        style={S.decline}
                        data-testid={`decline-${i.id}`}
                      >
                        {t('market.action.decline') || 'Decline'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section style={S.section}>
          <h2 style={S.sectionTitle}>{t('market.myListings.all') || 'All listings'}</h2>
          <div style={S.list}>
            {state.listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                pendingInterestsCount={pendingByListing[l.id] || 0}
                actions={l.status === 'active' || l.status === 'reserved' ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === l.id}
                      onClick={() => handleSold(l.id)}
                      style={S.btnSold}
                    >
                      {t('market.action.markSold') || 'Mark as sold'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === l.id}
                      onClick={() => handleClose(l.id)}
                      style={S.btnClose}
                    >
                      {t('market.action.close') || 'Close'}
                    </button>
                  </>
                ) : null}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '42rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: 0 },
  createBtn: {
    padding: '0.5rem 0.875rem', borderRadius: '10px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
  },
  muted: { color: '#9FB3C8' },
  err: { color: '#FCA5A5' },
  empty: {
    padding: '1.5rem', borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: '2rem' },
  emptyTitle: { fontSize: '1rem', fontWeight: 700, margin: '0.25rem 0' },
  emptyBody: { fontSize: '0.875rem', color: '#9FB3C8', margin: 0 },
  section: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  sectionTitle: { fontSize: '0.875rem', fontWeight: 700, color: '#9FB3C8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  pendingList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  pendingCard: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    background: 'rgba(14,165,233,0.08)',
    border: '1px solid rgba(14,165,233,0.22)',
    display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center',
  },
  pendingCrop: { fontWeight: 700, fontSize: '0.9375rem' },
  pendingMeta: { fontSize: '0.8125rem', color: '#9FB3C8' },
  pendingNote: { fontSize: '0.8125rem', color: '#EAF2FF', marginTop: '0.25rem' },
  pendingActions: { display: 'flex', gap: '0.375rem' },
  accept: {
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', minHeight: '40px',
  },
  decline: {
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    border: '1px solid rgba(239,68,68,0.35)', background: 'transparent',
    color: '#FCA5A5', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
    minHeight: '40px',
  },
  btnSold: {
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    border: 'none', background: '#0EA5E9', color: '#fff',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
  btnClose: {
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
};
