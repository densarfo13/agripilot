/**
 * WelcomeScreen — new minimal first-impression screen.
 *
 * Rules (from spec):
 *   • ONE question ("Are you new to farming?") — non-blocking
 *   • Auto-detect location in the background — non-blocking
 *   • Primary CTA: "Find My Best Crop"
 *   • Secondary CTA: "Continue Setup"
 *   • Never requires any selection before the user can click
 *   • Never blocks on geolocation failure / denial
 *
 * Stores `{isNewFarmer, location}` to localStorage under
 * `farroway_onboarding` so downstream screens (crop-fit, fast
 * onboarding) can read the context without re-asking.
 *
 * Routing decisions live in pure helpers under
 * src/core/welcome/ so they stay testable.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import {
  saveOnboardingState,
} from '../core/welcome/onboardingState.js';
import {
  resolvePrimaryCtaDestination,
  resolveSecondaryCtaDestination,
} from '../core/welcome/resolveWelcomeRoute.js';
import { safeTrackEvent } from '../lib/analytics.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile, farms } = useProfile();

  const [isNewFarmer, setIsNewFarmer] = useState(null);
  const [location,    setLocation]    = useState(null);
  const [locationTried, setLocationTried] = useState(false);

  // ─── Auto-detect location (non-blocking, fire once) ───────
  useEffect(() => {
    if (!navigator?.geolocation) { setLocationTried(true); return; }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationTried(true);
        safeTrackEvent('welcome.location_detected', {});
      },
      () => {
        if (cancelled) return;
        setLocationTried(true);
        safeTrackEvent('welcome.location_denied', {});
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
    return () => { cancelled = true; };
  }, []);

  function persistAndNavigate(destination, extra = {}) {
    saveOnboardingState({ isNewFarmer, location });
    safeTrackEvent('welcome.cta_clicked', { destination, ...extra });
    navigate(destination);
  }

  function handleFindCrop() {
    const dest = resolvePrimaryCtaDestination({ profile });
    persistAndNavigate(dest, { cta: 'find_crop' });
  }

  function handleContinueSetup() {
    const dest = resolveSecondaryCtaDestination({ profile, farms });
    persistAndNavigate(dest, { cta: 'continue_setup' });
  }

  // ─── Copy (all localized, English fallback) ──────────────
  const greeting = resolve(t, 'welcome.greeting',  'Welcome to Farroway \uD83D\uDC4B');
  const subline  = resolve(t, 'welcome.subline',   'Let\u2019s get your farm moving.');
  const question = resolve(t, 'welcome.question',  'Are you new to farming?');
  const yesLbl   = resolve(t, 'welcome.yes',       'Yes');
  const noLbl    = resolve(t, 'welcome.no',        'No');
  const todaysAction = resolve(t, 'welcome.todaysAction',
    '\uD83C\uDF31 Today\u2019s Suggested Action');
  const findHelper = resolve(t, 'welcome.findHelper',
    'Start by finding the best crop for your location');
  const findCta  = resolve(t, 'welcome.findCta',    'Find My Best Crop');
  const orOther  = resolve(t, 'welcome.orOther',    'Or complete your farm setup');
  const contCta  = resolve(t, 'welcome.continueCta','Continue Setup');

  return (
    <main style={S.page} data-screen="welcome">
      <h2 style={S.title}>{greeting}</h2>
      <p  style={S.sub}>{subline}</p>

      {/* ONE QUESTION — non-blocking */}
      <section style={S.section} data-testid="welcome-question">
        <p style={S.questionLabel}><strong>{question}</strong></p>
        <div style={S.choiceRow}>
          <button
            type="button"
            onClick={() => setIsNewFarmer(true)}
            style={{ ...S.choiceBtn, ...(isNewFarmer === true ? S.choiceActive : {}) }}
            data-testid="welcome-yes"
            aria-pressed={isNewFarmer === true}
          >{yesLbl}</button>
          <button
            type="button"
            onClick={() => setIsNewFarmer(false)}
            style={{ ...S.choiceBtn, ...(isNewFarmer === false ? S.choiceActive : {}) }}
            data-testid="welcome-no"
            aria-pressed={isNewFarmer === false}
          >{noLbl}</button>
        </div>
      </section>

      {/* PRIMARY ACTION */}
      <section style={S.cta} data-testid="welcome-primary">
        <h3 style={S.ctaHeader}>{todaysAction}</h3>
        <p  style={S.ctaBody}>{findHelper}</p>
        <button
          type="button"
          onClick={handleFindCrop}
          style={S.primaryBtn}
          data-testid="welcome-find-crop"
        >{findCta}</button>
      </section>

      {/* SECONDARY ACTION */}
      <section style={S.secondary}>
        <p style={S.secondaryLine}>{orOther}</p>
        <button
          type="button"
          onClick={handleContinueSetup}
          style={S.secondaryBtn}
          data-testid="welcome-continue-setup"
        >{contCta}</button>
      </section>

      {/* Dev-only hint when geolocation has resolved. Non-blocking. */}
      {locationTried && location && (
        <p style={S.locationHint} data-testid="welcome-location-chip">
          \u00B7 {location.lat.toFixed(2)}, {location.lng.toFixed(2)}
        </p>
      )}
    </main>
  );
}

const S = {
  page: {
    maxWidth: 520, margin: '0 auto', padding: '24px 20px 40px',
    minHeight: '100vh', background: '#0B1D34', color: '#fff',
    boxSizing: 'border-box',
  },
  title: { margin: '0 0 6px', fontSize: 22, fontWeight: 700 },
  sub:   { margin: '0 0 16px', color: 'rgba(255,255,255,0.7)' },
  section: {
    marginTop: 12, padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
  questionLabel: { margin: '0 0 8px', fontSize: 15 },
  choiceRow: { display: 'flex', gap: 10 },
  choiceBtn: {
    flex: 1, padding: '10px 12px', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)', color: '#fff',
    fontWeight: 600, cursor: 'pointer',
  },
  choiceActive: {
    background: '#1b5e20', borderColor: '#22C55E', color: '#fff',
  },
  cta: {
    marginTop: 18, padding: '14px 16px', borderRadius: 12,
    border: '1px solid #22C55E',
    background: 'rgba(34,197,94,0.08)',
  },
  ctaHeader: { margin: '0 0 4px', fontSize: 15, fontWeight: 700 },
  ctaBody:   { margin: '0 0 10px', color: 'rgba(255,255,255,0.85)' },
  primaryBtn: {
    padding: '10px 14px', borderRadius: 10,
    border: 'none', background: '#2e7d32', color: '#fff',
    fontWeight: 700, fontSize: 15, cursor: 'pointer',
  },
  secondary: { marginTop: 18 },
  secondaryLine: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  secondaryBtn: {
    marginTop: 5, padding: '8px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent', color: 'rgba(255,255,255,0.85)',
    cursor: 'pointer', fontWeight: 600,
  },
  locationHint: {
    marginTop: 18, color: 'rgba(255,255,255,0.4)', fontSize: 12,
  },
};
