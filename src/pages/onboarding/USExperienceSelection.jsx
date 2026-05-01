/**
 * USExperienceSelection — chooser between Backyard / Home Garden
 * and Farm / Agriculture for U.S. users.
 *
 * Position in the codebase
 * ────────────────────────
 * Sits IN FRONT of the two existing onboarding destinations:
 *   • Backyard choice   → /onboarding/backyard  (BackyardOnboarding)
 *   • Farm choice       → /onboarding           (OnboardingV3)
 *
 * Non-U.S. users skip this page entirely (the entry hook from
 * an existing onboarding flow only sends U.S. users here when
 * the feature flag is on). Returning users with
 * `userSelectedExperience: true` are also routed past it.
 *
 * UI rules (per spec §1, §2)
 *   • Two cards: Backyard (recommended) + Farm.
 *   • The recommended card carries a small "Recommended" pill
 *     so the user sees the default without auto-selection.
 *   • A "Skip — set up garden" affordance defaults to backyard
 *     so a farmer who taps past it isn't blocked.
 *   • Visible text via tStrict — strict no-leak in non-en UIs.
 *
 * Persistence (per spec §4)
 *   farroway_user_profile is merged with:
 *     country: 'United States'
 *     experience: 'backyard' | 'farm'
 *     farmType:  'backyard' | 'small_farm'
 *     userSelectedExperience: true
 *     onboardingCompleted: false
 *
 * The follow-on onboarding (Backyard or V3 commercial-farm) is
 * the surface that flips `onboardingCompleted: true` when the
 * user actually finishes setup.
 *
 * Strict-rule audit
 *   • Self-redirects to /dashboard when the feature flag is off.
 *   • Never blocks; the Skip path is always available.
 *   • Defensive — every storage write try/catches.
 */

import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '24px 16px 96px',
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title:    { margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: '6px 0 8px', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
  cardsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 12,
    marginTop: 6,
  },
  card: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: '18px 18px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 160,
    fontFamily: 'inherit',
    transition: 'transform 120ms ease, border-color 120ms ease',
  },
  cardRecommended: {
    border: '1px solid rgba(34,197,94,0.6)',
    background: 'rgba(34,197,94,0.10)',
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  icon: { fontSize: 32, lineHeight: 1 },
  pill: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 999,
    background: '#22C55E',
    color: '#0B1D34',
    whiteSpace: 'nowrap',
  },
  cardTitle:    { margin: 0, fontSize: 17, fontWeight: 800 },
  cardSubtitle: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  skipRow:  { marginTop: 8, display: 'flex', justifyContent: 'center' },
  skipBtn: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: '#22C55E',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: 8,
    fontFamily: 'inherit',
  },
};

const PROFILE_KEY = 'farroway_user_profile';

function _persistChoice({ experience, farmType }) {
  if (typeof localStorage === 'undefined') return;
  // Read-modify-write to keep any unrelated profile fields intact.
  let prev = {};
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') prev = parsed;
    }
  } catch { /* corrupt — start fresh */ }

  const next = {
    ...prev,
    country: 'United States',
    experience,
    farmType,
    userSelectedExperience: true,
    onboardingCompleted: false,
  };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); }
  catch { /* quota / private mode — ignore */ }
}

export default function USExperienceSelection() {
  // Subscribe to language change.
  useTranslation();
  const navigate = useNavigate();

  const flagOn = isFeatureEnabled('usExperienceSelection');

  // Off-flag: do not render — bounce to dashboard so deep links
  // never strand the user.
  useEffect(() => {
    if (!flagOn) {
      try { navigate('/dashboard', { replace: true }); } catch { /* ignore */ }
    } else {
      try { trackEvent('us_experience_selection_shown', {}); } catch { /* ignore */ }
    }
  }, [flagOn, navigate]);

  const choose = useCallback((experience) => {
    const farmType = experience === 'backyard' ? 'backyard' : 'small_farm';
    _persistChoice({ experience, farmType });
    try {
      trackEvent('us_experience_selected', { experience, farmType });
    } catch { /* ignore */ }
    const dest = experience === 'backyard' ? '/onboarding/backyard' : '/onboarding';
    try { navigate(dest, { replace: true }); } catch { /* ignore */ }
  }, [navigate]);

  const skip = useCallback(() => {
    // Spec §2: skipping defaults to backyard.
    try { trackEvent('us_experience_skipped', {}); } catch { /* ignore */ }
    choose('backyard');
  }, [choose]);

  if (!flagOn) return null;

  return (
    <main style={STYLES.page} data-screen="us-experience-selection">
      <h1 style={STYLES.title}>
        {tStrict('usExperience.title', 'What best describes you?')}
      </h1>
      <p style={STYLES.subtitle}>
        {tStrict(
          'usExperience.subtitle',
          'Pick the one that fits. We\u2019ll set up Farroway around it.'
        )}
      </p>

      <div style={STYLES.cardsRow}>
        {/* Backyard — recommended */}
        <button
          type="button"
          onClick={() => choose('backyard')}
          style={{ ...STYLES.card, ...STYLES.cardRecommended }}
          data-testid="us-exp-backyard"
          data-experience="backyard"
        >
          <div style={STYLES.cardHeader}>
            <span style={STYLES.icon} aria-hidden="true">{'\uD83C\uDF31'}</span>
            <span style={STYLES.pill}>
              {tStrict('usExperience.recommended', 'Recommended')}
            </span>
          </div>
          <h2 style={STYLES.cardTitle}>
            {tStrict('usExperience.backyard.title', 'I grow plants at home')}
          </h2>
          <p style={STYLES.cardSubtitle}>
            {tStrict(
              'usExperience.backyard.subtitle',
              'Simple garden setup for backyard, raised beds, pots, or indoor plants.'
            )}
          </p>
        </button>

        {/* Farm */}
        <button
          type="button"
          onClick={() => choose('farm')}
          style={STYLES.card}
          data-testid="us-exp-farm"
          data-experience="farm"
        >
          <div style={STYLES.cardHeader}>
            <span style={STYLES.icon} aria-hidden="true">{'\uD83D\uDE9C'}</span>
          </div>
          <h2 style={STYLES.cardTitle}>
            {tStrict('usExperience.farm.title', 'I manage a farm')}
          </h2>
          <p style={STYLES.cardSubtitle}>
            {tStrict(
              'usExperience.farm.subtitle',
              'Farm setup for crops, fields, tasks, harvest, and selling.'
            )}
          </p>
        </button>
      </div>

      <div style={STYLES.skipRow}>
        <button type="button" onClick={skip} style={STYLES.skipBtn} data-testid="us-exp-skip">
          {tStrict('usExperience.skip', 'Skip \u2014 set up garden')}
        </button>
      </div>
    </main>
  );
}
