/**
 * InterestForm — inline 3-field form attached to a listing card
 * on the /buy surface.
 *
 * Spec coverage (Buy marketplace §3, §5)
 *   • "I'm interested" CTA
 *   • Stores listingId + buyerId + timestamp via existing
 *     marketStore.saveBuyerInterest (it already writes
 *     `createdAt` so timestamps are canonical)
 *   • Buyer info: name + location + optional message
 *
 * Behaviour
 *   • Collapsed by default — shows just the "I'm interested"
 *     button. On tap the inline form expands.
 *   • On submit, saveBuyerInterest:
 *       - fires the existing BUYER_INTEREST_SUBMITTED event
 *       - fires the spec-name `buyer_interest` event (Sell V2)
 *       - writes a NOTIFICATION_TYPES.BUYER notification for the
 *         listing owner ("Someone is interested in your produce")
 *   • This component additionally emits `interest_clicked` per
 *     spec §7 so analytics can track tap-funnel separately from
 *     submitted-form-funnel.
 *   • After a successful submit the form flips to a small
 *     "Thanks — the seller will be notified" confirmation; the
 *     button disables to prevent double-taps.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws — analytics + storage writes wrapped.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import { saveBuyerInterest } from '../../market/marketStore.js';
import { buildBuyerToFarmerMessage } from '../../market/marketTransaction.js';
import { addCropPreference } from '../../market/buyerPreferences.js';
import RepeatPromptCard from '../marketplace/RepeatPromptCard.jsx';
import RecurringOrderToggle from '../marketplace/RecurringOrderToggle.jsx';

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 10, width: '100%' },
  primary: {
    appearance: 'none',
    border: 'none',
    padding: '12px 16px',
    borderRadius: 12,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
  },
  primaryDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  input: {
    appearance: 'none',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(0,0,0,0.20)',
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  textarea: {
    minHeight: 64,
    resize: 'vertical',
  },
  rowBtns: { display: 'flex', gap: 8 },
  ghost: {
    appearance: 'none',
    flex: '1 1 0',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  submit: {
    appearance: 'none',
    flex: '2 1 0',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  errorBox: {
    fontSize: 12,
    color: '#FCA5A5',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.32)',
    padding: '6px 10px',
    borderRadius: 8,
  },
  successBox: {
    fontSize: 13,
    fontWeight: 700,
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.32)',
    padding: '10px 12px',
    borderRadius: 10,
    textAlign: 'center',
  },
};

/**
 * @param {object} props
 * @param {object} props.listing       full listing object (we use id + crop)
 * @param {string} props.buyerId       resolved via buyerIdentity.getBuyerId
 * @param {object} [props.prefill]     { buyerName, buyerLocation } from profile if available
 * @param {() => void} [props.onSubmitted]   parent callback after a successful submit
 */
