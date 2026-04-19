/**
 * FarmSizeStep — small / medium / large pills with an optional
 * "exact size" numeric field. Drives the filterCropsByFarmSize
 * demotion and maps to a sensible farmType default downstream.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

const SIZES = [
  { value: 'small',  title: 'Small (< 1 acre)',           body: 'Backyard plots and small gardens.' },
  { value: 'medium', title: 'Medium (1–5 acres)',          body: 'Small farm scale — mixed crops.' },
  { value: 'large',  title: 'Large (5+ acres)',            body: 'Commercial rows and open fields.' },
];

export default function FarmSizeStep({ value, onChange, onNext, onBack }) {
  const { t } = useAppSettings();
  const v = value || {};

  function pick(size) {
    onChange({ ...v, size });
  }

  return (
    <div style={S.step}>
      <h2 style={S.title}>{t('onboarding.size.title')}</h2>
      <p style={S.subtitle}>{t('onboarding.size.subtitle')}</p>

      <div style={S.pills}>
        {SIZES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => pick(opt.value)}
            style={{ ...S.pill, ...(v.size === opt.value ? S.pillActive : null) }}
            data-testid={`onboarding-size-${opt.value}`}
          >
            <div style={S.pillTitle}>{opt.title}</div>
            <div style={S.pillBody}>{opt.body}</div>
          </button>
        ))}
      </div>

      <label style={S.field}>
        <span style={S.label}>{t('onboarding.size.exact')}</span>
        <input
          type="number"
          value={v.exactAcres ?? ''}
          onChange={(e) => onChange({ ...v, exactAcres: e.target.value === '' ? null : Number(e.target.value) })}
          placeholder="2.5"
          min={0} step={0.1}
          style={S.input}
        />
      </label>

      <div style={S.actions}>
        <button type="button" onClick={onBack} style={S.back}>{t('common.back')}</button>
        <button type="button" onClick={onNext} disabled={!v.size} style={S.next}>{t('common.next')}</button>
      </div>
    </div>
  );
}

const S = {
  step: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#EAF2FF' },
  subtitle: { fontSize: '0.875rem', color: '#9FB3C8', margin: '0 0 0.5rem' },
  pills: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  pill: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
    cursor: 'pointer', textAlign: 'left',
    color: '#EAF2FF', minHeight: '64px',
  },
  pillActive: { borderColor: '#22C55E', background: 'rgba(34,197,94,0.10)' },
  pillTitle: { fontSize: '0.9375rem', fontWeight: 700 },
  pillBody: { fontSize: '0.8125rem', color: '#9FB3C8', marginTop: '0.125rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  label: { fontSize: '0.6875rem', color: '#9FB3C8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    padding: '0.625rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.9375rem', minHeight: '44px',
  },
  actions: { display: 'flex', gap: '0.5rem', marginTop: '0.5rem' },
  back: {
    padding: '0.625rem 0.875rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
  next: {
    flex: 1, padding: '0.75rem', borderRadius: '12px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '48px',
  },
};
