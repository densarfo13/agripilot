/**
 * ExperienceStepV2 — step 4. Two options. Deliberately binary —
 * we don't ask for years of experience because the downstream
 * crop filter only needs "friendly shortlist" vs "full shortlist".
 */

import OnboardingShell from '../../../components/onboarding/v2/OnboardingShell.jsx';
import { ONBOARDING_STEPS } from '../../../utils/onboardingV2/stepIds.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function ExperienceStepV2({
  state = {}, patch = () => {}, t = null,
  onBack = null, onNext = null,
}) {
  return (
    <OnboardingShell
      step={ONBOARDING_STEPS.EXPERIENCE}
      t={t}
      title={resolve(t, 'onboardingV2.experience.title',
        'How much farming experience do you have?')}
      helper={resolve(t, 'onboardingV2.experience.helper',
        'We\u2019ll adjust crop suggestions and task difficulty.')}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!state.experience}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        {[
          { id: 'new',         emoji: '🌱', labelKey: 'onboardingV2.experience.new',         fallback: 'I\u2019m new' },
          { id: 'experienced', emoji: '👩‍🌾', labelKey: 'onboardingV2.experience.experienced', fallback: 'I have experience' },
        ].map((opt) => {
          const selected = state.experience === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => patch({ experience: opt.id })}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 12,
                border: `2px solid ${selected ? '#1b5e20' : '#e0e0e0'}`,
                background: selected ? '#f1f8e9' : '#fff',
                fontSize: 16, fontWeight: 600, color: '#263238',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 22 }}>{opt.emoji}</span>
              {resolve(t, opt.labelKey, opt.fallback)}
            </button>
          );
        })}
      </div>
    </OnboardingShell>
  );
}