export default function InterestForm({ listing, buyerId, prefill = {}, onSubmitted }) {
  useTranslation();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [name, setName]         = useState(prefill?.buyerName || '');
  const [location, setLocation] = useState(prefill?.buyerLocation || '');
  const [message, setMessage]   = useState('');

  const handleStart = useCallback(() => {
    try {
      trackEvent('interest_clicked', {
        listingId: listing?.id || null,
        crop:      listing?.crop || null,
        buyerId:   buyerId || null,
      });
    } catch { /* swallow */ }
    // Marketplace transaction flow: when on, prefill the optional
    // message field with a template so the buyer rarely has to
    // type from scratch. Only writes when the field is empty.
    try {
      if (isFeatureEnabled('marketTransactionFlow')
          && (!message || !message.trim())) {
        const tmpl = buildBuyerToFarmerMessage({
          listing,
          buyerName: name,
          buyerLocation: location,
        });
        if (tmpl) setMessage(tmpl);
      }
    } catch { /* swallow */ }
    setOpen(true);
    setError('');
  }, [listing, buyerId, message, name, location]);

  const handleSubmit = useCallback((e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (submitting || done) return;
    if (!name.trim()) {
      setError(tStrict('buy.interest.error.name', 'Please add your name.'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const stored = saveBuyerInterest({
        listingId:  listing?.id,
        buyerId:    buyerId || null,
        crop:       listing?.crop || null,
        buyerName:  name.trim(),
        // The marketStore stores phone/email; we use the
        // generic `message` slot for the optional buyer
        // location + the freeform message together so the
        // farmer sees "Accra · I can pick up Saturday." —
        // single field, low friction.
        message: [location.trim(), message.trim()].filter(Boolean).join(' \u00B7 '),
      });
      if (!stored) {
        setError(tStrict('buy.interest.error.save', 'Could not record interest. Try again.'));
        setSubmitting(false);
        return;
      }
      // Marketplace revenue scale §5: persist the crop the buyer
      // just expressed interest in. The Quick Reorder strip on
      // /buy reads this list to surface one-tap re-filter chips.
      try {
        if (isFeatureEnabled('marketRevenueScale') && buyerId && listing?.crop) {
          addCropPreference(buyerId, listing.crop);
        }
      } catch { /* swallow */ }
      setDone(true);
      try { onSubmitted && onSubmitted(stored); } catch { /* swallow */ }
    } catch {
      setError(tStrict('buy.interest.error.save', 'Could not record interest. Try again.'));
    } finally {
      setSubmitting(false);
    }
  }, [submitting, done, name, location, message, listing, buyerId, onSubmitted]);

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={S.successBox} data-testid={`buy-interest-success-${listing?.id}`}>
          {tStrict('buy.interest.success',
            'Thanks \u2014 the seller will be notified.')}
        </div>
        {/* Marketplace revenue scale §2: weekly-supply toggle
            shown right at the moment of highest intent (the
            buyer just confirmed they want this crop). */}
        {isFeatureEnabled('marketRevenueScale') ? (
          <RecurringOrderToggle
            listing={listing}
            buyerId={buyerId}
            buyerName={prefill?.buyerName || ''}
          />
        ) : null}
        {/* Marketplace scale §3: repeat prompt right after a
            successful interest submission. Pulls the buyer back
            into the funnel without a manual nav. */}
        {isFeatureEnabled('marketScale') ? (
          <RepeatPromptCard role="buyer" />
        ) : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleStart}
        style={S.primary}
        data-testid={`buy-interest-cta-${listing?.id}`}
      >
        {tStrict('buy.interest.cta', 'I\u2019m interested')}
      </button>
    );
  }

  return (
    <form
      style={S.form}
      onSubmit={handleSubmit}
      data-testid={`buy-interest-form-${listing?.id}`}
      noValidate
    >
      {error ? <div style={S.errorBox}>{error}</div> : null}

      <label style={S.field}>
        <span style={S.label}>{tStrict('buy.interest.name', 'Your name')}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          style={S.input}
          required
          data-testid="buy-interest-name"
        />
      </label>

      <label style={S.field}>
        <span style={S.label}>{tStrict('buy.interest.location', 'Your location')}</span>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={tStrict('buy.interest.locationPlaceholder', 'e.g. Accra')}
          style={S.input}
          data-testid="buy-interest-location"
        />
      </label>

      <label style={S.field}>
        <span style={S.label}>
          {tStrict('buy.interest.message', 'Message (optional)')}
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={tStrict('buy.interest.messagePlaceholder',
            'When can you pick up? Any questions?')}
          style={{ ...S.input, ...S.textarea }}
          data-testid="buy-interest-message"
        />
      </label>

      <div style={S.rowBtns}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={S.ghost}
          data-testid="buy-interest-cancel"
        >
          {tStrict('common.cancel', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          style={{ ...S.submit, ...(submitting ? S.primaryDisabled : null) }}
          data-testid="buy-interest-submit"
        >
          {submitting
            ? tStrict('common.submitting', 'Submitting\u2026')
            : tStrict('buy.interest.send', 'Send interest')}
        </button>
      </div>
    </form>
  );
}
