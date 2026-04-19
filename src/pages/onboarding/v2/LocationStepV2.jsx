/**
 * LocationStepV2 — step 2. Three states:
 *   • idle / detecting    — primary "Detect my location" CTA
 *   • detected (success)  — show result + confirm prompt
 *   • failure             — retry + manual fallback
 *   • manual              — country / state / (optional) city
 *
 * Caller supplies `detectFn` (returns { country, stateCode, city, accuracyM })
 * and `countries`/`statesForCountry` for the manual path.
 */

import { useState } from 'react';
import OnboardingShell from '../../../components/onboarding/v2/OnboardingShell.jsx';
import { ONBOARDING_STEPS } from '../../../utils/onboardingV2/stepIds.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function LocationStepV2({
  state = {},
  patch = () => {},
  t = null,
  onBack = null,
  onNext = null,
  detectFn = null,
  countries = [],             // [{ code, name }]
  statesForCountry = () => [],
}) {
  const [phase, setPhase] = useState(() => {
    if (state.location?.confirmed) return 'detected';
    if (state.location?.source === 'manual') return 'manual';
    return 'idle';
  });
  const [error, setError] = useState(null);

  const loc = state.location || {};
  const title   = resolve(t, 'onboardingV2.location.title', 'Use your location');
  const helper  = resolve(t, 'onboardingV2.location.helper',
    'This helps us recommend the right crops and tasks.');
  const detectCta = resolve(t, 'onboardingV2.location.detectCta', 'Detect my location');
  const detecting = resolve(t, 'onboardingV2.location.detecting', 'Detecting\u2026');
  const confirmPrompt = resolve(t, 'onboardingV2.location.confirmPrompt',
    'Is this your farm location?');
  const confirmYes = resolve(t, 'onboardingV2.location.confirmYes', 'Yes, use this');
  const chooseManual = resolve(t, 'onboardingV2.location.chooseManual', 'Choose manually');
  const tryAgain = resolve(t, 'onboardingV2.location.tryAgain', 'Try again');
  const failTitle = resolve(t, 'onboardingV2.location.failTitle',
    'We couldn\u2019t detect your location');
  const trust = resolve(t, 'onboardingV2.location.trust.detect',
    'Detected using your device location');

  async function handleDetect() {
    setError(null);
    setPhase('detecting');
    try {
      if (typeof detectFn !== 'function') throw new Error('no_detect_fn');
      const result = await detectFn();
      if (!result?.country) throw new Error('no_result');
      patch({ location: {
        source: 'detect',
        confirmed: false,
        country: result.country,
        stateCode: result.stateCode || null,
        city: result.city || null,
        accuracyM: result.accuracyM ?? null,
      }});
      setPhase('detected');
    } catch (e) {
      setError(e?.message || 'detect_failed');
      setPhase('fail');
    }
  }

  function confirmDetected() {
    patch({ location: { confirmed: true } });
    onNext && onNext();
  }

  function switchToManual() {
    patch({ location: { source: 'manual', confirmed: false } });
    setPhase('manual');
  }

  const detectedSummary = () => (
    <div style={{
      border: '1px solid #cfd8dc', borderRadius: 10, padding: 14,
      background: '#f5f7f8', marginBottom: 16,
    }}>
      <div style={{ fontSize: 12, color: '#78909c', marginBottom: 4 }}>
        {resolve(t, 'onboardingV2.location.detectedLabel', 'Detected location')}
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#263238' }}>
        {[loc.city, loc.stateCode, loc.country].filter(Boolean).join(', ')}
      </div>
      <div style={{ fontSize: 12, color: '#90a4ae', marginTop: 8 }}>
        {trust}
      </div>
    </div>
  );

  return (
    <OnboardingShell
      step={ONBOARDING_STEPS.LOCATION}
      t={t}
      title={title}
      helper={helper}
      onBack={onBack}
      onNext={phase === 'detected' ? confirmDetected
            : phase === 'manual'   ? onNext
            : null}
      nextLabel={phase === 'detected' ? confirmYes
              : phase === 'manual'   ? resolve(t, 'onboardingV2.location.manual.save', 'Save location')
              : null}
      nextDisabled={phase === 'manual' && !(loc.country)}
    >
      {phase === 'idle' && (
        <button type="button" onClick={handleDetect} className="loc-detect"
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 10,
            border: '1px solid #1b5e20', background: '#fff', color: '#1b5e20',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}
        >
          📍 {detectCta}
        </button>
      )}

      {phase === 'detecting' && (
        <div style={{ textAlign: 'center', padding: 24, color: '#455a64' }}>
          {detecting}
        </div>
      )}

      {phase === 'detected' && loc.country && (
        <>
          {detectedSummary()}
          <p style={{ fontSize: 15, color: '#263238', marginBottom: 12 }}>{confirmPrompt}</p>
          <button type="button" onClick={switchToManual} style={btnSecondary}>{chooseManual}</button>
        </>
      )}

      {phase === 'fail' && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#b71c1c', marginTop: 0 }}>
            {failTitle}
          </h3>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" onClick={handleDetect} style={btnPrimary}>{tryAgain}</button>
            <button type="button" onClick={switchToManual} style={btnSecondary}>{chooseManual}</button>
          </div>
          {error && <pre style={{ fontSize: 11, color: '#b0bec5', marginTop: 12 }}>{String(error)}</pre>}
        </>
      )}

      {phase === 'manual' && (
        <div className="loc-manual" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={fieldLabel}>
            {resolve(t, 'onboardingV2.location.manual.country', 'Country')}
            <select
              value={loc.country || ''}
              onChange={(e) => patch({ location: { country: e.target.value || null, stateCode: null, source: 'manual' } })}
              style={fieldInput}
            >
              <option value="">—</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label style={fieldLabel}>
            {resolve(t, 'onboardingV2.location.manual.state', 'State / region')}
            <select
              value={loc.stateCode || ''}
              onChange={(e) => patch({ location: { stateCode: e.target.value || null, source: 'manual' } })}
              style={fieldInput}
              disabled={!loc.country}
            >
              <option value="">—</option>
              {statesForCountry(loc.country).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </label>
          <label style={fieldLabel}>
            {resolve(t, 'onboardingV2.location.manual.city', 'City (optional)')}
            <input
              type="text"
              value={loc.city || ''}
              onChange={(e) => patch({ location: { city: e.target.value || null, source: 'manual' } })}
              style={fieldInput}
            />
          </label>
        </div>
      )}
    </OnboardingShell>
  );
}

const btnPrimary = {
  padding: '10px 16px', borderRadius: 8, border: 0,
  background: '#1b5e20', color: '#fff', fontWeight: 700, cursor: 'pointer',
};
const btnSecondary = {
  padding: '10px 16px', borderRadius: 8,
  border: '1px solid #cfd8dc', background: '#fff', color: '#37474f',
  fontWeight: 600, cursor: 'pointer',
};
const fieldLabel = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 13, color: '#546e7a', fontWeight: 600,
};
const fieldInput = {
  padding: '10px 12px', borderRadius: 8, border: '1px solid #cfd8dc', fontSize: 15,
};
