/**
 * MyInterestsPage — buyer view of every interest they've submitted.
 * Grouped by status pill and ordered most-recent first.
 *
 * Accepted rows unlock:
 *   - an ApprovedContactCard showing the farmer's name + farm name
 *     + general location (no phone/email unless the farmer has
 *     opted in via their profile — the server only attaches what
 *     it's allowed to share).
 *
 * Route: /buyer/interests
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { listBuyerInterests } from '../../hooks/useMarket.js';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';

const STATUS_COLOR = {
  pending:  '#F59E0B',
  accepted: '#22C55E',
  declined: '#EF4444',
  expired:  '#9FB3C8',
};

export default function MyInterestsPage() {
  const { t, language } = useAppSettings();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, interests: [], error: null });

  async function reload() {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await listBuyerInterests();
      setState({ loading: false, interests: r?.interests || [], error: null });
    } catch (err) {
      setState({ loading: false, interests: [], error: err?.code || 'error' });
    }
  }

  useEffect(() => { reload(); }, []);

  const empty = !state.loading && state.interests.length === 0;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <h1 style={S.title}>{t('market.myInterests.title') || 'My interests'}</h1>
          <button type="button" style={S.link} onClick={() => navigate('/market/browse')}>
            {t('market.myInterests.browse') || 'Browse listings'}
          </button>
        </header>

        {state.loading && <p style={S.muted}>{t('common.loading')}</p>}
        {state.error && <p style={S.err}>{t('market.myInterests.error') || 'Could not load.'}</p>}

        {empty && (
          <div style={S.emptyCard}>
            <div style={S.emptyIcon}>{'\uD83D\uDCE2'}</div>
            <h2 style={S.emptyTitle}>{t('market.myInterests.empty') || 'No interests yet'}</h2>
            <p style={S.emptyBody}>
              {t('market.myInterests.emptyHint') || 'Browse listings and tap Interested to start a conversation.'}
            </p>
            <button type="button" style={S.primaryBtn} onClick={() => navigate('/market/browse')}>
              {t('market.myInterests.browse') || 'Browse listings'}
            </button>
          </div>
        )}

        <ul style={S.list}>
          {state.interests.map((i) => {
            const cropLabel = i.listing?.cropKey
              ? getCropDisplayName(i.listing.cropKey, language, { bilingual: 'auto' })
              : '';
            const color = STATUS_COLOR[i.status] || STATUS_COLOR.pending;
            return (
              <li key={i.id}>
                <article style={S.card} data-testid={`interest-${i.id}`}>
                  <header style={S.cardHead}>
                    <div>
                      <div style={S.cardCrop}>{cropLabel}</div>
                      <div style={S.cardMeta}>
                        {i.listing?.quantity} {t(`harvest.unit.${i.listing?.unit}`) || i.listing?.unit}
                        {i.listing?.quality ? ` · ${t(`market.quality.${i.listing.quality}`) || i.listing.quality}` : ''}
                      </div>
                      <div style={S.cardMeta}>
                        {[i.listing?.city, i.listing?.stateCode, i.listing?.country].filter(Boolean).join(', ')}
                      </div>
                    </div>
                    <span style={{ ...S.status, color, borderColor: color }}>
                      {t(`market.interestStatus.${i.status}`) || i.status}
                    </span>
                  </header>

                  {i.quantityRequested && (
                    <div style={S.metaRow}>
                      <span style={S.metaLabel}>{t('market.interest.quantity')}:</span>
                      <span>{i.quantityRequested}</span>
                    </div>
                  )}
                  {i.offeredPrice && (
                    <div style={S.metaRow}>
                      <span style={S.metaLabel}>{t('market.interest.offered')}:</span>
                      <span>{i.offeredPrice}</span>
                    </div>
                  )}
                  {i.note && <p style={S.note}>{i.note}</p>}

                  {i.farmerResponseNote && (
                    <div style={S.responseNote}>
                      <span style={S.metaLabel}>{t('market.interest.farmerNote') || 'Farmer note'}:</span>
                      <span> {i.farmerResponseNote}</span>
                    </div>
                  )}

                  {i.status === 'accepted' && i.farmerContact && (
                    <ApprovedContactCard contact={i.farmerContact} t={t} />
                  )}
                  {i.status === 'accepted' && !i.farmerContact && (
                    <div style={S.awaitingContact}>
                      {t('market.interest.awaitingContact')
                        || 'Farmer accepted. Contact details will appear here shortly.'}
                    </div>
                  )}
                  {i.status === 'declined' && (
                    <div style={S.declinedNote}>
                      {t('market.interest.declinedBody')
                        || 'This interest was declined. Browse other listings to keep going.'}
                    </div>
                  )}

                  <div style={S.cardActions}>
                    {i.listing?.id && (
                      <button
                        type="button"
                        style={S.btnGhost}
                        onClick={() => navigate(`/market/listings/${i.listing.id}`)}
                      >
                        {t('market.action.viewDetail') || 'View listing'}
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ApprovedContactCard({ contact, t }) {
  if (!contact) return null;
  const lines = [
    contact.farmerName,
    contact.farmName && contact.farmName !== contact.farmerName ? contact.farmName : null,
    [contact.locationName, contact.stateCode, contact.country].filter(Boolean).join(', '),
  ].filter(Boolean);
  const hasDirectContact = !!(contact.contactPhone || contact.contactEmail);

  return (
    <div style={S.approved} data-testid="approved-contact">
      <strong style={S.approvedTitle}>
        {t('market.interest.contactReady') || 'You can now contact the farmer'}
      </strong>
      <ul style={S.approvedList}>
        {lines.map((l, i) => <li key={i} style={S.approvedLine}>{l}</li>)}
        {contact.contactPhone && (
          <li style={S.approvedLine}>
            <span style={S.metaLabel}>{t('market.interest.phone') || 'Phone'}:</span>{' '}
            <a href={`tel:${contact.contactPhone}`} style={S.link}>{contact.contactPhone}</a>
          </li>
        )}
        {contact.contactEmail && (
          <li style={S.approvedLine}>
            <span style={S.metaLabel}>{t('market.interest.email') || 'Email'}:</span>{' '}
            <a href={`mailto:${contact.contactEmail}`} style={S.link}>{contact.contactEmail}</a>
          </li>
        )}
      </ul>
      {!hasDirectContact && (
        <p style={S.approvedHint}>
          {t('market.interest.contactHint')
            || 'The farmer has not shared direct contact details — you can message them in the next release.'}
        </p>
      )}
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '40rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: 0 },
  link: { color: '#0EA5E9', textDecoration: 'underline' },
  muted: { color: '#9FB3C8' },
  err: { color: '#FCA5A5' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' },

  emptyCard: {
    padding: '1.5rem', borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
  },
  emptyIcon: { fontSize: '2rem' },
  emptyTitle: { fontSize: '1rem', fontWeight: 700, margin: 0 },
  emptyBody: { fontSize: '0.875rem', color: '#9FB3C8', margin: 0 },
  primaryBtn: {
    padding: '0.625rem 0.875rem', borderRadius: '10px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
  },

  card: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardCrop: { fontSize: '1rem', fontWeight: 700 },
  cardMeta: { fontSize: '0.8125rem', color: '#9FB3C8' },
  status: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    border: '1px solid', fontSize: '0.6875rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  metaRow: { fontSize: '0.8125rem', display: 'flex', gap: '0.375rem' },
  metaLabel: { color: '#9FB3C8', fontWeight: 600 },
  note: { margin: 0, fontSize: '0.875rem', color: '#EAF2FF' },
  responseNote: {
    padding: '0.5rem 0.625rem', borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
    fontSize: '0.8125rem',
  },
  declinedNote: {
    padding: '0.5rem 0.625rem', borderRadius: '10px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.22)',
    color: '#FCA5A5', fontSize: '0.8125rem',
  },

  approved: {
    padding: '0.75rem 0.875rem', borderRadius: '12px',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.28)',
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
  },
  approvedTitle: { color: '#22C55E', fontSize: '0.875rem' },
  approvedList: { margin: 0, paddingLeft: '1.125rem', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  approvedLine: { color: '#EAF2FF' },
  approvedHint: { margin: 0, fontSize: '0.75rem', color: '#9FB3C8' },
  awaitingContact: {
    padding: '0.5rem 0.625rem', borderRadius: '10px',
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)',
    color: '#22C55E', fontSize: '0.8125rem',
  },

  cardActions: { display: 'flex', gap: '0.375rem', marginTop: '0.125rem' },
  btnGhost: {
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
};
