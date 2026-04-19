/**
 * ListingDetailPage — buyer-facing listing view with the interest
 * form. Contact info is deliberately absent until the farmer
 * accepts — the UI shows the status of the buyer's own interest
 * if one exists.
 *
 * Route: /market/listings/:id
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { getListing, expressInterest } from '../../hooks/useMarket.js';
import ListingCard from '../../components/market/ListingCard.jsx';

export default function ListingDetailPage() {
  const { t } = useAppSettings();
  const navigate = useNavigate();
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, listing: null, error: null });
  const [form, setForm] = useState({ quantityRequested: '', offeredPrice: '', note: '' });
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

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitState.busy) return;
    setSubmitState({ busy: true, submitted: false, error: null });
    try {
      await expressInterest(id, {
        quantityRequested: form.quantityRequested ? Number(form.quantityRequested) : null,
        offeredPrice: form.offeredPrice ? Number(form.offeredPrice) : null,
        note: form.note?.trim() || null,
      });
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

      {/* Contact is hidden by design — the farmer must accept the
          interest before we reveal anything. */}
      <div style={S.contactNote}>
        {t('market.detail.contactNote') || 'Contact info will be shared after the farmer accepts your interest.'}
      </div>

      {submitState.submitted ? (
        <div style={S.success} data-testid="interest-success">
          <strong>{t('market.interest.sentTitle') || 'Interest sent'}</strong>
          <p style={S.successBody}>
            {t('market.interest.sentBody')
              || 'The farmer has been notified. You will see a response in your notifications.'}
          </p>
          <button type="button" onClick={() => navigate('/market/browse')} style={S.btnBack}>
            {t('market.interest.browseMore') || 'Browse more'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={S.form} data-testid="interest-form">
          <h3 style={S.formTitle}>{t('market.interest.title') || 'Tell the farmer what you need'}</h3>
          <div style={S.row}>
            <Field label={t('market.interest.quantity') || 'Quantity needed'} flex={1}>
              <input type="number" min="0" step="0.1"
                value={form.quantityRequested}
                onChange={set('quantityRequested')}
                style={S.input}
                data-testid="interest-quantity"
              />
            </Field>
            <Field label={t('market.interest.offered') || 'Offered price (optional)'} flex={1}>
              <input type="number" min="0" step="0.01"
                value={form.offeredPrice}
                onChange={set('offeredPrice')}
                style={S.input}
                data-testid="interest-price"
              />
            </Field>
          </div>
          <Field label={t('market.interest.note') || 'Short note (optional)'}>
            <textarea
              value={form.note} onChange={set('note')}
              maxLength={400} rows={3} style={S.textarea}
              data-testid="interest-note"
            />
          </Field>
          {submitState.error && (
            <p style={S.err}>{t(`market.err.${submitState.error}`) || t('issue.err.generic')}</p>
          )}
          <button type="submit" disabled={submitState.busy} style={S.btnPrimary}>
            {submitState.busy ? t('common.saving') : (t('market.action.interested') || 'Interested')}
          </button>
        </form>
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
  form: {
    display: 'flex', flexDirection: 'column', gap: '0.625rem',
    padding: '1rem', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  formTitle: { margin: 0, fontSize: '0.9375rem', fontWeight: 700 },
  row: { display: 'flex', gap: '0.5rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  label: { fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 600 },
  input: {
    padding: '0.625rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem',
  },
  textarea: {
    padding: '0.625rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem', resize: 'vertical',
  },
  err: { color: '#FCA5A5', fontSize: '0.8125rem', margin: 0 },
  btnPrimary: {
    padding: '0.875rem', borderRadius: '12px', border: 'none',
    background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '48px',
  },
  success: {
    padding: '1rem', borderRadius: '14px',
    background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.28)',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  successBody: { margin: 0, fontSize: '0.875rem', color: '#EAF2FF' },
  btnBack: {
    alignSelf: 'flex-start',
    padding: '0.5rem 0.875rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
};
