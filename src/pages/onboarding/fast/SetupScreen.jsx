/**
 * SetupScreen — Screen 1. Language + Country + optional "Use
 * my location". The location button is framed as "fast &
 * optional"; Continue is enabled even if the user skips it.
 *
 * The screen ONLY has these three inputs per spec — no farm
 * size, no soil type, no irrigation. Everything else is
 * deferred or inferred.
 */

import { useState } from 'react';

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

export default function SetupScreen({
  state = {},
  t = null,
  countries = [],      // [{ code, name }]
  detectFn = null,     // () → { country, stateCode, city, accuracyM }
  onPatch = () => {},
  onContinue = null,
  className = '',
}) {
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState(null);

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
  const canContinue = !!setup.language && !!setup.country;

  async function handleDetect() {
    if (typeof detectFn !== 'function') return;
    setDetectError(null);
    setDetecting(true);
    try {
      const r = await detectFn();
      if (!r?.country) throw new Error('no_result');
      onPatch({
        setup: {
          country:   r.country,
          stateCode: r.stateCode || null,
          city:      r.city || null,
          locationSource: 'detect',
        },
      });
    } catch (e) {
      setDetectError(e?.message || 'detect_failed');
    } finally {
      setDetecting(false);
    }
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
          onChange={(e) => onPatch({ setup: { language: e.target.value } })}
          style={fieldInput}
        >
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l] || l}</option>)}
        </select>
      </label>

      <label style={fieldLabel}>
        {ctryLbl}
        <select
          value={setup.country || ''}
          onChange={(e) => onPatch({ setup: {
            country: e.target.value || null,
            stateCode: null,
            locationSource: e.target.value ? 'manual' : null,
          }})}
          style={fieldInput}
        >
          <option value="">—</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </label>

      <button type="button" onClick={handleDetect} disabled={detecting}
              style={{ ...btnSecondary, marginTop: 8 }}>
        📍 {detecting ? detecting_ : useLoc}
      </button>
      <p style={trustLine}>{trust}</p>
      {detectError && <p style={errLine}>{detectFailedLbl}</p>}

      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onContinue}
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
