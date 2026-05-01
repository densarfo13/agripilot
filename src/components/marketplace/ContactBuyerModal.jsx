/**
 * ContactBuyerModal — shows the prefilled farmer→buyer message
 * for the farmer to copy / share.
 *
 * Spec coverage (Improve transaction flow §3)
 *   • prefilled message: farmer to buyer
 *
 * Position
 *   Opens from `FarmerInterestPanel` when the farmer taps
 *   "Contact buyer". Performs the status transition
 *   (`interested` → `contacted`) on send, then closes.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Esc + backdrop click both dismiss; body scroll locked
 *     while open.
 *   • Never throws.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import {
  buildFarmerToBuyerMessage,
  transitionInterest,
} from '../../market/marketTransaction.js';

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#0F1B2D',
    color: '#fff',
    width: '100%',
    maxWidth: 540,
    maxHeight: '90vh',
    overflowY: 'auto',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    boxShadow: '0 -8px 30px rgba(0,0,0,0.45)',
    padding: '20px 18px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxSizing: 'border-box',
  },
  closeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
  },
  closeBtn: {
    appearance: 'none',
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    width: 32,
    height: 32,
    borderRadius: '50%',
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  title: { margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' },
  helper: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 },
  textarea: {
    minHeight: 120,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(0,0,0,0.20)',
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  rowBtns: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  ghost: {
    appearance: 'none',
    flex: '1 1 0',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primary: {
    appearance: 'none',
    flex: '2 1 0',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  contactBlock: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  contactLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  copiedTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    fontWeight: 700,
    color: '#86EFAC',
  },
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object}  props.listing
 * @param {object}  props.buyer        the buyer-interest record
 * @param {string}  [props.farmerName]
 * @param {() => void} props.onClose
 */
export default function ContactBuyerModal({
  open,
  listing,
  buyer,
  farmerName = '',
  onClose,
}) {
  useTranslation();
  const closeRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const initialMessage = useMemo(
    () => buildFarmerToBuyerMessage({ listing, buyer, farmerName }),
    [listing, buyer, farmerName],
  );
  const [message, setMessage] = useState(initialMessage);

  // Reset the message when the modal opens for a new buyer.
  useEffect(() => {
    if (!open) return undefined;
    setMessage(initialMessage);
    setCopied(false);
    return undefined;
  }, [open, initialMessage]);

  // Esc + body scroll lock.
  useEffect(() => {
    if (!open) return undefined;
    let prevOverflow = '';
    try {
      if (typeof document !== 'undefined') {
        prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }
    } catch { /* swallow */ }
    const onKey = (e) => {
      if (e && e.key === 'Escape') {
        try { onClose && onClose(); } catch { /* swallow */ }
      }
    };
    try { window.addEventListener('keydown', onKey); }
    catch { /* swallow */ }
    try { closeRef.current && closeRef.current.focus(); }
    catch { /* swallow */ }
    return () => {
      try { window.removeEventListener('keydown', onKey); } catch { /* swallow */ }
      try {
        if (typeof document !== 'undefined') {
          document.body.style.overflow = prevOverflow || '';
        }
      } catch { /* swallow */ }
    };
  }, [open, onClose]);

  const handleCopy = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(String(message || '')).catch(() => { /* swallow */ });
        setCopied(true);
      }
    } catch { /* swallow */ }
  }, [message]);

  const handleSent = useCallback(() => {
    if (!buyer || !buyer.id) {
      try { onClose && onClose(); } catch { /* swallow */ }
      return;
    }
    try { transitionInterest(buyer.id, 'contacted'); } catch { /* swallow */ }
    try { onClose && onClose(); } catch { /* swallow */ }
  }, [buyer, onClose]);

  if (!open || !buyer || !listing) return null;

  const buyerLocation = String(buyer.message || '').split(' \u00B7 ')[0] || '';
  const buyerNote     = String(buyer.message || '').split(' \u00B7 ').slice(1).join(' \u00B7 ');

  return (
    <div
      style={S.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          try { onClose && onClose(); } catch { /* swallow */ }
        }
      }}
      data-testid="market-contact-buyer-modal"
    >
      <div
        style={S.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-buyer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={S.closeRow}>
          <p style={S.eyebrow}>
            {tStrict('market.interest.contactEyebrow', 'Contact buyer')}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            style={S.closeBtn}
            aria-label={tStrict('common.close', 'Close')}
            data-testid="contact-buyer-close"
          >
            {'\u2715'}
          </button>
        </div>

        <h2 id="contact-buyer-title" style={S.title}>
          {buyer.buyerName
            || tStrict('market.interest.fallbackBuyerName', 'there')}
        </h2>

        {(buyerLocation || buyerNote) ? (
          <div style={S.contactBlock} data-testid="contact-buyer-info">
            {buyerLocation ? (
              <>
                <span style={S.contactLabel}>
                  {tStrict('buy.interest.location', 'Your location')}
                </span>
                <span>{buyerLocation}</span>
              </>
            ) : null}
            {buyerNote ? (
              <>
                <span style={{ ...S.contactLabel, marginTop: 4 }}>
                  {tStrict('buy.interest.message', 'Message (optional)')}
                </span>
                <span>{buyerNote}</span>
              </>
            ) : null}
          </div>
        ) : null}

        <p style={S.helper}>
          {tStrict('market.interest.contactHelper',
            'Copy this message and send it through your usual channel \u2014 SMS, WhatsApp, or call.')}
        </p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={S.textarea}
          data-testid="contact-buyer-message"
        />

        <div style={S.rowBtns}>
          <button
            type="button"
            onClick={handleCopy}
            style={S.ghost}
            data-testid="contact-buyer-copy"
          >
            {copied
              ? (
                <span style={S.copiedTag}>
                  <span aria-hidden="true">{'\u2714'}</span>
                  <span>{tStrict('common.copied', 'Copied')}</span>
                </span>
              )
              : tStrict('common.copy', 'Copy')}
          </button>
          <button
            type="button"
            onClick={handleSent}
            style={S.primary}
            data-testid="contact-buyer-mark-sent"
          >
            {tStrict('market.interest.markSent', 'Mark as sent')}
          </button>
        </div>
      </div>
    </div>
  );
}
