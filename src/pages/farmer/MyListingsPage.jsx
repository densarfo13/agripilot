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
import { tSafe } from '../../i18n/tSafe.js';

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
          <h1 style={S.title}>{tSafe('market.myListings.title', '')}</h1>
          <button
            type="button"
            onClick={() => navigate('/farmer/listings/new')}
            style={S.createBtn}
            data-testid="create-listing"
          >
            {tSafe('market.myListings.create', '')}
          </button>
        </header>

        {state.loading && <p style={S.muted}>{t('common.loading')}</p>}
        {state.error && <p style={S.err}>{tSafe('market.myListings.error', '')}</p>}

        {!state.loading && state.listings.length === 0 && (
          <div style={S.empty} data-testid="my-listings-empty">
            <div style={S.emptyIcon}>{'\uD83D\uDED2'}</div>
            <h2 style={S.emptyTitle}>{tSafe('market.myListings.empty', '')}</h2>
            <p style={S.emptyBody}>{tSafe('market.myListings.emptyHint', '')}</p>
          </div>
        )}

        {pendingInterests.length > 0 && (
          <section style={S.section} data-testid="pending-interests-section">
            <h2 style={S.sectionTitle}>
              {tSafe('market.pending.title', '')}
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
                        {tSafe('market.action.accept', '')}
                      </button>
                      <button
                        type="button" disabled={busyId === i.id}
                        onClick={() => handleDecline(i.id)}
                        style={S.decline}
                        data-testid={`decline-${i.id}`}
                      >
                        {tSafe('market.action.decline', '')}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section style={S.section}>
          <h2 style={S.sectionTitle}>{tSafe('market.myListings.all', '')}</h2>
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
                      {tSafe('market.action.markSold', '')}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === l.id}
                      onClick={() => handleClose(l.id)}
                      style={S.btnClose}
                    >
                      {tSafe('market.action.close', '')}
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
  // Visual restyle (snippet reference): card moved to the navy
  // panel surface used across the rest of the farmer pages, body
  // stacks above a full-width 50/50 button row. Accept / Decline
  // action model preserved — a Call / Contacted swap would be a
  // workflow change beyond visual scope.
  pendingCard: {
    padding: '14px 16px', borderRadius: '12px',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  pendingCrop: { fontWeight: 700, fontSize: '0.95rem', color: '#fff' },
  pendingMeta: { fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' },
  pendingNote: { fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', marginTop: '2px' },
  pendingActions: { display: 'flex', gap: '8px' },
  accept: {
    flex: 1,
    padding: '0.625rem 0.75rem', borderRadius: '10px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
    minHeight: '44px',
    boxShadow: '0 6px 16px rgba(34,197,94,0.18)',
  },
  decline: {
    flex: 1,
    padding: '0.625rem 0.75rem', borderRadius: '10px',
    border: '1px solid #1F3B5C', background: '#1A3B5D',
    color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem',
    fontWeight: 600, cursor: 'pointer',
    minHeight: '44px',
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
