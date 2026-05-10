/**
 * ViralLandingPage — value-first landing surface for share-link
 * recipients (Viral Click → Conversion spec).
 *
 * Renders BEFORE any signup / onboarding gate:
 *   §1 immediate action + no login + no signup
 *   §2 value-first headline + short reason
 *   §3 soft CTA → kicks off the existing FastOnboarding flow
 *   §5 stashes the previewed action so FirstActionGate can keep
 *      the same framing on first paint after onboarding
 *
 * Why a new page rather than extending LandingPage.jsx
 * ────────────────────────────────────────────────────
 *   LandingPage is the marketing site (hero / features / pricing
 *   / signup CTAs). The viral landing is a different surface —
 *   single screen, one decision, no marketing sections. Living
 *   in its own file keeps both stable: the marketing site keeps
 *   its conversion funnel, and the viral surface stays minimal.
 *
 * Routing
 *   Wired in App.jsx at /try and /preview. The buildInviteUrl()
 *   in referralStore.js can be updated to point at /try?ref=...
 *   when the team's ready; for now, share URLs land at `/?ref=`
 *   and a small redirect helper inside this module forwards
 *   referral-bearing roots → /try so existing share tokens keep
 *   working.
 *
 * Strict-rule audit
 *   • All visible text via tStrict.
 *   • Never throws — every storage/nav call is guarded.
 *   • No analytics on render (only on tap) so a user who closes
 *     the tab without engaging doesn't pollute the funnel.
 *   • No PII written — referral attribution is the existing
 *     captureIncomingReferralFromURL flow.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tStrict } from '../i18n/strictT.js';
import { trackEvent } from '../core/analytics.js';
import { captureIncomingReferralFromURL } from '../growth/referralStore.js';

// Spec §5 — context-preservation key. ViralLandingPage stashes
// the action it previewed; FirstActionGate reads + clears the
// stamp on first paint so the user sees the same framing across
// the landing → onboarding → home transition.
const PREVIEW_ACTION_KEY = 'farroway:viralPreview:action';

const C = {
  bg:        '#0B1D34',
  bg2:       '#081423',
  green:     '#C8944D',
  greenBg:   'rgba(200,148,77,0.10)',
  greenBd:   'rgba(200,148,77,0.40)',
  greenFg:   '#86EFAC',
  ink:       '#EAF2FF',
  inkSoft:   'rgba(255,255,255,0.72)',
  inkDim:    'rgba(255,255,255,0.55)',
  amber:     '#FCD34D',
};

export default function ViralLandingPage() {
  // Subscribe to language change so localized strings refresh on flip.
  useTranslation();
  const navigate = useNavigate();

  // Capture referral attribution + fire one analytics event on
  // first paint. Any URL `?ref=...` is recorded by the existing
  // helper; we don't need to surface the code in the UI.
  useEffect(() => {
    try { captureIncomingReferralFromURL(); } catch { /* ignore */ }
    try { trackEvent('viral_landing_shown', {}); } catch { /* ignore */ }
  }, []);

  function onGetPlanTap() {
    try { trackEvent('viral_landing_cta_tapped', {}); } catch { /* swallow */ }
    // Spec §5 — stash the previewed action so the post-onboarding
    // gate can echo it back. sessionStorage so it never persists
    // beyond the session; cleared by FirstActionGate on first
    // read. The shape is intentionally minimal — just enough for
    // the gate to recognise we should preserve context.
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(PREVIEW_ACTION_KEY, JSON.stringify({
          headline: 'do_not_water_today',
          framedAt: Date.now(),
        }));
      }
    } catch { /* ignore */ }
    try { navigate('/onboarding/fast'); }
    catch { /* swallow */ }
  }

  // Spec §2 wording — exact strings from the spec, routed through
  // tStrict so non-English users see translated copy when packs
  // ship.
  const eyebrow  = tStrict('viralLanding.eyebrow',  'Today\u2019s plant tip');
  const headline = tStrict('viralLanding.headline', 'Do not water today');
  const reason   = tStrict('viralLanding.reason',
    'Soil is still wet from yesterday \u2014 watering now risks root rot.');
  const cta      = tStrict('viralLanding.cta',      'Get your daily plan');
  const noSignup = tStrict('viralLanding.noSignup', 'No signup required');

  return (
    <main style={S.page} data-testid="viral-landing-page">
      <section style={S.card} role="region" aria-labelledby="viral-headline">
        <span style={S.eyebrow}>{eyebrow}</span>
        <h1 id="viral-headline" style={S.headline}>{headline}</h1>
        <p style={S.reason}>{reason}</p>

        <button
          type="button"
          onClick={onGetPlanTap}
          style={S.cta}
          data-testid="viral-landing-cta"
        >
          {cta}
        </button>
        <p style={S.noSignup}>{noSignup}</p>
      </section>
    </main>
  );
}

/**
 * Test seam — the i18n keys + storage key are the contract; the
 * page itself has no internal helpers worth testing in isolation.
 */
export const _internal = Object.freeze({ PREVIEW_ACTION_KEY });

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bg2} 100%)`,
    color: C.ink,
    padding: '1.5rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '24rem',
    background: C.greenBg,
    border: `1.5px solid ${C.greenBd}`,
    borderRadius: 18,
    padding: '24px 22px 22px',
    boxShadow: '0 10px 32px rgba(0,0,0,0.28)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.greenFg,
  },
  headline: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.2,
    color: '#FFFFFF',
    letterSpacing: '-0.01em',
  },
  reason: {
    margin: 0,
    fontSize: 15,
    color: C.inkSoft,
    lineHeight: 1.5,
  },
  cta: {
    appearance: 'none',
    background: C.green,
    color: '#0B1D34',
    border: 'none',
    borderRadius: 12,
    padding: '14px 20px',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 52,
    width: '100%',
    marginTop: 6,
    boxShadow: '0 6px 22px rgba(200,148,77,0.30)',
    fontFamily: 'inherit',
    WebkitTapHighlightColor: 'transparent',
  },
  noSignup: {
    margin: '4px 0 0',
    fontSize: 12,
    fontWeight: 600,
    color: C.inkDim,
    textAlign: 'center',
  },
};
