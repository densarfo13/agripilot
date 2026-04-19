/**
 * FarmTypeStep — backyard / small_farm / commercial.
 * Seeded from farm-size choice so the default makes sense.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

const TYPES = [
  { value: 'backyard',   titleKey: 'usRec.farmType.backyard',   bodyKey: 'onboarding.farmType.backyardDesc' },
  { value: 'small_farm', titleKey: 'usRec.farmType.smallFarm',  bodyKey: 'onboarding.farmType.smallFarmDesc' },
  { value: 'commercial', titleKey: 'usRec.farmType.commercial', bodyKey: 'onboarding.farmType.commercialDesc' },
];

export default function FarmTypeStep({ value, onChange, onNext, onBack }) {
  const { t } = useAppSettings();
  return (
    <div style={S.step}>
      <h2 style={S.title}>{t('onboarding.farmType.title')}</h2>
      <p style={S.subtitle}>{t('onboarding.farmType.subtitle')}</p>

      <div style={S.options}>
        {TYPES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); onNext?.(); }}
            style={{ ...S.option, ...(value === opt.value ? S.optionActive : null) }}
            data-testid={`onboarding-farmtype-${opt.value}`}
          >
            <div style={S.optionTitle}>{t(opt.titleKey)}</div>
            <div style={S.optionBody}>{t(opt.bodyKey)}</div>
          </button>
        ))}
      </div>

      <div style={S.row}>
        <button type="button" onClick={onBack} style={S.back}>{t('common.back')}</button>
      </div>
    </div>
  );
}

const S = {
  step: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#EAF2FF' },
  subtitle: { fontSize: '0.875rem', color: '#9FB3C8', margin: '0 0 0.5rem' },
  options: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  option: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
    cursor: 'pointer', textAlign: 'left',
    color: '#EAF2FF', minHeight: '64px',
  },
  optionActive: { borderColor: '#22C55E', background: 'rgba(34,197,94,0.10)' },
  optionTitle: { fontSize: '0.9375rem', fontWeight: 700 },
  optionBody: { fontSize: '0.8125rem', color: '#9FB3C8', marginTop: '0.125rem' },
  row: { display: 'flex', justifyContent: 'flex-start' },
  back: {
    padding: '0.625rem 0.875rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
};
