/**
 * OnboardingShell — shared chrome for every v2 step.
 * Responsibilities:
 *   • renders the progress dots (if the step is visible)
 *   • renders a back button (except on welcome)
 *   • renders the primary CTA
 *   • applies consistent spacing so each screen feels lightweight
 *
 * Layout rules (per spec):
 *   • one decision per screen — shell keeps the content area single-column
 *   • helper text always appears directly under the title
 *   • footer CTA stays pinned visually
 */

import ProgressDots from './ProgressDots.jsx';
import { ONBOARDING_STEPS } from '../../../utils/onboardingV2/stepIds.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function OnboardingShell({
  step,
  t = null,
  title = null,
  helper = null,
  onBack = null,
  onNext = null,
  nextLabel = null,
  nextDisabled = false,
  children,
  footerExtra = null,
  hideProgress = false,
  hideBack = false,
  className = '',
}) {
  const showBack = !hideBack && step !== ONBOARDING_STEPS.WELCOME && typeof onBack === 'function';
  const showProgress = !hideProgress && step !== ONBOARDING_STEPS.WELCOME
                    && step !== ONBOARDING_STEPS.FIRST_VALUE;

  return (
    <main
      className={`onboarding-shell onboarding-shell--${step} ${className}`.trim()}
      data-step={step}
      style={{
        maxWidth: 520, margin: '0 auto', padding: '24px 20px 32px',
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
      }}
    >
      {showProgress && <ProgressDots currentStep={step} t={t} />}

      {showBack && (
        <button
          type="button"
          onClick={onBack}
          className="onboarding-shell__back"
          style={{
            alignSelf: 'flex-start',
            background: 'transparent', border: 0,
            color: '#37474f', padding: '6px 0', fontSize: 14, cursor: 'pointer',
          }}
        >
          ← {resolve(t, 'onboardingV2.common.back', 'Back')}
        </button>
      )}

      {title && (
        <h1 className="onboarding-shell__title"
            style={{ margin: '12px 0 4px', fontSize: 24, fontWeight: 700, lineHeight: 1.25 }}>
          {title}
        </h1>
      )}
      {helper && (
        <p className="onboarding-shell__helper"
           style={{ margin: '0 0 20px', color: '#546e7a', fontSize: 15, lineHeight: 1.4 }}>
          {helper}
        </p>
      )}

      <div className="onboarding-shell__body" style={{ flex: 1 }}>
        {children}
      </div>

      <footer className="onboarding-shell__footer" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {footerExtra}
        {typeof onNext === 'function' && (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="onboarding-shell__next"
            style={{
              padding: '14px 16px', borderRadius: 10,
              border: 0, background: nextDisabled ? '#b0bec5' : '#1b5e20',
              color: '#fff', fontWeight: 700, fontSize: 16,
              cursor: nextDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {nextLabel || resolve(t, 'onboardingV2.common.continue', 'Continue')}
          </button>
        )}
      </footer>
    </main>
  );
}
