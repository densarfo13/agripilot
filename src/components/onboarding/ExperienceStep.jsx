/**
 * ExperienceStep — binary "new vs experienced" choice. Drives
 * whether the crop recommendation step surfaces beginner-friendly
 * crops first and hides hard-to-grow picks behind "See more".
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function ExperienceStep({ value, onChange, onNext, onBack }) {
  const { t } = useAppSettings();
  return (
    <div style={S.step}>
      <h2 style={S.title}>{t('onboarding.experience.title')}</h2>
      <p style={S.subtitle}>{t('onboarding.experience.subtitle')}</p>
      <div style={S.options}>
        <Option
          active={value === 'new'}
          onClick={() => { onChange('new'); onNext?.(); }}
          title={t('onboarding.experience.new')}
          body={t('onboarding.experience.newDesc')}
          icon={'\uD83C\uDF31'}
          testId="onboarding-exp-new"
        />
        <Option
          active={value === 'experienced'}
          onClick={() => { onChange('experienced'); onNext?.(); }}
          title={t('onboarding.experience.experienced')}
          body={t('onboarding.experience.experiencedDesc')}
          icon={'\uD83D\uDCAA'}
          testId="onboarding-exp-experienced"
        />
      </div>
      <div style={S.row}>
        <button type="button" onClick={onBack} style={S.back}>{t('common.back')}</button>
      </div>
    </div>
  );
}

function Option({ active, onClick, title, body, icon, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      style={{ ...S.option, ...(active ? S.optionActive : null) }}
    >
      <span style={S.icon}>{icon}</span>
      <span style={S.optionText}>
        <span style={S.optionTitle}>{title}</span>
        <span style={S.optionBody}>{body}</span>
      </span>
    </button>
  );
}

const S = {
  step: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#EAF2FF' },
  subtitle: { fontSize: '0.875rem', color: '#9FB3C8', margin: '0 0 0.5rem' },
  options: { display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  option: {
    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
    padding: '1rem', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
    cursor: 'pointer', textAlign: 'left',
    color: '#EAF2FF', minHeight: '72px',
  },
  optionActive: {
    borderColor: '#22C55E', background: 'rgba(34,197,94,0.10)',
  },
  icon: { fontSize: '1.5rem' },
  optionText: { display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  optionTitle: { fontSize: '1rem', fontWeight: 700 },
  optionBody: { fontSize: '0.8125rem', color: '#9FB3C8' },
  row: { display: 'flex', justifyContent: 'flex-start' },
  back: {
    padding: '0.625rem 0.875rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
};
