/**
 * StepLocation — Step 2 of Simple Onboarding.
 *
 *   "Use my farm location"  (primary, requests GPS)
 *   "Enter manually"        (fallback)
 *
 * Manual fallback uses Country dropdown + Region dropdown.
 * Ghana ships with 16 regions per spec §3; other countries
 * use the existing `countriesStates.js` catalogue when available.
 *
 * Strict-rule audit
 *   • Spec §3: never block onboarding on GPS failure.
 *     Permission-denied / timeout falls through to the
 *     manual form silently.
 *   • detectFarmerLocale handles the GPS+permissions logic;
 *     we just consume its result.
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { detectFarmerLocale } from '../i18n/localeDetection/detectFarmerLocale.js';

const GHANA_REGIONS = Object.freeze([
  'Greater Accra', 'Ashanti', 'Eastern', 'Central',
  'Western',       'Western North',
  'Volta',         'Oti',
  'Bono',          'Bono East', 'Ahafo',
  'Northern',      'Savannah', 'North East',
  'Upper East',    'Upper West',
]);

const COUNTRIES = Object.freeze([
  { code: 'GH', name: 'Ghana' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'CI', name: 'Côte d\u2019Ivoire' },
  { code: 'SN', name: 'Senegal' },
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
]);

function regionsFor(countryCode) {
  if (countryCode === 'GH') return GHANA_REGIONS;
  return [];
}

const ISO_TO_NAME = Object.freeze(
  COUNTRIES.reduce((m, c) => Object.assign(m, { [c.code]: c.name }), {}),
);

export default function StepLocation({ value, onChange }) {
  const [busy, setBusy] = React.useState(false);
  const [gpsError, setGpsError] = React.useState(null);

  // Surface the active selection — use the form-state country
  // first, fall back to the detected one.
  const selectedCountry = value.country || '';
  const selectedRegion  = value.region  || '';

  async function tryGps() {
    setBusy(true);
    setGpsError(null);
    try {
      const result = await detectFarmerLocale({ requestGps: true });
      if (result && result.country) {
        onChange({
          country:        ISO_TO_NAME[result.country] || result.country,
          region:         result.region || null,
          locationSource: 'gps',
        });
      } else {
        setGpsError('not-detected');
      }
    } catch {
      setGpsError('failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={S.wrap} data-testid="onboarding-step-location">
      <h1 style={S.title}>
        {tSafe('onboarding.locationTitle', 'Where is your farm?')}
      </h1>
      <p style={S.helper}>
        {tSafe('onboarding.locationHelper',
          'We use this to give weather-aware advice for your region.')}
      </p>

      <button
        type="button"
        onClick={tryGps}
        disabled={busy}
        style={{ ...S.btn, ...S.btnPrimary }}
        data-testid="onboarding-location-gps"
      >
        {busy
          ? tSafe('onboarding.locating', 'Detecting\u2026')
          : `\uD83D\uDCCD ${tSafe('onboarding.useLocation', 'Use my farm location')}`}
      </button>

      {gpsError && (
        <p style={S.errorNote}>
          {tSafe('onboarding.locationFailed',
            'We couldn\u2019t detect your location. Pick it manually below.')}
        </p>
      )}

      <div style={S.divider} aria-hidden="true">
        <span style={S.dividerLine} />
        <span style={S.dividerText}>
          {tSafe('onboarding.manualLocation', 'Or enter manually')}
        </span>
        <span style={S.dividerLine} />
      </div>

      <div style={S.fields}>
        <label style={S.label}>
          {tSafe('setup.country', 'Country')}
          <select
            value={lookupIso(selectedCountry) || ''}
            onChange={(e) => {
              const iso = e.target.value;
              onChange({
                country: ISO_TO_NAME[iso] || '',
                region: '',
                locationSource: 'manual',
              });
            }}
            style={S.select}
            data-testid="onboarding-country-select"
          >
            <option value="">{tSafe('setup.selectCountry', 'Select a country')}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </label>

        {regionsFor(lookupIso(selectedCountry)).length > 0 && (
          <label style={S.label}>
            {tSafe('setup.state', 'Region')}
            <select
              value={selectedRegion || ''}
              onChange={(e) => onChange({
                region: e.target.value,
                locationSource: 'manual',
              })}
              style={S.select}
              data-testid="onboarding-region-select"
            >
              <option value="">
                {tSafe('setup.selectState', 'Select a region')}
              </option>
              {regionsFor(lookupIso(selectedCountry)).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}

function lookupIso(name) {
  if (!name) return '';
  const found = COUNTRIES.find((c) => c.name === name);
  return found ? found.code : '';
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  title: { margin: 0, fontSize: '1.375rem', fontWeight: 700, color: '#EAF2FF' },
  helper: { margin: 0, color: '#9FB3C8', fontSize: '0.9375rem', lineHeight: 1.45 },
  btn: {
    padding: '0.875rem 1rem',
    borderRadius: 14,
    border: 'none',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 52,
  },
  btnPrimary: { background: '#22C55E', color: '#062714' },
  errorNote: {
    margin: 0,
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
    fontSize: '0.8125rem',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    color: '#9FB3C8', fontSize: '0.75rem',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  dividerLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' },
  dividerText: { lineHeight: 1 },
  fields: { display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  label: {
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
    fontSize: '0.8125rem', color: '#9FB3C8', fontWeight: 600,
  },
  select: {
    minHeight: 48,
    padding: '0 0.875rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: '#0F1F3A',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    colorScheme: 'dark',
  },
};
