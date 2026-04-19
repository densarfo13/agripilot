/**
 * LocationStep — country + state (+ optional city) with a GPS try
 * button and a manual fallback. Writes directly into the form state
 * the parent page controls.
 */
import { useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { detectRegionViaGps } from '../../lib/regionResolver.js';

const COUNTRIES = [
  ['US', 'United States'], ['GH', 'Ghana'], ['NG', 'Nigeria'],
  ['IN', 'India'], ['KE', 'Kenya'], ['TZ', 'Tanzania'],
  ['UG', 'Uganda'], ['ZA', 'South Africa'], ['OTHER', 'Other'],
];

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],
  ['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],
  ['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],
  ['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],
  ['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
  ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],
  ['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],
  ['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],
  ['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
];

export default function LocationStep({ value, onChange, onNext }) {
  const { t } = useAppSettings();
  const [detecting, setDetecting] = useState(false);
  const v = value || {};

  async function handleDetect() {
    setDetecting(true);
    const region = await detectRegionViaGps({ timeoutMs: 6000 });
    setDetecting(false);
    if (region?.country) {
      onChange({ ...v, country: region.country, stateCode: region.stateCode || v.stateCode });
    }
  }

  const canContinue = !!v.country && (v.country !== 'US' || !!v.stateCode);

  return (
    <div style={S.step}>
      <h2 style={S.title}>{t('onboarding.location.title')}</h2>
      <p style={S.subtitle}>{t('onboarding.location.subtitle')}</p>

      <button type="button" onClick={handleDetect} disabled={detecting} style={S.detect}>
        {detecting ? t('onboarding.location.detecting') : t('onboarding.location.detect')}
      </button>

      <label style={S.field}>
        <span style={S.label}>{t('firstLaunch.country')}</span>
        <select
          value={v.country || ''}
          onChange={(e) => onChange({ ...v, country: e.target.value })}
          style={S.select}
          data-testid="onboarding-country"
        >
          <option value="">—</option>
          {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>

      {v.country === 'US' && (
        <label style={S.field}>
          <span style={S.label}>{t('firstLaunch.state')}</span>
          <select
            value={v.stateCode || ''}
            onChange={(e) => onChange({ ...v, stateCode: e.target.value })}
            style={S.select}
            data-testid="onboarding-state"
          >
            <option value="">—</option>
            {US_STATES.map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
          </select>
        </label>
      )}

      <label style={S.field}>
        <span style={S.label}>{t('onboarding.location.city')}</span>
        <input
          type="text"
          value={v.city || ''}
          onChange={(e) => onChange({ ...v, city: e.target.value })}
          placeholder="e.g. Frederick"
          style={S.input}
        />
      </label>

      <button type="button" onClick={onNext} disabled={!canContinue} style={S.next}>
        {t('common.next')}
      </button>
    </div>
  );
}

const S = {
  step: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#EAF2FF' },
  subtitle: { fontSize: '0.875rem', color: '#9FB3C8', margin: '0 0 0.5rem' },
  detect: {
    padding: '0.625rem 0.875rem', borderRadius: '10px',
    border: '1px solid rgba(14,165,233,0.3)', background: 'rgba(14,165,233,0.08)',
    color: '#0EA5E9', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  label: {
    fontSize: '0.6875rem', color: '#9FB3C8', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  input: {
    padding: '0.625rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.9375rem', minHeight: '44px',
  },
  select: {
    padding: '0.625rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.9375rem', minHeight: '44px',
  },
  next: {
    marginTop: '0.75rem', padding: '0.75rem', borderRadius: '12px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '48px',
  },
};
