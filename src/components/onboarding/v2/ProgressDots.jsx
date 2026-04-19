/**
 * ProgressDots — minimal progress indicator. One dot per
 * VISIBLE_STEPS entry. The welcome + first_value screens are NOT
 * counted (they're bookends, not steps). Uses dots rather than a
 * giant progress bar per the UX rules.
 */

import { VISIBLE_STEPS, visibleStepNumber } from '../../../utils/onboardingV2/stepIds.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function ProgressDots({ currentStep, t = null }) {
  const n = visibleStepNumber(currentStep);
  if (n == null) return null;
  const total = VISIBLE_STEPS.length;

  const label = resolve(t, 'onboardingV2.progress.step', `Step ${n} of ${total}`)
    .replace('{n}', String(n))
    .replace('{total}', String(total));

  return (
    <div
      className="onboarding-progress"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={n}
      aria-label={label}
      style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 16px' }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        {VISIBLE_STEPS.map((step, i) => {
          const active = i + 1 === n;
          const done   = i + 1 < n;
          return (
            <span
              key={step}
              data-step={step}
              style={{
                width: active ? 18 : 8, height: 8,
                borderRadius: 4,
                background: done ? '#1b5e20' : active ? '#2e7d32' : '#cfd8dc',
                transition: 'width 200ms ease',
              }}
            />
          );
        })}
      </div>
      <span style={{ fontSize: 12, color: '#607d8b' }}>{label}</span>
    </div>
  );
}
