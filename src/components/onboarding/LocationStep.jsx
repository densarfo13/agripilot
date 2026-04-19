/**
 * LocationStep — structured location flow for onboarding.
 *
 * Flow:
 *   1. Detected-location card at the top (Use this location / Change)
 *   2. Searchable country selector
 *   3. Dynamic state/region selector (when the country has regions)
 *   4. Optional city input
 *   5. Next button — gated by validateLocation()
 *
 * Writes `{ country, stateCode, state, city }` back through `onChange`.
 * The `stateCode` slot is kept as the canonical identifier so the
 * recommendation engine can key off it directly; `state` mirrors the
 * friendly display name for UI labels and persistence.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { detectRegionViaGps } from '../../lib/regionResolver.js';
import { formatLocation } from '../../utils/formatLocation.js';
import { validateLocation } from '../../utils/validateLocation.js';
import {
  getRegions, resolveRegion, findCountry, requiresState,
} from '../../utils/locationData.js';
import CountrySelector from '../location/CountrySelector.jsx';
import StateRegionSelector from '../location/StateRegionSelector.jsx';
import DetectedLocationCard from '../location/DetectedLocationCard.jsx';
import CityInput from '../location/CityInput.jsx';

export default function LocationStep({ value, onChange, onNext }) {
  const { t } = useAppSettings();
  const v = useMemo(() => value || {}, [value]);

  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(null);
  const [permission, setPermission] = useState('unknown');

  // Kick off a one-shot GPS detection when the step opens and the
  // user hasn't confirmed a location yet. Never blocks the UI —
  // denials or failures flip permission to 'denied' and the rest
  // of the step still works.
  useEffect(() => {
    if (v.country) return;
    let cancelled = false;
    (async () => {
      setDetecting(true);
      const region = await detectRegionViaGps({ timeoutMs: 6000 });
      if (cancelled) return;
      setDetecting(false);
      if (region?.country) {
        setDetected({ country: region.country, stateCode: region.stateCode || null });
      } else if (typeof navigator !== 'undefined' && navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          setPermission(status.state);
        } catch { setPermission('unknown'); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { isValid, errors } = validateLocation({
    country: v.country, state: v.stateCode || v.state,
  });

  function applyCountry(code) {
    const country = findCountry(code);
    const canon = country ? country.code : code;
    onChange({ country: canon, stateCode: null, state: null, city: v.city || '' });
  }

  function applyState(regionCode) {
    const region = resolveRegion(v.country, regionCode);
    onChange({
      ...v,
      stateCode: region?.code || regionCode,
      state: region?.name || null,
    });
  }

  function applyCity(city) { onChange({ ...v, city }); }

  function applyDetected() {
    if (!detected?.country) return;
    const regions = getRegions(detected.country);
    const detectedRegion = detected.stateCode
      ? regions.find((r) => r.code === detected.stateCode) || null
      : null;
    onChange({
      country: detected.country,
      stateCode: detectedRegion?.code || null,
      state: detectedRegion?.name || null,
      city: v.city || '',
    });
  }

  const summary = formatLocation(v);

  return (
    <div style={S.step}>
      <h2 style={S.title}>{t('onboarding.location.title')}</h2>
      <p style={S.subtitle}>{t('onboarding.location.subtitle')}</p>

      <DetectedLocationCard
        detected={detected}
        detecting={detecting}
        permissionState={permission}
        onUse={applyDetected}
        onChange={() => setDetected(null)}
      />

      <CountrySelector value={v.country} onChange={applyCountry} />

      {v.country && requiresState(v.country) && (
        <StateRegionSelector
          country={v.country}
          value={v.stateCode}
          onChange={applyState}
        />
      )}

      {v.country && <CityInput value={v.city} onChange={applyCity} />}

      {summary && (
        <div style={S.summary} data-testid="location-summary">
          <span style={S.summaryLabel}>{t('location.currentlySelected')}</span>
          <span style={S.summaryValue}>{summary}</span>
        </div>
      )}

      {errors.country && (
        <p style={S.err}>{t('validation.countryRequired')}</p>
      )}
      {errors.state && (
        <p style={S.err}>{t('validation.stateRequired')}</p>
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={!isValid}
        style={{ ...S.next, ...(isValid ? null : S.nextDisabled) }}
        data-testid="onboarding-location-next"
      >
        {t('common.next')}
      </button>
    </div>
  );
}

const S = {
  step: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#EAF2FF' },
  subtitle: { fontSize: '0.875rem', color: '#9FB3C8', margin: '0 0 0.5rem' },
  summary: {
    display: 'flex', flexDirection: 'column', gap: '0.125rem',
    padding: '0.625rem 0.75rem', borderRadius: '10px',
    background: 'rgba(14,165,233,0.08)',
    border: '1px solid rgba(14,165,233,0.2)',
    color: '#EAF2FF',
  },
  summaryLabel: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#0EA5E9',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  summaryValue: { fontSize: '0.9375rem', fontWeight: 600 },
  err: { color: '#FCA5A5', fontSize: '0.8125rem', margin: '0.25rem 0 0' },
  next: {
    marginTop: '0.5rem', padding: '0.75rem', borderRadius: '12px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '48px',
  },
  nextDisabled: { opacity: 0.5, cursor: 'not-allowed' },
};
