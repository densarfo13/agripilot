/**
 * OnboardingEntry — minimal 2-button entry screen at `/start`.
 *
 *   <Route path="/start" element={<OnboardingEntry />} />
 *
 * Spec coverage (Onboarding optimisation §1, §4)
 *   §1 entry screen: "Scan plant" + "Start farm"
 *   §4 immediate value — both paths route to a fast-payoff
 *      surface (scan result OR daily task)
 *
 * Behaviour
 *   • If the user already has an active farm or completed
 *     onboarding, redirect them to /home — never re-onboard a
 *     returning user.
 *   • Two large primary tiles: 📷 Scan plant → /scan
 *                              🌱 Start farm → /start/farm
 *   • Self-suppresses behind `onboardingV2` flag — flag-off
 *     path renders a "coming soon" notice so the route is
 *     always 404-safe (matches /buy + /operator pattern).
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import { isFeatureEnabled } from '../config/features.js';
import { trackEvent } from '../analytics/analyticsStore.js';
import { stampFirstVisit } from '../analytics/funnelEvents.js';

function _readActiveFarm() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_active_farm');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '32px 16px 96px',
    maxWidth: 560,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    justifyContent: 'center',
  },
  hero: { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' },
  title: { margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 },
  tilesCol: { display: 'flex', flexDirection: 'column', gap: 12 },

  // Funnel optimisation §1: Scan is the primary CTA — large
  // hero treatment with bold green gradient + bigger icon.
  tilePrimary: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: '1px solid #22C55E',
    background: 'linear-gradient(135deg, rgba(34,197,94,0.28), rgba(34,197,94,0.10))',
    color: '#fff',
    borderRadius: 18,
    padding: '28px 22px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 10,
    boxShadow: '0 8px 30px rgba(34,197,94,0.25)',
  },
  tilePrimaryIcon: { fontSize: 56, lineHeight: 1 },
  tilePrimaryTitle: { fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' },
  tilePrimaryCopy: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.45,
    maxWidth: 340,
  },
  tilePrimaryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.14)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },

  // Secondary CTA — calmer pill below the hero.
  tileSecondary: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    borderRadius: 12,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left',
  },
  tileSecondaryIcon: { fontSize: 22, lineHeight: 1, flex: '0 0 auto' },
  tileSecondaryBody: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  tileSecondaryTitle: { fontSize: 14, fontWeight: 700 },
  tileSecondaryCopy: { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 },
  comingSoon: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '20px 16px',
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    fontSize: 14,
  },
};

export default function OnboardingEntry() {
  useTranslation();
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('onboardingV2');

  // Returning users: skip the entry and go to home.
  useEffect(() => {
    if (!flagOn) return;
    const farm = _readActiveFarm();
    let onboarded = false;
    try {
      onboarded = typeof localStorage !== 'undefined'
        && localStorage.getItem('farroway_onboarding_completed') === 'true';
    } catch { /* swallow */ }
    if (farm || onboarded) {
      try { trackEvent('onboarding_entry_skipped', { reason: farm ? 'has_farm' : 'completed' }); }
      catch { /* swallow */ }
      try { navigate('/home', { replace: true }); }
      catch { /* swallow */ }
    } else {
      try { trackEvent('onboarding_entry_view', {}); }
      catch { /* swallow */ }
      // Funnel optimisation §10: stamp first visit so the
      // time_to_value calculation has a starting timestamp.
      try { stampFirstVisit({ source: 'onboarding_entry' }); }
      catch { /* swallow */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn]);

  if (!flagOn) {
    return (
      <main style={S.page} data-screen="onboarding-entry-coming-soon">
        <div style={S.hero}>
          <h1 style={S.title}>{tStrict('onb.title', 'Welcome to Farroway')}</h1>
        </div>
        <div style={S.comingSoon}>
          {tStrict('onb.comingSoon',
            'New entry experience rolling out shortly.')}
        </div>
      </main>
    );
  }

  return (
    <main style={S.page} data-screen="onboarding-entry">
      <div style={S.hero}>
        <h1 style={S.title}>
          {tStrict('onb.title', 'Welcome to Farroway')}
        </h1>
        <p style={S.subtitle}>
          {tStrict('onb.subtitle',
            'Pick the fastest path to value. You can always switch later.')}
        </p>
      </div>

      <div style={S.tilesCol}>
        {/* Funnel §1: Primary CTA — Scan plant. Large hero card. */}
        <button
          type="button"
          onClick={() => {
            try { trackEvent('onboarding_entry_pick', { path: 'scan' }); }
            catch { /* swallow */ }
            try { navigate('/scan'); }
            catch { /* swallow */ }
          }}
          style={S.tilePrimary}
          data-testid="onb-entry-scan"
        >
          <span style={S.tilePrimaryBadge}>
            {tStrict('onb.entry.recommended', 'Recommended')}
          </span>
          <span style={S.tilePrimaryIcon} aria-hidden="true">{'\uD83D\uDCF7'}</span>
          <span style={S.tilePrimaryTitle}>
            {tStrict('onb.tile.scan.title', 'Scan a plant')}
          </span>
          <span style={S.tilePrimaryCopy}>
            {tStrict('onb.tile.scan.copy',
              'Take a photo \u2014 we\u2019ll spot issues and give you a tip in seconds.')}
          </span>
        </button>

        {/* Funnel §1: Secondary CTA — Start farm. Compact pill. */}
        <button
          type="button"
          onClick={() => {
            try { trackEvent('onboarding_entry_pick', { path: 'farm' }); }
            catch { /* swallow */ }
            try { navigate('/start/farm'); }
            catch { /* swallow */ }
          }}
          style={S.tileSecondary}
          data-testid="onb-entry-farm"
        >
          <span style={S.tileSecondaryIcon} aria-hidden="true">{'\uD83C\uDF31'}</span>
          <span style={S.tileSecondaryBody}>
            <span style={S.tileSecondaryTitle}>
              {tStrict('onb.tile.farm.title', 'Start your farm')}
            </span>
            <span style={S.tileSecondaryCopy}>
              {tStrict('onb.tile.farm.compactCopy',
                'Just crop + location \u2014 30 seconds.')}
            </span>
          </span>
        </button>
      </div>
    </main>
  );
}
