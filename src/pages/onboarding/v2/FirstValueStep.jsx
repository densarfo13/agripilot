/**
 * FirstValueStep — step 8. Onboarding's arrival. Shows either:
 *   • immediate Today task with a "Go to Today" CTA
 *   • or a "Your plan is ready" card with a "View my plan" CTA
 *
 * Caller supplies getImmediateTask(state) + getPlanPreview(state)
 * which the selector picks between.
 */

import { useMemo } from 'react';
import OnboardingShell from '../../../components/onboarding/v2/OnboardingShell.jsx';
import { ONBOARDING_STEPS } from '../../../utils/onboardingV2/stepIds.js';
import { selectFirstValueContent } from '../../../utils/onboardingV2/selectFirstValueContent.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function FirstValueStep({
  state = {}, t = null,
  onBack = null,
  onFinish = null,            // (route, content) => void
  getImmediateTask = null,
  getPlanPreview = null,
}) {
  const content = useMemo(() => selectFirstValueContent(state, {
    getImmediateTask, getPlanPreview,
  }), [state, getImmediateTask, getPlanPreview]);

  const title = content.title || resolve(t, content.titleKey,
    content.kind === 'task' ? 'Your first task is ready' : 'Your plan is ready');
  const why  = resolve(t, content.whyKey,
    content.kind === 'task' ? 'Start here to build a daily rhythm' : 'We\u2019ll guide you from today onward');
  const next = content.nextKey
    ? resolve(t, content.nextKey, 'Open Today when you want to see your first task')
    : null;
  const cta = resolve(t, content.ctaKey, content.kind === 'task' ? 'Go to Today' : 'View my plan');

  return (
    <OnboardingShell
      step={ONBOARDING_STEPS.FIRST_VALUE}
      t={t}
      title={title}
      helper={why}
      onBack={onBack}
      onNext={() => onFinish && onFinish(content.ctaRoute, content)}
      nextLabel={cta}
      hideProgress
    >
      {content.kind === 'task' && content.payload && (
        <section
          style={{
            border: '1px solid #c8e6c9', borderRadius: 12,
            padding: 16, background: '#f1f8e9',
          }}
        >
          <div style={{ fontSize: 13, color: '#2e7d32', fontWeight: 700, marginBottom: 6 }}>
            🎯 Today
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1b5e20' }}>
            {content.payload.title || title}
          </div>
          {content.payload.detail && (
            <p style={{ margin: '6px 0 0', color: '#37474f', fontSize: 14 }}>
              {content.payload.detail}
            </p>
          )}
        </section>
      )}

      {content.kind === 'plan' && (
        <section
          style={{
            border: '1px solid #cfd8dc', borderRadius: 12,
            padding: 16, background: '#fff',
          }}
        >
          <div style={{ fontSize: 13, color: '#78909c', fontWeight: 700, marginBottom: 6 }}>
            Plan
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#263238' }}>
            {state.selectedCrop ? state.selectedCrop : '—'}
          </div>
          {next && (
            <p style={{ margin: '10px 0 0', fontSize: 14, color: '#37474f' }}>
              {next}
            </p>
          )}
        </section>
      )}
    </OnboardingShell>
  );
}
