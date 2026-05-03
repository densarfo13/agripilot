/**
 * Paywall — single-CTA upsell modal for the Pro tier.
 *
 *   <Paywall
 *     open={showPaywall}

*     onUpgrade={() => { ...caller wires billing... }}
 *     onDismiss={() => setShowPaywall(false)}
 *     trigger={'days_milestone'}   // for analytics
 *   />
 *
 * Spec mapping (Monetisation §3)
 * ──────────────────────────────
 *   Title  : "Get smarter daily decisions"
 *   Body   : "Avoid mistakes and improve results with better insights."
 *   CTA    : "Upgrade to Pro"
 *
 * All visible text routes through tStrict so non-English UIs
 * never leak the English fallback. Keys: `paywall.title`,
 * `paywall.body`, `paywall.cta`, `paywall.dismiss`.
 *
 * UX
 *   • Modal overlay — full-screen backdrop, centred card.
 *   • Single primary CTA ("Upgrade to Pro"). A small "Maybe
 *     later" affordance below dismisses the modal AND records
 *     a 24h cooldown so the user isn't re-prompted immediately.
 *   • Backdrop tap = dismiss (same cooldown).
 *   • Esc key dismisses on desktop.
 *   • role="dialog" + aria-modal for screen readers.
 *
 * Caller responsibility
 *   • Decide WHEN to show (use `shouldShowPaywall(trigger, engagement)`).
 *   • Wire `onUpgrade` to the billing flow (Stripe / Play / etc).
 *     For demo purposes the caller may call
 *     `markUpgraded()` from `paywall.js` to flip the local state
 *     while waiting for real billing wiring.
 *
 * Strict guarantees
 *   • Never throws.
 *   • No analytics fired here — caller does it (so the trigger
 *     name + payload can be set per call site).
 */

import { useEffect } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';
import { dismissPaywall } from '../../core/paywall.js';

export default function Paywall({
  open = false,
  onUpgrade,
  onDismiss,
  trigger = null,
}) {
  // Re-render on language change so the 4 visible strings flip
  // when the user toggles language while the modal is open.
  useTranslation();

  // Esc-to-dismiss for desktop. Cleanup on unmount/close.
  useEffect(() => {
    if (!open) return undefined;
    if (typeof window === 'undefined') return undefined;
    const handler = (e) => {
      if (e && e.key === 'Escape') {
        try { dismissPaywall(); } catch { /* ignore */ }
        if (typeof onDismiss === 'function') onDismiss();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onDismiss]);

  if (!open) return null;

  const title    = tStrict('paywall.title',    'Get smarter daily decisions');
  // Freemium spec §4 — body copy aligned to the spec's exact wording.
  const body     = tStrict('paywall.body',     'Avoid mistakes and improve your results with better guidance.');
  // Freemium spec §5 — price anchor. Localized via paywall.price; falls
  // back to the launch default ($7/month) when the key isn't translated.
  const price    = tStrict('paywall.price',    '$7/month');
  const cta      = tStrict('paywall.cta',      'Upgrade to Pro');
  const dismiss  = tStrict('paywall.dismiss',  'Maybe later');

  const handleBackdrop = (e) => {
    // Only close on direct backdrop click (not bubble from card).
    if (e.target === e.currentTarget) {
      try { dismissPaywall(); } catch { /* ignore */ }
      if (typeof onDismiss === 'function') onDismiss();
    }
  };

  const handleDismiss = () => {
    try { dismissPaywall(); } catch { /* ignore */ }
    if (typeof onDismiss === 'function') onDismiss();
  };

  const handleUpgrade = () => {
    if (typeof onUpgrade === 'function') {
      try { onUpgrade(); }
      catch { /* never propagate from a CTA handler */ }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      data-testid="paywall"
      data-trigger={trigger || 'unknown'}
      style={S.backdrop}
      onClick={handleBackdrop}
    >
      <div style={S.card}>
        <div style={S.icon} aria-hidden="true">{'\u2728'}</div>
        <h2 id="paywall-title" style={S.title}>{title}</h2>
        <p style={S.body}>{body}</p>
        {/* Freemium §5 — price anchor sits directly above the CTA so
            the user reads "$7/month" before tapping Upgrade. Visual
            weight kept light (a single line, dim color) so the
            primary action stays the dominant affordance. */}
        <p style={S.price} data-testid="paywall-price">{price}</p>
        <button
          type="button"
          style={S.cta}
          onClick={handleUpgrade}
          data-testid="paywall-cta"
        >
          {cta}
        </button>
        <button
          type="button"
          style={S.dismiss}
          onClick={handleDismiss}
          data-testid="paywall-dismiss"
        >
          {dismiss}
        </button>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(11,29,52,0.78)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 1000,
  },
  card: {
    background: '#0F1A2C',
    border: '1px solid rgba(34,197,94,0.45)',
    borderRadius: 18,
    padding: '24px 22px 20px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.40)',
    color: '#EAF2FF',
    width: '100%',
    maxWidth: 360,
    textAlign: 'center',
    animation: 'paywallEnter 220ms ease-out',
  },
  icon: { fontSize: 30, marginBottom: 6 },
  title: {
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1.2,
    color: '#FFFFFF',
    margin: '4px 0 8px',
    letterSpacing: '-0.01em',
  },
  body: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.5,
    margin: '0 0 12px',
  },
  // Freemium §5 — price line sits between body and CTA. Slightly
  // brighter than the body copy so it reads as a discrete fact,
  // never as an alarm.
  price: {
    fontSize: 13,
    fontWeight: 700,
    color: '#86EFAC',
    margin: '0 0 14px',
    letterSpacing: '0.01em',
  },
  cta: {
    appearance: 'none',
    width: '100%',
    background: '#22C55E',
    color: '#0B1D34',
    border: 'none',
    borderRadius: 12,
    padding: '14px 20px',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 52,
    WebkitTapHighlightColor: 'transparent',
  },
  dismiss: {
    appearance: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.55)',
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '12px',
    width: '100%',
    minHeight: 40,
    marginTop: 4,
    WebkitTapHighlightColor: 'transparent',
  },
};
