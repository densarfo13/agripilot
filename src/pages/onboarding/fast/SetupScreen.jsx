/**
 * SetupScreen — Screen 1. Language + Country + optional "Use
 * my location". The location button is framed as "fast &
 * optional"; Continue is enabled even if the user skips it.
 *
 * Trust-safe location flow (Section 9):
 *   • detect → PENDING confirmation (not committed yet)
 *   • "Yes, use this"     → commit country/state/city, locationSource='detect'
 *   • "No, choose manually" → discard detection, user picks country in dropdown
 *
 * The screen ONLY has these three inputs per spec — no farm
 * size, no soil type, no irrigation. Everything else is
 * deferred or inferred.
 */

import { useState } from 'react';
import {
  warnFirstTimeRoutingRegression,
  FIRST_TIME_WARN,
} from '../../../utils/fastOnboarding/index.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

const LOCALES = ['en', 'hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const LOCALE_NAMES = {
  en: 'English', hi: 'हिन्दी', tw: 'Twi', es: 'Español',
  pt: 'Português', fr: 'Français', ar: 'العربية',
  sw: 'Kiswahili', id: 'Bahasa Indonesia',
};

/**
 * Render the "We found your location — is this your farm?"
 * confirmation block. Rendered inline after a successful detect.
 */
function PendingLocationBlock({
  pending, t, countries = [],
  onConfirm, onReject,
}) {
  if (!pending) return null;
  const title   = resolve(t, 'fast_onboarding.setup.location_detected',
                  'We found your location');
  const prompt  = resolve(t, 'fast_onboarding.setup.is_this_your_farm',
                  'Is this your farm location?');
  const yes     = resolve(t, 'fast_onboarding.setup.use_detected',
                  'Yes, use this');
  const no      = resolve(t, 'fast_onboarding.setup.choose_manually',
                  'No, I\u2019ll choose manually');

  const countryName = (() => {
    const hit = countries.find((c) => c.code === pending.country);
    return hit ? hit.name : pending.country;
  })();
  const locationLine = [pending.city, pending.stateCode, countryName]
    .filter(Boolean).join(', ');

  return (
    <section data-pending-location="true" style={pendingBox}>
      <div style={pendingTitle}>{title}</div>
      <div style={pendingLine}>{locationLine || countryName}</div>
      <div style={pendingPrompt}>{prompt}</div>
      <div style={pendingBtns}>
        <button type="button" onClick={onConfirm} style={btnPrimarySmall}>
          {yes}
        </button>
        <button type="button" onClick={onReject} style={btnGhostSmall}>
          {no}
        </button>
      </div>
    </section>
  );
}

