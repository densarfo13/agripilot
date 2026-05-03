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
import {
  dismissPaywall,
  startFreeTrial,
  getTrialState,
} from '../../core/paywall.js';
// Pricing A/B test §1 — sticky per-user variant assignment.
// Reads (or seeds) the user's bucket on first render; same
// variant on every subsequent open. Fires `experiment_exposure`
// once per session for the conversion-rate denominator.
import { getAssignment } from '../../experiments/abTest.js';
// Premium Monetization §5 — onTrial handler (optional).
// Caller can wire a separate handler to differentiate trial
// starts from full-upgrade conversions in analytics. When not
// supplied, falls back to onUpgrade so existing call sites
// keep working without churning.

export default function Paywall({
  open = false,
  onUpgrade,
  onTrial,
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

  // Optimize Paywall for High Conversion §1 — outcome-led title.
  const title    = tStrict('paywall.title',    'Never miss a problem in your plants');

  // Pricing A/B test §1 + §3 — read the user's pricing variant
  // ($5 / $7 / $9). Sticky per-device; same variant on every
  // open until billing flips them to Pro (post-conversion the
  // paywall stops surfacing anyway). Spec §3: features / UI /
  // timing stay constant — only the price + body line vary.
  // Pricing A/B test §5 — feature- vs benefit-led messaging
  // variant. Same getAssignment helper; wires copy below.
  const _pricingVariant = (() => {
    try { return getAssignment('pricing_tier').variant; }
    catch { return null; }
  })();
  const _messageVariant = (() => {
    try { return getAssignment('paywall_message').variant; }
    catch { return null; }
  })();

  // Freemium spec §4 — body copy aligned to the spec's exact wording.
  // Pricing A/B test §5 — feature-led variant emphasises what
  // the user GETS; benefit-led emphasises the OUTCOME. Both
  // are honest framings — the experiment reveals which lands
  // better with each cohort.
  const body = (_messageVariant && _messageVariant.id === 'feature')
    ? tStrict('paywall.body.feature',
        'Unlimited scans, deeper insights, and the "why" behind every recommendation.')
    : tStrict('paywall.body',
        'Avoid mistakes and improve your results with better guidance.');

  // Freemium spec §5 — price anchor. Pricing A/B test §1: when
  // a variant is assigned, render the variant's label
  // ("$5/month" / "$7/month" / "$9/month"). Falls back to the
  // i18n key when no variant is available (SSR / private mode).
  const price = (_pricingVariant && _pricingVariant.label)
    ? _pricingVariant.label
    : tStrict('paywall.price', '$7/month');
  const cta      = tStrict('paywall.cta',      'Upgrade to Pro');
  const dismiss  = tStrict('paywall.dismiss',  'Maybe later');
  // Premium Monetization §5 — 7-day free trial CTA. Surfaced
  // ONLY when the trial slot hasn't been used yet (single-shot
  // per device). Once started + expired, the slot is locked
  // and only the regular Upgrade path remains.
  const trialState = (() => {
    try { return getTrialState(); }
    catch { return { started: false, active: false }; }
  })();
  const showTrialCta = !trialState.started;
  // Optimize Paywall for High Conversion §3 — "Start free 7-day
  // trial" wording (was "Start 7-day free trial"). Same key
  // (no churn for translators).
  const trialCta = tStrict('paywall.trialCta', 'Start free 7-day trial');
  // Optimize Paywall for High Conversion §2 — 3 benefit bullets.
  // Rendered below the body tagline. Outcome-led copy; same
  // for every variant (the A/B test only varies the body line
  // above, not the bullets).
  const benefit1 = tStrict('paywall.benefit.guidance',
    'Daily guidance tuned to your crop');
  const benefit2 = tStrict('paywall.benefit.detection',
    'Catch problems before they spread');
  const benefit3 = tStrict('paywall.benefit.answers',
    'Clear answers, no jargon');
  // Optimize Paywall for High Conversion §4 + §5 — post-trial
  // price framing + cancel-anytime trust cue. Both render only
  // when the trial CTA is showing — once the trial has been
  // started, the price/trust block becomes the "$7/month" +
  // "Cancel anytime" pair (see render below).
  const priceAfterTrial = tStrict('paywall.priceAfterTrial',
    '$7/month after trial');
  const cancelAnytime = tStrict('paywall.cancelAnytime',
    'Cancel anytime');

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

  // Premium Monetization §5 — start the 7-day trial. Single-
  // shot per device; the trial state itself is single-source-
  // of-truth in paywall.js. After starting, isPro() returns
  // true for the trial window so feature gates open
  // immediately. Caller's onTrial (or onUpgrade fallback)
  // closes the modal + can refresh.
  const handleTrial = () => {
    try { startFreeTrial(); }
    catch { /* swallow — Pro flag flip below still attempts */ }
    const handler = (typeof onTrial === 'function') ? onTrial : onUpgrade;
    if (typeof handler === 'function') {
      try { handler({ source: 'free_trial' }); }
      catch { /* never propagate */ }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      data-testid="paywall"
      data-trigger={trigger || 'unknown'}
      data-pricing-variant={(_pricingVariant && _pricingVariant.id) || 'unknown'}
      data-message-variant={(_messageVariant && _messageVariant.id) || 'unknown'}
      style={S.backdrop}
      onClick={handleBackdrop}
    >
      <div style={S.card}>
        <div style={S.icon} aria-hidden="true">{'\u2728'}</div>
        <h2 id="paywall-title" style={S.title}>{title}</h2>
        <p style={S.body}>{body}</p>
        {/* Optimize Paywall for High Conversion §2 — 3 benefit
            bullets directly under the body tagline. Outcome-led
            language; ✔ glyph leads each line so the eye scans
            the row vertically without re-anchoring. The list
            stays constant across A/B variants (the test only
            varies the body line above) so cohort comparisons
            stay clean. */}
        <ul style={S.benefitList} data-testid="paywall-benefits">
          <li style={S.benefitItem}>
            <span aria-hidden="true" style={S.benefitCheck}>{'\u2714'}</span>
            <span>{benefit1}</span>
          </li>
          <li style={S.benefitItem}>
            <span aria-hidden="true" style={S.benefitCheck}>{'\u2714'}</span>
            <span>{benefit2}</span>
          </li>
          <li style={S.benefitItem}>
            <span aria-hidden="true" style={S.benefitCheck}>{'\u2714'}</span>
            <span>{benefit3}</span>
          </li>
        </ul>
        {/* Optimize Paywall for High Conversion §4 — price line.
            When the trial slot is available, surface
            "$7/month after trial" so the user reads the trial
            CTA below as low-commitment ("free now, $7 after").
            Once the trial has been started/used, the regular
            "$7/month" line shows for honest pricing context. */}
        <p style={S.price} data-testid="paywall-price">
          {showTrialCta ? priceAfterTrial : price}
        </p>
        {/* Optimize Paywall for High Conversion §5 — trust cue.
            Single italic dim line beneath the price; addresses
            the lock-in fear that's the biggest source of
            trial-start hesitation. */}
        <p style={S.trustLine} data-testid="paywall-cancel-anytime">
          {cancelAnytime}
        </p>
        {/* Premium Monetization §5 — 7-day free trial CTA. Single-
            shot per device; renders only when the trial slot is
            still available. Tapping starts the trial (isPro()
            returns true for the next 7 days) AND fires the
            caller's onTrial handler so the modal can close +
            the page can refresh into Pro features. */}
        {showTrialCta ? (
          <button
            type="button"
            style={S.cta}
            onClick={handleTrial}
            data-testid="paywall-trial-cta"
          >
            {trialCta}
          </button>
        ) : null}
        <button
          type="button"
          style={showTrialCta ? S.ctaSecondary : S.cta}
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
  // Optimize Paywall for High Conversion §2 — 3 benefit bullets.
  // Left-aligned list in an otherwise center-aligned card so the
  // eye scans the bullets vertically. Same green ✔ as the
  // BackyardUpgradePrompt (consistency across upgrade prompts).
  benefitList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 14px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  benefitItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.45,
  },
  benefitCheck: {
    color: '#86EFAC',
    fontWeight: 900,
    flexShrink: 0,
  },
  // Optimize Paywall for High Conversion §5 — trust line.
  // Tiny italic dim text directly below the price so the
  // commitment-shape (price + cancel-anytime) reads as one
  // block.
  trustLine: {
    margin: '4px 0 12px',
    fontSize: 11,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.55)',
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
  // Premium Monetization §5 — secondary upgrade button shown
  // BELOW the trial CTA when the trial slot is available.
  // Same shape as cta but ghost-styled so the trial reads as
  // the primary affordance + upgrade reads as the alternative.
  ctaSecondary: {
    appearance: 'none',
    width: '100%',
    background: 'transparent',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.45)',
    borderRadius: 12,
    padding: '12px 20px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 46,
    marginTop: 8,
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
