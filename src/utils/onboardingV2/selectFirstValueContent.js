/**
 * selectFirstValueContent.js — decides what the final screen
 * of onboarding shows. Two branches:
 *
 *   • immediate task available → `{ kind: 'task', ... }`
 *   • no immediate task        → `{ kind: 'plan', ... }`
 *
 * The caller supplies the onboarding state + a `resolvers` bag
 * so this module stays independent of the actual recommendation
 * engine.
 *
 *   resolvers:
 *     getImmediateTask(state)  → task | null
 *     getPlanPreview(state)    → { stage, nextEvents[] } | null
 *
 * Output shape:
 *   {
 *     kind: 'task' | 'plan',
 *     title:    string,
 *     whyKey:   string | null,
 *     nextKey:  string | null,
 *     ctaKey:   string | null,
 *     ctaRoute: string,
 *     payload:  object,   // task or plan details
 *     immediateTask: task | null,
 *   }
 */

export function selectFirstValueContent(state = {}, resolvers = {}) {
  const immediateTask = typeof resolvers.getImmediateTask === 'function'
    ? resolvers.getImmediateTask(state)
    : null;

  if (immediateTask) {
    return {
      kind: 'task',
      title:    immediateTask.title || null,
      titleKey: immediateTask.titleKey || 'onboardingV2.first_value.task_title',
      whyKey:   immediateTask.whyKey   || 'onboardingV2.first_value.task_why',
      nextKey:  null,
      ctaKey:   'onboardingV2.first_value.cta.go_to_today',
      ctaRoute: '/farmer/today',
      payload:  immediateTask,
      immediateTask,
    };
  }

  const planPreview = typeof resolvers.getPlanPreview === 'function'
    ? resolvers.getPlanPreview(state)
    : null;

  return {
    kind: 'plan',
    title:    null,
    titleKey: 'onboardingV2.first_value.plan_title',
    whyKey:   'onboardingV2.first_value.plan_why',
    nextKey:  'onboardingV2.first_value.plan_next',
    ctaKey:   'onboardingV2.first_value.cta.view_plan',
    ctaRoute: '/farmer',
    payload:  planPreview || { stage: state?.selectedCrop ? 'planning' : 'exploring' },
    immediateTask: null,
  };
}
