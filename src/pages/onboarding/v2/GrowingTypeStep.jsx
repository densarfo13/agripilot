/**
 * GrowingTypeStep — step 3. One question, four options.
 * Selecting "Backyard" derives mode='backyard' downstream, which
 * then branches the size_details content and the recommendations
 * pool.
 */

import OnboardingShell from '../../../components/onboarding/v2/OnboardingShell.jsx';
import { ONBOARDING_STEPS } from '../../../utils/onboardingV2/stepIds.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

const OPTIONS = [
  { id: 'backyard', emoji: '🌱', labelKey: 'onboardingV2.growingType.backyard', fallback: 'Backyard / Home garden' },
  { id: 'small',    emoji: '🌾', labelKey: 'onboardingV2.growingType.small',    fallback: 'Small farm' },
  { id: 'medium',   emoji: '🌻', labelKey: 'onboardingV2.growingType.medium',   fallback: 'Medium farm' },
  { id: 'large',    emoji: '🚜', labelKey: 'onboardingV2.growingType.large',    fallback: 'Large farm' },
];

export default function GrowingTypeStep({
  state = {}, patch = () => {}, t = null,
  onBack = null, onNext = null,
}) {
  return (
    <OnboardingShell
      step={ONBOARDING_STEPS.GROWING_TYPE}
      t={t}
      title={resolve(t, 'onboardingV2.growingType.title',
        'What best describes your growing space?')}
      helper={resolve(t, 'onboardingV2.growingType.helper',
        'This helps us tailor your crop recommendations.')}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!state.growingType}
    >
      <div className="grow-type-options" style={{ display: 'grid', gap: 10 }}>
        {OPTIONS.map((opt) => {
          const selected = state.growingType === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => patch({ growingType: opt.id })}
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
