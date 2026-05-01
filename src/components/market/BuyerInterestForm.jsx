/**
 * BuyerInterestForm — lightweight form: quantity, offered price,
 * short note. Extracted so the same control can be reused from
 * ListingDetailPage and any "quick-interest" dialog we add later.
 *
 * Controlled. Parent owns submission + success state. Never
 * touches farmer contact info — the controlled-reveal rule is
 * enforced upstream in marketService.listBuyerInterests.
 */
import { useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { tSafe } from '../../i18n/tSafe.js';

export default function BuyerInterestForm({
  onSubmit, submitting = false, error = null, submitted = false, onBrowseMore,
}) {
  const { t } = useAppSettings();
  const [form, setForm] = useState({ quantityRequested: '', offeredPrice: '', note: '' });
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    await onSubmit?.({
      quantityRequested: form.quantityRequested ? Number(form.quantityRequested) : null,
      offeredPrice: form.offeredPrice ? Number(form.offeredPrice) : null,
      note: form.note?.trim() || null,
    });
  }

  if (submitted) {
    return (
      <div style={S.success} data-testid="interest-success">
        <strong>{tSafe('market.interest.sentTitle', '')}</strong>
        <p style={S.successBody}>
          {tSafe('market.interest.sentBody', '')}
        </p>
        {onBrowseMore && (
          <button type="button" onClick={onBrowseMore} style={S.btnGhost}>
            {tSafe('market.interest.browseMore', '')}
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={S.form} data-testid="interest-form">
      <h3 style={S.title}>{tSafe('market.interest.title', '')}</h3>

      <div style={S.row}>
        <Field label={tSafe('market.interest.quantity', '')} flex={1}>
          <input type="number" inputMode="decimal" min="0" step="0.1"
            value={form.quantityRequested} onChange={set('quantityRequested')}
            style={S.input}
            data-testid="interest-quantity"
          />
        </Field>
        <Field label={tSafe('market.interest.offered', '')} flex={1}>
          <input type="number" inputMode="decimal" min="0" step="0.01"
            value={form.offeredPrice} onChange={set('offeredPrice')}
            style={S.input}
            data-testid="interest-price"
          />
        </Field>
      </div>

      <Field label={tSafe('market.interest.note', '')}>
        <textarea
          value={form.note} onChange={set('note')}
          maxLength={400} rows={3} style={S.textarea}
          data-testid="interest-note"
        />
      </Field>

      {error && <p style={S.err}>{t(`market.err.${error}`) || t('issue.err.generic')}</p>}

      <button type="submit" disabled={submitting} style={S.btnPrimary}>
        {submitting ? t('common.saving') : (t('market.action.sendInterest') || tSafe('market.action.interested', ''))}
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
  form: {
    display: 'flex', flexDirection: 'column', gap: '0.625rem',
    padding: '1rem', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  title: { margin: 0, fontSize: '0.9375rem', fontWeight: 700 },
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
  btnGhost: {
    alignSelf: 'flex-start',
    padding: '0.5rem 0.875rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
};
