/**
 * BackyardUpgradePrompt — single-screen modal that surfaces the
 * Backyard → Farmer Mode upgrade per the Optimize Backyard →
 * Farmer Upgrade spec.
 *
 * Render contract
 * ───────────────
 *   <BackyardUpgradePrompt
 *     open={showPrompt}
 *     onUpgrade={() => { ... refresh page after upgrade ... }}
 *     onDismiss={() => setShowPrompt(false)}
 *   />
 *
 * Caller responsibilities:
 *   • Decide WHEN to show via `shouldShowBackyardUpgrade(...)`
 *     and stamp `markUpgradePromptShown()` once decided.
 *   • Wire `onUpgrade` to `markUpgradeAccepted()` + a refresh
 *     so the new userType takes effect.
 *   • Wire `onDismiss` to `markUpgradeDismissed()` (14-day cooldown).
 *
 * UX
 *   • Modal overlay — full-screen backdrop, centred card.
 *   • Single primary green CTA ("Unlock Farm Mode").
 *   • Small "Not now" link below for dismissal.
 *   • Backdrop tap = dismiss (same cooldown).
 *   • Esc key dismisses on desktop.
 *   • role="dialog" + aria-modal for screen readers.
 *
 * Strict-rule audit
 *   • All visible text via tStrict.
 *   • Never throws — every handler wrapped.
 *   • Self-hides when open=false (returns null).
 */

import { useEffect } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';

export default function BackyardUpgradePrompt({
  open = false,
  onUpgrade,
  onDismiss,
}) {
  // Re-render on language change so all strings flip.
  useTranslation();

  // Esc-to-dismiss for desktop. Cleanup on unmount/close.
  useEffect(() => {
    if (!open) return undefined;
    if (typeof window === 'undefined') return undefined;
    const handler = (e) => {
      if (e && e.key === 'Escape' && typeof onDismiss === 'function') {
        try { onDismiss(); } catch { /* ignore */ }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onDismiss]);

  if (!open) return null;

  const title = tStrict(
    'backyardUpgrade.title',
    'You\u2019re growing more than a backyard setup',
  );
  const body = tStrict(
    'backyardUpgrade.body',
    'Unlock Farm Mode for better tracking',
  );
  const benefit1 = tStrict(
    'backyardUpgrade.benefit.tracking',
    'Better tracking across multiple plots',
  );
  const benefit2 = tStrict(
    'backyardUpgrade.benefit.insights',
    'More insights on weather + soil',
  );
  const benefit3 = tStrict(
    'backyardUpgrade.benefit.recommendations',
    'Improved recommendations tuned to farm scale',
  );
  const cta = tStrict('backyardUpgrade.cta', 'Unlock Farm Mode');
  const dismissLabel = tStrict('backyardUpgrade.dismiss', 'Not now');
  const reversibleNote = tStrict(
    'backyardUpgrade.reversible',
    'You can switch back anytime in Settings.',
  );

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && typeof onDismiss === 'function') {
      try { onDismiss(); } catch { /* ignore */ }
    }
  };

  const handleUpgrade = () => {
    if (typeof onUpgrade === 'function') {
      try { onUpgrade(); } catch { /* never propagate */ }
    }
  };

  const handleDismiss = () => {
    if (typeof onDismiss === 'function') {
      try { onDismiss(); } catch { /* ignore */ }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="backyard-upgrade-title"
      data-testid="backyard-upgrade-prompt"
      style={S.backdrop}
      onClick={handleBackdrop}
    >
      <div style={S.card}>
        <div style={S.icon} aria-hidden="true">{'\uD83C\uDF3E'}</div>
        <h2 id="backyard-upgrade-title" style={S.title}>{title}</h2>
        <p style={S.body}>{body}</p>
        <ul style={S.benefitList}>
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
        <button
          type="button"
          style={S.cta}
          onClick={handleUpgrade}
          data-testid="backyard-upgrade-cta"
        >
          {cta}
        </button>
        <p style={S.reversible}>{reversibleNote}</p>
        <button
          type="button"
          style={S.dismiss}
          onClick={handleDismiss}
          data-testid="backyard-upgrade-dismiss"
        >
          {dismissLabel}
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
    maxWidth: 380,
    textAlign: 'center',
    animation: 'paywallEnter 220ms ease-out',
  },
  icon: { fontSize: 32, marginBottom: 6 },
  title: {
    fontSize: 20,
    fontWeight: 800,
    lineHeight: 1.25,
    color: '#FFFFFF',
    margin: '4px 0 8px',
    letterSpacing: '-0.005em',
  },
  body: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 1.5,
    margin: '0 0 14px',
  },
  benefitList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 16px',
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
    lineHeight: 1.5,
  },
  benefitCheck: {
    color: '#86EFAC',
    fontWeight: 900,
    flexShrink: 0,
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
  reversible: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    margin: '8px 0 0',
    fontStyle: 'italic',
  },
  dismiss: {
    appearance: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.55)',
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '10px 12px',
    width: '100%',
    minHeight: 36,
    marginTop: 4,
    WebkitTapHighlightColor: 'transparent',
  },
};