export default function SetupScreen({
  state = {},
  t = null,
  countries = [],      // [{ code, name }]
  detectFn = null,     // () → { country, stateCode, city, accuracyM }
  onPatch = () => {},
  onContinue = null,
  className = '',
  onTrackEvent = null, // optional analytics hook
}) {
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState(null);
  // PENDING detection — NOT yet committed to onboarding state.
  const [pendingLocation, setPendingLocation] = useState(null);

  const title    = resolve(t, 'fast_onboarding.setup.title', 'Set up Farroway');
  const helper   = resolve(t, 'fast_onboarding.setup.helper',
    'Choose your language and location to get the best farming guidance');
  const langLbl  = resolve(t, 'fast_onboarding.setup.language', 'Language');
  const ctryLbl  = resolve(t, 'fast_onboarding.setup.country',  'Country');
  const useLoc   = resolve(t, 'fast_onboarding.setup.use_location',
    'Use my location (fast & optional)');
  const detecting_ = resolve(t, 'fast_onboarding.setup.detecting', 'Detecting\u2026');
  const trust    = resolve(t, 'fast_onboarding.setup.trust',
    'We only use this to suggest crops for your area');
  const detectFailedLbl = resolve(t, 'fast_onboarding.setup.detect_failed',
    'We couldn\u2019t detect your location \u2014 you can continue without it');
  const cta      = resolve(t, 'fast_onboarding.setup.cta', 'Continue');

  const setup = state.setup || {};
  const canContinue = !!setup.language && !!setup.country && !pendingLocation;

  function emit(ev, payload = {}) {
    if (typeof onTrackEvent === 'function') {
      try { onTrackEvent(ev, payload); } catch { /* swallow */ }
    }
  }

  async function handleDetect() {
    if (typeof detectFn !== 'function') return;
    setDetectError(null);
    setDetecting(true);
    emit('onboarding_location_detect_clicked');
    try {
      const r = await detectFn();
      if (!r?.country) throw new Error('no_result');
      // Do NOT commit silently. Hold in pending state and ask the
      // user to confirm before we call onPatch.
      setPendingLocation({
        country:   r.country,
        stateCode: r.stateCode || null,
        city:      r.city || null,
      });
      emit('onboarding_location_detect_success');
    } catch (e) {
      setDetectError(e?.message || 'detect_failed');
      emit('onboarding_location_detect_failed', { message: e?.message || 'detect_failed' });
    } finally {
      setDetecting(false);
    }
  }

  function handleConfirmLocation() {
    if (!pendingLocation) return;
    onPatch({
      setup: {
        country:        pendingLocation.country,
        stateCode:      pendingLocation.stateCode,
        city:           pendingLocation.city,
        locationSource: 'detect',
      },
    });
    setPendingLocation(null);
  }

  function handleRejectLocation() {
    // Discard detection — user will choose country manually.
    setPendingLocation(null);
  }

  // Dev assertion: trying to advance with null country when a
  // confirmation is still pending is a wiring bug.
  function handleContinue() {
    if (pendingLocation) {
      warnFirstTimeRoutingRegression(
        FIRST_TIME_WARN.FLOW_ENDED_ON_SAVE_PROFILE,
        { where: 'SetupScreen.handleContinue',
          note: 'continue attempted while location confirmation pending' },
      );
      return;
    }
    if (typeof onContinue === 'function') onContinue();
  }

  return (
    <main
      className={`fast-setup ${className}`.trim()}
      data-step="setup"
      style={wrap}
    >
      <h1 style={h1}>{title}</h1>
      <p  style={helperStyle}>{helper}</p>

      <label style={fieldLabel}>
        {langLbl}
        <select
          value={setup.language || 'en'}
          onChange={(e) => {
            onPatch({ setup: { language: e.target.value } });
            emit('onboarding_language_selected', { language: e.target.value });
          }}
          style={fieldInput}
        >
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l] || l}</option>)}
        </select>
      </label>

      <label style={fieldLabel}>
        {ctryLbl}
        <select
          value={setup.country || ''}
          onChange={(e) => {
            onPatch({ setup: {
              country: e.target.value || null,
              stateCode: null,
              locationSource: e.target.value ? 'manual' : null,
            }});
            if (e.target.value) emit('onboarding_manual_country_selected', { country: e.target.value });
          }}
          style={fieldInput}
        >
          <option value="">—</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </label>

      <button type="button" onClick={handleDetect} disabled={detecting || !!pendingLocation}
              style={{ ...btnSecondary, marginTop: 8 }}>
        📍 {detecting ? detecting_ : useLoc}
      </button>
      <p style={trustLine}>{trust}</p>
      {detectError && <p style={errLine}>{detectFailedLbl}</p>}

      <PendingLocationBlock
        pending={pendingLocation}
        t={t}
        countries={countries}
        onConfirm={handleConfirmLocation}
        onReject={handleRejectLocation}
      />

      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={handleContinue}
        disabled={!canContinue}
        style={{
          ...ctaBtn,
          background: canContinue ? '#1b5e20' : '#b0bec5',
          cursor:    canContinue ? 'pointer' : 'not-allowed',
        }}
      >
        {cta}
      </button>
    </main>
  );
}

const wrap = { maxWidth: 520, margin: '0 auto', minHeight: '100vh',
               padding: '24px 20px 32px', display: 'flex',
               flexDirection: 'column', gap: 14 };
const h1  = { margin: 0, fontSize: 22, fontWeight: 700, color: '#1b1b1b', lineHeight: 1.25 };
const helperStyle = { margin: 0, color: '#546e7a', fontSize: 14, lineHeight: 1.4 };
const fieldLabel = { display: 'flex', flexDirection: 'column', gap: 4,
                     fontSize: 13, color: '#455a64', fontWeight: 600 };
const fieldInput = { padding: '10px 12px', borderRadius: 8,
                     border: '1px solid #cfd8dc', fontSize: 15 };
const btnSecondary = { padding: '12px 14px', borderRadius: 10,
                       border: '1px solid #1b5e20', background: '#fff',
                       color: '#1b5e20', fontWeight: 700, fontSize: 15, cursor: 'pointer' };
const trustLine = { margin: '4px 0 0', color: '#90a4ae', fontSize: 12 };
const errLine   = { margin: '2px 0 0', color: '#c62828', fontSize: 13 };
const ctaBtn = { padding: '14px 16px', borderRadius: 12, border: 0,
                 color: '#fff', fontWeight: 700, fontSize: 16 };

const pendingBox = {
  padding: '14px', borderRadius: 10,
  border: '1px solid #a5d6a7', background: '#f1f8e9',
  display: 'flex', flexDirection: 'column', gap: 8,
};
const pendingTitle = { fontSize: 13, fontWeight: 700, color: '#2e7d32' };
const pendingLine  = { fontSize: 15, fontWeight: 600, color: '#1b1b1b' };
const pendingPrompt = { fontSize: 14, color: '#546e7a' };
const pendingBtns   = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const btnPrimarySmall = {
  padding: '10px 14px', borderRadius: 10, border: 0,
  background: '#1b5e20', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
const btnGhostSmall = {
  padding: '10px 14px', borderRadius: 10,
  border: '1px solid #cfd8dc', background: '#fff',
  color: '#455a64', fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
