/**
 * UpgradePrompt — "Unlock smarter guidance" banner.
 *
 * Spec coverage (Monetization §4)
 *   • Title: "Unlock smarter guidance"
 *   • Shown after scan or insights surfaces (callers decide where).
 *
 * Behaviour
 *   • Self-hides when the `monetization` flag is off.
 *   • Self-hides when the user is already on the pro tier.
 *   • Default upgrade handler flips the local tier to 'pro' so
 *     pilot devices can demo the gated features without a backend.
 *     Production drop-in: pass `onUpgrade={() => navigate('/billing')}`
 *     once the payment surface lands.
 *   • Emits `monetization_upgrade_view` on first render and
 *     `monetization_upgrade_click` on tap.
 *
 * Strict-rule audit
 *   • All visible text via tStrict.
 *   • Inline styles only.
 *   • Never throws — analytics + storage writes are wrapped.
 *   • Never blocks any flow — the banner is purely additive.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import useUserTier from '../../hooks/useUserTier.js';

const S = {
  card: {
    background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(34,197,94,0.10))',
    border: '1px solid rgba(168,85,247,0.45)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  headRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  icon: { fontSize: 20, lineHeight: 1 },
  title: { margin: 0, fontSize: 15, fontWeight: 800, color: '#fff' },
  copy:  { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  bullets: {
    margin: '4px 0 0',
    paddingLeft: 18,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.55,
  },
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  primary: {
    appearance: 'none',
    border: 'none',
    padding: '10px 14px',
    borderRadius: 10,
    background: '#A855F7',
    color: '#0B1D34',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondary: {
    appearance: 'none',
    padding: '10px 14px',
    borderRadius: 10,
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.20)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

const BENEFIT_KEYS = [
  { key: 'monetization.benefit.unlimitedScans', fallback: 'Unlimited plant scans' },
  { key: 'monetization.benefit.advanced',       fallback: 'Advanced insights'      },
  { key: 'monetization.benefit.weekly',         fallback: 'Weekly reports'         },
  { key: 'monetization.benefit.personalized',   fallback: 'Personalized recommendations' },
];

/**
 * @param {object} props
 * @param {string} [props.context]    'scan_result' | 'insights' | …  (analytics tag)
 * @param {() => void} [props.onUpgrade]  override default tier-flip
 * @param {() => void} [props.onDismiss]  optional close handler
 * @param {object} [props.style]      style passthrough
 */
export default function UpgradePrompt({
  context = 'unknown',
  onUpgrade,
  onDismiss,
  style,
}) {
  useTranslation();
  const { isPro, setTier } = useUserTier();
  const flagOn = isFeatureEnabled('monetization');

  const viewed = useRef(false);
  useEffect(() => {
    if (!flagOn || isPro || viewed.current) return;
    viewed.current = true;
    try {
      trackEvent('monetization_upgrade_view', { context });
    } catch { /* swallow */ }
  }, [flagOn, isPro, context]);

  const handleUpgrade = useCallback(() => {
    try {
      trackEvent('monetization_upgrade_click', { context });
    } catch { /* swallow */ }
    if (typeof onUpgrade === 'function') {
      try { onUpgrade(); } catch { /* swallow */ }
      return;
    }
    // Local-first demo: flip tier so pilot devices can preview the
    // gated surfaces without a backend. Replace with a real billing
    // navigation when the payment surface ships.
    try { setTier('pro'); } catch { /* swallow */ }
  }, [context, onUpgrade, setTier]);

  if (!flagOn || isPro) return null;

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="monetization-upgrade-prompt"
      data-context={context}
    >
      <div style={S.headRow}>
        <span style={S.icon} aria-hidden="true">{'\u2728'}</span>
        <h3 style={S.title}>
          {tStrict('monetization.upgrade.title', 'Unlock smarter guidance')}
        </h3>
      </div>
      <p style={S.copy}>
        {tStrict(
          'monetization.upgrade.copy',
          'Go further with deeper analysis and weekly recap reports.'
        )}
      </p>
      <ul style={S.bullets}>
        {BENEFIT_KEYS.map((b) => (
          <li key={b.key}>{tStrict(b.key, b.fallback)}</li>
        ))}
      </ul>
      <div style={S.ctaRow}>
        <button
          type="button"
          onClick={handleUpgrade}
          style={S.primary}
          data-testid="monetization-upgrade-cta"
        >
          {tStrict('monetization.upgrade.cta', 'Upgrade to Pro')}
        </button>
        {typeof onDismiss === 'function' ? (
          <button
            type="button"
            onClick={onDismiss}
            style={S.secondary}
            data-testid="monetization-upgrade-dismiss"
          >
            {tStrict('common.notNow', 'Not now')}
          </button>
        ) : null}
      </div>
    </section>
  );
}
