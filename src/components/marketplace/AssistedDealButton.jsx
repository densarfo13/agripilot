/**
 * AssistedDealButton — "Get help closing deal" CTA + inline form.
 *
 * Spec coverage (Marketplace monetization §2, §5)
 *   • button "Get help closing deal"
 *   • allow request
 *   • emits `assist_request` via assistStore
 *
 * Behaviour
 *   • Collapsed by default; tap expands a textarea + Send button.
 *   • Sends through `requestAssist({ listingId, farmerId, message })`.
 *   • After a successful submit, flips to a "Thanks — we'll be in
 *     touch" confirmation. Idempotent on (listingId, farmerId)
 *     within 60s so a double-tap won't duplicate.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Self-hides when `marketMonetization` is off.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { requestAssist } from '../../market/assistStore.js';
import { getAssistPrice } from '../../market/pricingVariants.js';

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  cta: {
    appearance: 'none',
    border: '1px solid rgba(168,85,247,0.45)',
    background: 'rgba(168,85,247,0.10)',
    color: '#D8B4FE',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 14px',
    background: 'rgba(168,85,247,0.06)',
    border: '1px solid rgba(168,85,247,0.32)',
    borderRadius: 12,
  },
  helper: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 1.5,
  },
  textarea: {
    minHeight: 64,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(0,0,0,0.20)',
    color: '#fff',
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  rowBtns: { display: 'flex', gap: 8 },
  ghost: {
    appearance: 'none',
    flex: '1 1 0',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primary: {
    appearance: 'none',
    flex: '2 1 0',
    border: 'none',
    background: '#A855F7',
    color: '#0B1D34',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  successBox: {
    fontSize: 12,
    fontWeight: 700,
    color: '#D8B4FE',
    background: 'rgba(168,85,247,0.10)',
    border: '1px solid rgba(168,85,247,0.32)',
    padding: '8px 12px',
    borderRadius: 8,
  },
};

/**
 * @param {object} props
 * @param {object} props.listing
 * @param {string} [props.farmerId]
 * @param {string} [props.buyerName]
 * @param {object} [props.style]
 */
export default function AssistedDealButton({ listing, farmerId = null, buyerName = null, style }) {
  useTranslation();
  const flagOn = isFeatureEnabled('marketMonetization');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = useCallback((e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (submitting || done) return;
    setSubmitting(true);
    try {
      requestAssist({
        listingId: listing?.id,
        farmerId,
        buyerName,
        message: message.trim(),
      });
      setDone(true);
    } catch { /* swallow */ }
    setSubmitting(false);
  }, [submitting, done, listing, farmerId, buyerName, message]);

  if (!flagOn || !listing || !listing.id) return null;

  if (done) {
    return (
      <div
        style={{ ...S.wrap, ...(style || null) }}
        data-testid={`market-assist-success-${listing.id}`}
      >
        <div style={S.successBox}>
          {tStrict('market.assist.success',
            'Thanks \u2014 our team will reach out to help close this deal.')}
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...S.cta, ...(style || null) }}
        data-testid={`market-assist-cta-${listing.id}`}
      >
        <span aria-hidden="true">{'\uD83E\uDD1D'}</span>
        <span>{tStrict('market.assist.cta', 'Get help closing deal')}</span>
      </button>
    );
  }

  return (
    <form
      style={{ ...S.form, ...(style || null) }}
      onSubmit={handleSubmit}
      data-testid={`market-assist-form-${listing.id}`}
      noValidate
    >
      <p style={S.helper}>
        {tStrict('market.assist.helper',
          'Tell us what\u2019s blocking the deal. Our team can help with pricing, logistics, or buyer follow-up.')}
      </p>
      {isFeatureEnabled('marketRevenueScale') && farmerId ? (() => {
        const variant = getAssistPrice(farmerId);
        if (!variant.price) return null;
        return (
          <p
            style={{ ...S.helper, color: '#D8B4FE', fontWeight: 700 }}
            data-testid="market-assist-price"
            data-variant={variant.variant}
          >
            {tStrict('market.assist.price', 'Service fee: {price} {currency}')
              .replace('{price}',    String(variant.price))
              .replace('{currency}', variant.currency)}
          </p>
        );
      })() : null}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={tStrict('market.assist.placeholder',
          'e.g. Buyer wants to negotiate price.')}
        style={S.textarea}
        data-testid="market-assist-message"
      />
      <div style={S.rowBtns}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={S.ghost}
          data-testid="market-assist-cancel"
        >
          {tStrict('common.cancel', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          style={S.primary}
          data-testid="market-assist-submit"
        >
          {submitting
            ? tStrict('common.submitting', 'Submitting\u2026')
            : tStrict('market.assist.send', 'Send request')}
        </button>
      </div>
    </form>
  );
}
