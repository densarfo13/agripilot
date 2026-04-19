/**
 * CityInput — optional free-text city field. The city stays
 * optional on purpose: recommendations rely on country + state, not
 * on the city, so blocking on it would hurt the flow.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function CityInput({ value, onChange, placeholder }) {
  const { t } = useAppSettings();
  return (
    <label style={S.wrap} data-testid="city-input">
      <span style={S.label}>{t('location.cityOptional')}</span>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder || 'e.g. Frederick'}
        style={S.input}
        maxLength={80}
      />
    </label>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  label: {
    fontSize: '0.6875rem', color: '#9FB3C8', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  input: {
    padding: '0.625rem 0.75rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.9375rem', minHeight: '44px',
  },
};
