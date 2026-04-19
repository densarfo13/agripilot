/**
 * USStateSelector — a small selector grouped by display region
 * (East Coast / Midwest / South / Great Plains / Southwest /
 * West Coast / Mountain). Hits GET /api/v2/recommend/us/states
 * on mount and falls back to an inline static list if the
 * endpoint isn't reachable so onboarding never stalls.
 */
import { useEffect, useState } from 'react';

// Inline fallback mirrors server/src/domain/us/usStates.js display
// region mapping, so onboarding works offline too.
const FALLBACK_REGIONS = {
  'East Coast': [
    ['CT','Connecticut'], ['DC','District of Columbia'], ['DE','Delaware'],
    ['FL','Florida'], ['GA','Georgia'], ['MA','Massachusetts'],
    ['MD','Maryland'], ['ME','Maine'], ['NC','North Carolina'],
    ['NH','New Hampshire'], ['NJ','New Jersey'], ['NY','New York'],
    ['PA','Pennsylvania'], ['RI','Rhode Island'], ['SC','South Carolina'],
    ['VA','Virginia'], ['VT','Vermont'],
  ].map(([code, name]) => ({ code, name })),
  'Midwest': [
    ['IA','Iowa'], ['IL','Illinois'], ['IN','Indiana'], ['MI','Michigan'],
    ['MN','Minnesota'], ['MO','Missouri'], ['OH','Ohio'], ['WI','Wisconsin'],
  ].map(([code, name]) => ({ code, name })),
  'Great Plains': [
    ['KS','Kansas'], ['ND','North Dakota'], ['NE','Nebraska'],
    ['OK','Oklahoma'], ['SD','South Dakota'],
  ].map(([code, name]) => ({ code, name })),
  'South': [
    ['AL','Alabama'], ['AR','Arkansas'], ['KY','Kentucky'],
    ['LA','Louisiana'], ['MS','Mississippi'], ['TN','Tennessee'],
    ['WV','West Virginia'],
  ].map(([code, name]) => ({ code, name })),
  'Southwest': [
    ['AZ','Arizona'], ['NM','New Mexico'], ['NV','Nevada'], ['TX','Texas'],
  ].map(([code, name]) => ({ code, name })),
  'West Coast': [
    ['AK','Alaska'], ['CA','California'], ['HI','Hawaii'],
    ['OR','Oregon'], ['WA','Washington'],
  ].map(([code, name]) => ({ code, name })),
  'Mountain': [
    ['CO','Colorado'], ['ID','Idaho'], ['MT','Montana'],
    ['UT','Utah'], ['WY','Wyoming'],
  ].map(([code, name]) => ({ code, name })),
};

export default function USStateSelector({ value, onChange, label = 'State' }) {
  const [regions, setRegions] = useState(FALLBACK_REGIONS);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v2/recommend/us/states', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.regions) return;
        setRegions(payload.regions);
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <label style={S.wrap}>
      <span style={S.label}>{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        style={S.select}
        data-testid="us-state-select"
      >
        <option value="">Select a state…</option>
        {Object.entries(regions).map(([region, states]) => (
          <optgroup key={region} label={region}>
            {states.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  label: {
    fontSize: '0.75rem',
    color: '#6F8299',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  select: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    minHeight: '48px',
  },
};
