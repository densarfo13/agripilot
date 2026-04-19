/**
 * ListingDetailPage — buyer-facing listing view with the interest
 * form.
 *
 * Guardrails:
 *   - farmer contact is NEVER exposed here; the controlled-contact
 *     card lives on MyInterestsPage and only populates after the
 *     farmer accepts.
 *   - non-active listings (reserved / sold / closed) show a muted
 *     "no longer available" card instead of the interest form.
 *
 * Route: /market/listings/:id
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { getListing, expressInterest } from '../../hooks/useMarket.js';
import ListingCard from '../../components/market/ListingCard.jsx';
import BuyerInterestForm from '../../components/market/BuyerInterestForm.jsx';

export default function ListingDetailPage() {
  const { t } = useAppSettings();
  const navigate = useNavigate();
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, listing: null, error: null });
  const [submitState, setSubmitState] = useState({ busy: false, submitted: false, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getListing(id);
        if (!cancelled) setState({ loading: false, listing: r?.listing || null, error: null });
      } catch (err) {
        if (!cancelled) setState({ loading: false, listing: null, error: err?.code || 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function handleSubmit(payload) {
    setSubmitState({ busy: true, submitted: false, error: null });
    try {
      await expressInterest(id, payload);
      setSubmitState({ busy: false, submitted: true, error: null });
    } catch (err) {
      setSubmitState({ busy: false, submitted: false, error: err?.code || 'error' });
    }
  }

  if (state.loading) {
    return <Shell><p style={S.muted}>{t('common.loading')}</p></Shell>;
  }
  if (!state.listing) {
    return <Shell><p style={S.muted}>{t('market.detail.notFound') || 'Listing not found.'}</p></Shell>;
  }

  const isActive = state.listing.status === 'active';

  return (
    <Shell>
      <button type="button" style={S.back} onClick={() => navigate(-1)}>
        {'\u2190'} {t('common.back')}
      </button>

      <ListingCard listing={state.listing} trustBadges={state.listing.trustBadges} />

      {state.listing.notes && (
        <div style={S.notes}>
          <h3 style={S.notesTitle}>{t('market.detail.notes') || 'Seller notes'}</h3>
          <p style={S.notesBody}>{state.listing.notes}</p>
        </div>
      )}

      <div style={S.contactNote}>
        {t('market.detail.contactNote') || 'Contact info will be shared after the farmer accepts your interest.'}
      </div>

      {isActive ? (
        <BuyerInterestForm
          onSubmit={handleSubmit}
          submitting={submitState.busy}
          submitted={submitState.submitted}
          error={submitState.error}
          onBrowseMore={() => navigate('/market/browse')}
        />
      ) : (
        <div style={S.closed} data-testid="listing-unavailable">
          <strong>
            {state.listing.status === 'reserved'
              ? (t('market.detail.reservedTitle') || 'Currently reserved')
              : (t('market.detail.unavailableTitle') || 'No longer available')}
          </strong>
          <p style={S.closedBody}>
            {state.listing.status === 'reserved'
              ? (t('market.detail.reservedBody') || 'Another buyer is finalizing this listing. It may re-open if that falls through.')
              : (t('market.detail.unavailableBody') || 'This listing is no longer accepting new interest.')}
          </p>
          <button type="button" onClick={() => navigate('/market/browse')} style={S.browseBtn}>
            {t('market.interest.browseMore') || 'Browse more'}
          </button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={S.page}>
      <div style={S.container}>{children}</div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '36rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  muted: { color: '#9FB3C8' },
  back: {
    alignSelf: 'flex-start',
    padding: '0.375rem 0.75rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
  },
  notes: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  notesTitle: { fontSize: '0.8125rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#9FB3C8', textTransform: 'uppercase', letterSpacing: '0.04em' },
  notesBody: { margin: 0, fontSize: '0.875rem', lineHeight: 1.5 },
  contactNote: {
    padding: '0.625rem 0.75rem', borderRadius: '10px',
    background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.22)',
    color: '#EAF2FF', fontSize: '0.8125rem', lineHeight: 1.4,
  },
  closed: {
    padding: '1rem', borderRadius: '14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.15)',
    color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  closedBody: { margin: 0, fontSize: '0.875rem', color: '#9FB3C8' },
  browseBtn: {
    alignSelf: 'flex-start',
    padding: '0.5rem 0.875rem', borderRadius: '10px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
  },
};
